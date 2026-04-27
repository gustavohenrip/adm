package com.opendownloader.odm.download;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import com.opendownloader.odm.download.http.ChecksumVerifier;
import com.opendownloader.odm.download.http.ConnectionWarmer;
import com.opendownloader.odm.download.http.DownloadRunner;
import com.opendownloader.odm.download.http.HttpClientBuilder;
import com.opendownloader.odm.download.http.HttpDownloadJob;
import com.opendownloader.odm.download.http.HttpProbe;
import com.opendownloader.odm.download.http.MultiSegmentDownloader;
import com.opendownloader.odm.download.queue.RateLimiter;
import com.opendownloader.odm.download.queue.RetryPolicy;
import com.opendownloader.odm.fs.FileCategorizer;
import com.opendownloader.odm.persistence.DownloadEntity;
import com.opendownloader.odm.persistence.DownloadRepository;
import com.opendownloader.odm.security.CredentialVault;
import com.opendownloader.odm.persistence.ScheduleRuleEntity;
import com.opendownloader.odm.persistence.ScheduleRuleRepository;
import com.opendownloader.odm.security.UrlGuard;
import com.opendownloader.odm.settings.RuntimeSettings;
import com.opendownloader.odm.ws.SystemEventsBroadcaster;

@Service
@EnableConfigurationProperties(DownloadProperties.class)
public class DownloadService {

    private final DownloadRepository repo;
    private final FileCategorizer categorizer;
    private final UrlGuard urlGuard;
    private final ProgressBus progressBus;
    private final DownloadProperties props;
    private final CredentialVault vault;
    private final RuntimeSettings settings;
    private final RateLimiter rateLimiter;
    private final ScheduleRuleRepository scheduleRules;
    private final SystemEventsBroadcaster systemEvents;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ScheduledExecutorService monitor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, DownloadRunner> active = new ConcurrentHashMap<>();
    private final Object writeLock = new Object();

    public DownloadService(DownloadRepository repo, FileCategorizer categorizer, UrlGuard urlGuard,
                           ProgressBus progressBus, DownloadProperties props, CredentialVault vault,
                           RuntimeSettings settings, RateLimiter rateLimiter,
                           ScheduleRuleRepository scheduleRules, SystemEventsBroadcaster systemEvents) {
        this.repo = repo;
        this.categorizer = categorizer;
        this.urlGuard = urlGuard;
        this.progressBus = progressBus;
        this.props = props;
        this.vault = vault;
        this.settings = settings;
        this.rateLimiter = rateLimiter;
        this.scheduleRules = scheduleRules;
        this.systemEvents = systemEvents;
    }

    @PostConstruct
    public void start() {
        repo.findAll().forEach(d -> {
            if (d.getSizeBytes() > 0 && d.getDownloadedBytes() >= d.getSizeBytes() && d.getStatus() != DownloadStatus.COMPLETE) {
                d.setStatus(DownloadStatus.COMPLETE);
                if (d.getCompletedAt() == null) d.setCompletedAt(Instant.now());
                save(d);
            }
        });
        repo.findByStatus(DownloadStatus.DOWNLOADING).forEach(d -> {
            d.setStatus(DownloadStatus.PAUSED);
            save(d);
        });
        monitor.scheduleAtFixedRate(this::flushProgress, 250, 500, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    public void stop() {
        active.values().forEach(DownloadRunner::stop);
        executor.shutdownNow();
        monitor.shutdownNow();
    }

    public List<DownloadView> list() {
        return repo.findAllByOrderByCreatedAtDesc().stream()
                .map(d -> DownloadView.from(d, progressBus.speedBps(d.getId())))
                .toList();
    }

    public DownloadView create(DownloadCreateRequest req) throws Exception {
        if (req == null || req.url() == null || req.url().isBlank()) {
            throw new IllegalArgumentException("url is required");
        }
        URI uri = urlGuard.parseOrReject(req.url().trim());
        List<URI> mirrors = parseMirrors(req.mirrors());
        if (props.isDnsPrefetch()) {
            List<URI> all = new ArrayList<>(mirrors);
            all.add(uri);
            ConnectionWarmer.prefetchDns(all);
        }
        HttpClient client = clientFor(req);
        if (props.isTcpPrewarm()) {
            List<URI> all = new ArrayList<>(mirrors);
            all.add(uri);
            ConnectionWarmer.prewarmTcp(client, all);
        }
        HttpProbe.Info info = HttpProbe.probe(client, uri);
        String id = UUID.randomUUID().toString();
        String filename = sanitizeFilename(info.filename());
        Path root = resolveRoot(req.folder());
        Path target = categorizer.resolve(root, filename).normalize();
        ensureInside(root, target);
        Files.createDirectories(target.getParent());
        long size = Math.max(0L, info.contentLength());
        int segments = normalizeSegments(req.segments(), info.acceptsRanges(), size);

        DownloadEntity e = new DownloadEntity();
        e.setId(id);
        e.setKind(DownloadKind.HTTP);
        e.setName(filename);
        e.setExt(categorizer.extOf(filename));
        e.setUrl(info.finalUrl());
        e.setSource(hostLabel(uri));
        e.setSizeBytes(size);
        e.setDownloadedBytes(existingSize(target));
        e.setStatus(DownloadStatus.QUEUED);
        e.setFolder(target.getParent().toString());
        e.setFilename(filename);
        e.setAcceptsRanges(info.acceptsRanges());
        e.setSegments(segments);
        e.setCreatedAt(Instant.now());
        e.setEncryptedCredentials(encryptCredentials(req));
        e.setMirrors(joinMirrors(mirrors));
        e.setChecksumAlgo(ChecksumVerifier.normalize(req.checksumAlgo()));
        e.setChecksumExpected(blankToNull(req.checksumExpected()));
        save(e);
        resume(id);
        return view(id);
    }

    public DownloadView pause(String id) {
        DownloadRunner job = active.remove(id);
        if (job != null) job.stop();
        DownloadEntity e = find(id);
        if (e.getStatus() == DownloadStatus.DOWNLOADING || e.getStatus() == DownloadStatus.QUEUED) {
            e.setDownloadedBytes(progressBus.downloaded(id));
            e.setStatus(DownloadStatus.PAUSED);
            save(e);
            publish(e);
        }
        return DownloadView.from(e, 0L);
    }

    public DownloadView resume(String id) throws Exception {
        DownloadEntity e = find(id);
        if (e.getStatus() == DownloadStatus.COMPLETE) return DownloadView.from(e, 0L);
        if (active.containsKey(id)) return DownloadView.from(e, progressBus.speedBps(id));
        e.setStatus(DownloadStatus.QUEUED);
        e.setErrorMessage(null);
        save(e);
        publish(e);
        startJob(e);
        return DownloadView.from(e, progressBus.speedBps(id));
    }

    public DownloadView refresh(String id, String newUrl) throws Exception {
        if (newUrl == null || newUrl.isBlank()) throw new IllegalArgumentException("newUrl is required");
        URI uri = urlGuard.parseOrReject(newUrl.trim());
        DownloadEntity e = find(id);
        DownloadRunner job = active.remove(id);
        if (job != null) job.stop();
        char[] password = null;
        String username = null;
        if (e.getEncryptedCredentials() != null && !e.getEncryptedCredentials().isBlank()) {
            String[] parts = vault.decrypt(e.getEncryptedCredentials()).split("\n", 2);
            username = parts.length > 0 ? parts[0] : null;
            password = parts.length > 1 ? parts[1].toCharArray() : null;
        }
        HttpClient client = HttpClientBuilder.build(settings.proxySettings(), username, password);
        HttpProbe.Info info = HttpProbe.probe(client, uri);
        e.setUrl(info.finalUrl());
        e.setSource(hostLabel(uri));
        e.setAcceptsRanges(info.acceptsRanges());
        if (info.contentLength() > 0) e.setSizeBytes(info.contentLength());
        e.setStatus(DownloadStatus.QUEUED);
        e.setErrorMessage(null);
        save(e);
        publish(e);
        startJob(e);
        return DownloadView.from(e, progressBus.speedBps(id));
    }

    public void remove(String id, boolean deleteFiles) throws Exception {
        DownloadRunner job = active.remove(id);
        if (job != null) job.stop();
        DownloadEntity e = find(id);
        delete(id);
        progressBus.reset(id);
        if (deleteFiles) Files.deleteIfExists(targetPath(e));
    }

    public DownloadView view(String id) {
        DownloadEntity e = find(id);
        return DownloadView.from(e, progressBus.speedBps(id));
    }

    public List<DownloadView> resumeAll() {
        List<DownloadView> resumed = new ArrayList<>();
        for (DownloadEntity e : repo.findByStatus(DownloadStatus.PAUSED)) {
            try { resumed.add(resume(e.getId())); } catch (Exception ignored) { }
        }
        for (DownloadEntity e : repo.findByStatus(DownloadStatus.QUEUED)) {
            try { resumed.add(resume(e.getId())); } catch (Exception ignored) { }
        }
        return resumed;
    }

    public List<DownloadView> pauseAll() {
        List<DownloadView> paused = new ArrayList<>();
        for (DownloadEntity e : repo.findByStatus(DownloadStatus.DOWNLOADING)) {
            paused.add(pause(e.getId()));
        }
        for (DownloadEntity e : repo.findByStatus(DownloadStatus.QUEUED)) {
            paused.add(pause(e.getId()));
        }
        return paused;
    }

    public boolean queueIdle() {
        return repo.findByStatus(DownloadStatus.DOWNLOADING).isEmpty()
                && repo.findByStatus(DownloadStatus.QUEUED).isEmpty();
    }

    private void startJob(DownloadEntity e) throws Exception {
        char[] password = null;
        String username = null;
        if (e.getEncryptedCredentials() != null && !e.getEncryptedCredentials().isBlank()) {
            String[] parts = vault.decrypt(e.getEncryptedCredentials()).split("\n", 2);
            username = parts.length > 0 ? parts[0] : null;
            password = parts.length > 1 ? parts[1].toCharArray() : null;
        }
        HttpClient client = HttpClientBuilder.build(settings.proxySettings(), username, password);
        URI primary = URI.create(e.getUrl());
        Path target = targetPath(e);
        DownloadRunner job;
        if (e.isAcceptsRanges() && e.getSizeBytes() > 0) {
            int segments = clampSegmentsForSize(e.getSegments(), e.getSizeBytes());
            List<URI> mirrors = parseMirrorEntities(e.getMirrors(), primary);
            job = new MultiSegmentDownloader(e.getId(), client, primary, mirrors, target,
                    e.getSizeBytes(), segments, props.getBufferBytes(), props.getMinSplitBytes(),
                    progressBus, rateLimiter);
        } else {
            job = new HttpDownloadJob(e.getId(), client, primary, target,
                    e.getSizeBytes(), e.isAcceptsRanges(), progressBus, rateLimiter, props.getBufferBytes());
        }
        active.put(e.getId(), job);
        executor.submit(() -> runJob(e.getId(), job));
    }

    private void runJob(String id, DownloadRunner job) {
        try {
            markStatus(id, DownloadStatus.DOWNLOADING, null);
            RetryPolicy retry = new RetryPolicy(props.getRetry().getMaxAttempts(),
                    props.getRetry().getInitialDelayMs(), props.getRetry().getMaxDelayMs());
            retry.execute(() -> {
                job.run();
                return null;
            });
            if (active.remove(id, job)) markComplete(id);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            active.remove(id, job);
            markStatus(id, DownloadStatus.PAUSED, null);
        } catch (Exception e) {
            active.remove(id, job);
            markStatus(id, DownloadStatus.FAILED, e.getMessage());
        }
    }

    private void flushProgress() {
        try {
            for (String id : active.keySet()) {
                repo.findById(id).ifPresent(e -> {
                    e.setDownloadedBytes(Math.max(e.getDownloadedBytes(), progressBus.downloaded(id)));
                    save(e);
                    publish(e);
                });
            }
        } catch (Exception ignored) {
        }
    }

    private void markStatus(String id, DownloadStatus status, String error) {
        repo.findById(id).ifPresent(e -> {
            e.setStatus(status);
            e.setErrorMessage(error);
            save(e);
            publish(e);
        });
    }

    private void markComplete(String id) {
        repo.findById(id).ifPresent(e -> {
            long size = e.getSizeBytes();
            long downloaded = Math.max(progressBus.downloaded(id), existingSize(targetPath(e)));
            e.setDownloadedBytes(size > 0 ? Math.min(size, downloaded) : downloaded);
            String checksumError = verifyChecksum(e);
            if (checksumError != null) {
                e.setStatus(DownloadStatus.FAILED);
                e.setErrorMessage(checksumError);
            } else {
                e.setStatus(DownloadStatus.COMPLETE);
                e.setCompletedAt(Instant.now());
            }
            save(e);
            publish(e);
            notifyQueueIdle();
        });
    }

    private void notifyQueueIdle() {
        if (!queueIdle()) return;
        boolean shouldShutdown = false;
        if (scheduleRules != null) {
            for (ScheduleRuleEntity rule : scheduleRules.findByEnabledTrue()) {
                if (rule.isShutdownAfter()) { shouldShutdown = true; break; }
            }
        }
        systemEvents.emit("queue.idle", java.util.Map.of("shutdown", shouldShutdown));
    }

    private String verifyChecksum(DownloadEntity e) {
        String algo = ChecksumVerifier.normalize(e.getChecksumAlgo());
        if (algo == null) return null;
        try {
            ChecksumVerifier.Result result = ChecksumVerifier.verify(targetPath(e), algo, e.getChecksumExpected());
            e.setChecksumActual(result.actual());
            if (!result.matches()) {
                return "checksum mismatch (" + algo + "): expected " + e.getChecksumExpected() + ", got " + result.actual();
            }
            return null;
        } catch (Exception ex) {
            return "checksum verify failed: " + ex.getMessage();
        }
    }

    private DownloadEntity save(DownloadEntity e) {
        synchronized (writeLock) {
            return repo.saveAndFlush(e);
        }
    }

    private void delete(String id) {
        synchronized (writeLock) {
            repo.deleteById(id);
        }
    }

    private void publish(DownloadEntity e) {
        DownloadView v = DownloadView.from(e, progressBus.speedBps(e.getId()));
        progressBus.publish(new DownloadSnapshot(e.getId(), e.getKind(), e.getName(), e.getExt(), e.getUrl(),
                e.getSource(), e.getSizeBytes(), v.downloadedBytes(), v.speedBps(), v.etaSeconds(), e.getStatus(),
                e.getFolder(), e.getCreatedAt(), e.getCompletedAt(), e.getErrorMessage()));
    }

    private DownloadEntity find(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("download not found: " + id));
    }

    private HttpClient clientFor(DownloadCreateRequest req) {
        char[] password = req.password() == null ? null : req.password().toCharArray();
        return HttpClientBuilder.build(settings.proxySettings(), req.username(), password);
    }

    private String encryptCredentials(DownloadCreateRequest req) throws Exception {
        if (req.username() == null || req.username().isBlank() || req.password() == null) return null;
        return vault.encrypt(req.username() + "\n" + req.password());
    }

    private Path resolveRoot(String folder) throws Exception {
        String configured = props.getRoot() == null || props.getRoot().isBlank()
                ? System.getProperty("user.home") + "/Downloads/ODM"
                : props.getRoot();
        Path root = pathFrom(folder == null || folder.isBlank() ? configured : folder);
        Files.createDirectories(root);
        return root.toRealPath();
    }

    private Path pathFrom(String value) {
        if ("~".equals(value)) return Paths.get(System.getProperty("user.home"));
        if (value.startsWith("~/") || value.startsWith("~\\")) {
            return Paths.get(System.getProperty("user.home"), value.substring(2));
        }
        return Paths.get(value);
    }

    private Path targetPath(DownloadEntity e) {
        return Paths.get(e.getFolder()).resolve(e.getFilename()).normalize();
    }

    private void ensureInside(Path root, Path target) {
        if (!target.toAbsolutePath().normalize().startsWith(root.toAbsolutePath().normalize())) {
            throw new IllegalArgumentException("target path is outside download folder");
        }
    }

    private int normalizeSegments(Integer requested, boolean acceptsRanges, long size) {
        if (!acceptsRanges) return 1;
        int max = Math.max(1, props.getMaxSegments());
        int value = requested == null ? props.getDefaultSegments() : requested;
        value = Math.max(1, Math.min(max, value));
        if (props.isDynamicChunkSize() && size > 0) {
            int byCapacity = (int) Math.min(max, Math.max(1L, size / Math.max(1L, props.getMinSplitBytes())));
            value = Math.min(value, byCapacity);
            if (size < 1024L * 1024L) value = Math.min(value, 2);
            else if (size < 16L * 1024L * 1024L) value = Math.min(value, 8);
            else if (size < 128L * 1024L * 1024L) value = Math.min(value, 16);
        }
        return Math.max(1, value);
    }

    private int clampSegmentsForSize(int requested, long size) {
        int max = Math.max(1, props.getMaxSegments());
        int value = Math.max(1, Math.min(max, requested));
        if (props.isDynamicChunkSize() && size > 0) {
            int byCapacity = (int) Math.min(max, Math.max(1L, size / Math.max(1L, props.getMinSplitBytes())));
            value = Math.min(value, byCapacity);
        }
        return value;
    }

    private long existingSize(Path path) {
        try {
            return Files.exists(path) ? Files.size(path) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    private String sanitizeFilename(String filename) {
        String value = filename == null || filename.isBlank() ? "download.bin" : filename.trim();
        value = value.replace('\\', '_').replace('/', '_').replace(':', '_');
        value = value.replaceAll("[\\x00-\\x1F\\x7F]", "_");
        if (value.equals(".") || value.equals("..")) return "download.bin";
        return value.length() > 180 ? value.substring(0, 180) : value;
    }

    private String hostLabel(URI uri) {
        String host = uri.getHost();
        return host == null || host.isBlank() ? uri.toString() : host;
    }

    private List<URI> parseMirrors(List<String> mirrors) {
        if (mirrors == null || mirrors.isEmpty()) return List.of();
        List<URI> result = new ArrayList<>();
        for (String raw : mirrors) {
            if (raw == null || raw.isBlank()) continue;
            try { result.add(urlGuard.parseOrReject(raw.trim())); } catch (Exception ignored) { }
        }
        return result;
    }

    private List<URI> parseMirrorEntities(String stored, URI fallback) {
        List<URI> result = new ArrayList<>();
        result.add(fallback);
        if (stored == null || stored.isBlank()) return result;
        for (String raw : stored.split("\\s+")) {
            if (raw.isBlank()) continue;
            try { result.add(URI.create(raw.trim())); } catch (Exception ignored) { }
        }
        return result;
    }

    private String joinMirrors(List<URI> mirrors) {
        if (mirrors == null || mirrors.isEmpty()) return null;
        return String.join(" ", mirrors.stream().map(URI::toString).toList());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
