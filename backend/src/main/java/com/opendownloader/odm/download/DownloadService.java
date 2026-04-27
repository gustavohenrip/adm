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
import java.util.concurrent.Future;
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
import com.opendownloader.odm.download.http.HttpRequestHeaders;
import com.opendownloader.odm.download.http.MultiSegmentDownloader;
import com.opendownloader.odm.download.http.RangeNotSupportedException;
import com.opendownloader.odm.download.queue.RateLimiter;
import com.opendownloader.odm.download.queue.RetryPolicy;
import com.opendownloader.odm.fs.FileCategorizer;
import com.opendownloader.odm.persistence.DownloadEntity;
import com.opendownloader.odm.persistence.DownloadRepository;
import com.opendownloader.odm.persistence.PersistenceGate;
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
    private final PersistenceGate persistenceGate;
    private static final long STALL_TIMEOUT_NANOS = 20_000_000_000L;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "odm-download-runner");
        t.setDaemon(true);
        return t;
    });
    private final ScheduledExecutorService monitor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "odm-download-monitor");
        t.setDaemon(true);
        return t;
    });
    private final Map<String, DownloadRunner> active = new ConcurrentHashMap<>();
    private final Map<String, FutureHolder> runningTasks = new ConcurrentHashMap<>();
    private final Map<String, ProgressMark> progressMarks = new ConcurrentHashMap<>();
    private final Map<String, Long> lastFlushedBytes = new ConcurrentHashMap<>();
    private static final long FLUSH_DELTA_BYTES = 1_048_576L;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(DownloadService.class);

    public DownloadService(DownloadRepository repo, FileCategorizer categorizer, UrlGuard urlGuard,
                           ProgressBus progressBus, DownloadProperties props, CredentialVault vault,
                           RuntimeSettings settings, RateLimiter rateLimiter,
                           ScheduleRuleRepository scheduleRules, SystemEventsBroadcaster systemEvents,
                           PersistenceGate persistenceGate) {
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
        this.persistenceGate = persistenceGate;
    }

    @PostConstruct
    public void start() {
        repo.findAll().forEach(d -> {
            if (d.getSizeBytes() > 0 && d.getDownloadedBytes() >= d.getSizeBytes() && d.getStatus() != DownloadStatus.COMPLETE) {
                if (d.getKind() == DownloadKind.HTTP && existingSize(targetPath(d)) < d.getSizeBytes()) {
                    d.setStatus(DownloadStatus.PAUSED);
                    save(d);
                    return;
                }
                d.setStatus(DownloadStatus.COMPLETE);
                if (d.getCompletedAt() == null) d.setCompletedAt(Instant.now());
                save(d);
            }
        });
        repo.findByStatus(DownloadStatus.DOWNLOADING).forEach(d -> {
            d.setStatus(DownloadStatus.PAUSED);
            save(d);
        });
        monitor.scheduleWithFixedDelay(this::tick, 250, 500, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            flushProgress();
        } catch (Throwable t) {
            log.warn("flush progress failed", t);
        }
        try {
            checkStalled();
        } catch (Throwable t) {
            log.warn("stall check failed", t);
        }
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
        PreviewParts parts = buildPreviewParts(req);
        String id = UUID.randomUUID().toString();
        if (Files.exists(parts.target())) {
            if (!Boolean.TRUE.equals(req.overwrite())) throw new IllegalArgumentException("target already exists");
            Files.deleteIfExists(parts.target());
        }

        DownloadEntity e = new DownloadEntity();
        e.setId(id);
        e.setKind(DownloadKind.HTTP);
        e.setName(parts.filename());
        e.setExt(categorizer.extOf(parts.filename()));
        e.setUrl(parts.info().finalUrl());
        e.setSource(hostLabel(parts.uri()));
        e.setSizeBytes(parts.size());
        e.setDownloadedBytes(0L);
        e.setStatus(DownloadStatus.QUEUED);
        e.setFolder(parts.target().getParent().toString());
        e.setFilename(parts.filename());
        e.setAcceptsRanges(parts.info().acceptsRanges());
        e.setSegments(parts.segments());
        e.setCreatedAt(Instant.now());
        e.setEncryptedCredentials(encryptCredentials(req));
        e.setEncryptedReferer(encryptHeader(req.referer()));
        e.setEncryptedCookies(encryptHeader(req.cookies()));
        e.setEncryptedUserAgent(encryptHeader(req.userAgent()));
        e.setMirrors(joinMirrors(parts.mirrors()));
        e.setChecksumAlgo(ChecksumVerifier.normalize(req.checksumAlgo()));
        e.setChecksumExpected(blankToNull(req.checksumExpected()));
        Files.createDirectories(parts.target().getParent());
        save(e);
        resume(id);
        return view(id);
    }

    public DownloadPreview preview(DownloadCreateRequest req) throws Exception {
        PreviewParts parts = buildPreviewParts(req);
        DownloadCreateRequest normalized = new DownloadCreateRequest(
                parts.info().finalUrl(),
                req.folder(),
                parts.segments(),
                req.username(),
                req.password(),
                req.mirrors(),
                req.checksumAlgo(),
                req.checksumExpected(),
                req.referer(),
                req.cookies(),
                req.userAgent(),
                parts.filename(),
                parts.size(),
                parts.info().acceptsRanges(),
                Boolean.FALSE,
                null
        );
        return new DownloadPreview(UUID.randomUUID().toString(), "http", parts.filename(), hostLabel(parts.uri()),
                parts.info().finalUrl(), parts.target().getParent().toString(), parts.size(),
                parts.info().acceptsRanges(), parts.segments(), normalized, null, Files.exists(parts.target()));
    }

    public DownloadView pause(String id) {
        DownloadEntity snapshot = find(id);
        long currentBytes = progressBus.downloaded(id);
        stopActiveAsync(id);
        executor.submit(() -> {
            try {
                repo.findById(id).ifPresent(e -> {
                    if (e.getStatus() == DownloadStatus.DOWNLOADING || e.getStatus() == DownloadStatus.QUEUED) {
                        e.setDownloadedBytes(Math.max(e.getDownloadedBytes(), currentBytes));
                        e.setStatus(DownloadStatus.PAUSED);
                        save(e);
                        publish(e);
                    }
                });
            } catch (Throwable t) {
                log.warn("async pause persist failed for {}", id, t);
            }
        });
        snapshot.setStatus(DownloadStatus.PAUSED);
        snapshot.setDownloadedBytes(Math.max(snapshot.getDownloadedBytes(), currentBytes));
        return DownloadView.from(snapshot, 0L);
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
        stopActive(id);
        char[] password = null;
        String username = null;
        if (e.getEncryptedCredentials() != null && !e.getEncryptedCredentials().isBlank()) {
            String[] parts = vault.decrypt(e.getEncryptedCredentials()).split("\n", 2);
            username = parts.length > 0 ? parts[0] : null;
            password = parts.length > 1 ? parts[1].toCharArray() : null;
        }
        HttpClient client = HttpClientBuilder.build(settings.proxySettings(), username, password);
        HttpProbe.Info info = HttpProbe.probe(client, uri, headersFrom(e));
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
        DownloadEntity e = find(id);
        Path target = targetPath(e);
        progressBus.reset(id);
        stopActiveAsync(id);
        executor.submit(() -> {
            try {
                delete(id);
                if (deleteFiles) {
                    try {
                        Files.deleteIfExists(target);
                    } catch (Exception ignored) {
                    }
                }
            } catch (Throwable t) {
                log.warn("async remove persist failed for {}", id, t);
            }
        });
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
        HttpRequestHeaders requestHeaders = headersFrom(e);
        URI primary = URI.create(e.getUrl());
        Path target = targetPath(e);
        DownloadRunner job;
        if (e.isAcceptsRanges() && e.getSizeBytes() > 0) {
            int segments = clampSegmentsForSize(e.getSegments(), e.getSizeBytes());
            List<URI> mirrors = parseMirrorEntities(e.getMirrors(), primary);
            job = new MultiSegmentDownloader(e.getId(), client, primary, mirrors, target,
                    e.getSizeBytes(), segments, props.getBufferBytes(), props.getMinSplitBytes(),
                    progressBus, rateLimiter, requestHeaders);
        } else {
            job = new HttpDownloadJob(e.getId(), client, primary, target,
                    e.getSizeBytes(), e.isAcceptsRanges(), progressBus, rateLimiter, props.getBufferBytes(),
                    requestHeaders);
        }
        active.put(e.getId(), job);
        FutureHolder holder = new FutureHolder();
        runningTasks.put(e.getId(), holder);
        holder.future = executor.submit(() -> runJob(e.getId(), job, holder));
    }

    private void runJob(String id, DownloadRunner job, FutureHolder holder) {
        try {
            markStatus(id, DownloadStatus.DOWNLOADING, null);
            RetryPolicy retry = new RetryPolicy(props.getRetry().getMaxAttempts(),
                    props.getRetry().getInitialDelayMs(), props.getRetry().getMaxDelayMs());
            if (job instanceof MultiSegmentDownloader) {
                job.run();
            } else {
                retry.execute(() -> {
                    job.run();
                    return null;
                });
            }
            if (active.remove(id, job)) markComplete(id);
        } catch (RangeNotSupportedException e) {
            if (active.remove(id, job)) restartWithoutRanges(id);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (active.remove(id, job)) markStatus(id, DownloadStatus.PAUSED, null);
        } catch (Exception e) {
            if (isRangeNotSupported(e) && active.remove(id, job)) {
                restartWithoutRanges(id);
                return;
            }
            if (active.remove(id, job)) markStatus(id, DownloadStatus.FAILED, e.getMessage());
        } finally {
            runningTasks.remove(id, holder);
            progressMarks.remove(id);
            lastFlushedBytes.remove(id);
        }
    }

    private static final class FutureHolder {
        volatile Future<?> future;
        void cancel() {
            Future<?> f = future;
            if (f != null) f.cancel(true);
        }
    }

    private void stopActive(String id) {
        DownloadRunner job = active.remove(id);
        if (job != null) job.stop();
        FutureHolder holder = runningTasks.remove(id);
        if (holder != null) holder.cancel();
        progressMarks.remove(id);
        lastFlushedBytes.remove(id);
    }

    private void stopActiveAsync(String id) {
        DownloadRunner job = active.remove(id);
        FutureHolder holder = runningTasks.remove(id);
        progressMarks.remove(id);
        lastFlushedBytes.remove(id);
        if (job == null && holder == null) return;
        executor.submit(() -> {
            try {
                if (job != null) job.stop();
                if (holder != null) holder.cancel();
            } catch (Throwable t) {
                log.warn("async stop failed for {}", id, t);
            }
        });
    }

    private boolean isRangeNotSupported(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof RangeNotSupportedException) return true;
            current = current.getCause();
        }
        return false;
    }

    private void restartWithoutRanges(String id) {
        repo.findById(id).ifPresent(e -> {
            try {
                progressBus.reset(id);
                Files.deleteIfExists(targetPath(e));
                e.setDownloadedBytes(0L);
                e.setAcceptsRanges(false);
                e.setSegments(1);
                e.setStatus(DownloadStatus.QUEUED);
                e.setErrorMessage(null);
                save(e);
                publish(e);
                startJob(e);
            } catch (Exception ex) {
                markStatus(id, DownloadStatus.FAILED, ex.getMessage());
            }
        });
    }

    private void flushProgress() {
        for (String id : active.keySet()) {
            try {
                long current = progressBus.downloaded(id);
                Long prev = lastFlushedBytes.get(id);
                boolean shouldPersist = prev == null || current - prev >= FLUSH_DELTA_BYTES;
                if (shouldPersist) {
                    repo.findById(id).ifPresent(e -> {
                        long downloaded = Math.max(e.getDownloadedBytes(), current);
                        e.setDownloadedBytes(downloaded);
                        DownloadEntity saved = saveIfPresent(e);
                        if (saved != null) {
                            lastFlushedBytes.put(id, downloaded);
                            publish(saved);
                        }
                    });
                } else {
                    repo.findById(id).ifPresent(e -> {
                        e.setDownloadedBytes(Math.max(e.getDownloadedBytes(), current));
                        publish(e);
                    });
                }
            } catch (Throwable t) {
                log.warn("progress flush failed for {}", id, t);
            }
        }
        lastFlushedBytes.keySet().retainAll(active.keySet());
    }

    private void checkStalled() {
        long now = System.nanoTime();
        for (Map.Entry<String, DownloadRunner> entry : active.entrySet()) {
            String id = entry.getKey();
            DownloadRunner runner = entry.getValue();
            long bytes = progressBus.downloaded(id);
            ProgressMark mark = progressMarks.get(id);
            if (mark == null || mark.bytes != bytes) {
                progressMarks.put(id, new ProgressMark(bytes, now));
                continue;
            }
            if (now - mark.timestamp < STALL_TIMEOUT_NANOS) continue;
            log.warn("download {} stalled at {} bytes; restarting workers", id, bytes);
            progressMarks.remove(id);
            if (active.remove(id, runner)) {
                runner.stop();
                FutureHolder holder = runningTasks.remove(id);
                if (holder != null) holder.cancel();
                executor.submit(() -> {
                    try {
                        DownloadEntity e = find(id);
                        startJob(e);
                    } catch (Throwable t) {
                        markStatus(id, DownloadStatus.FAILED, "stalled and restart failed: " + t.getMessage());
                    }
                });
            }
        }
        progressMarks.keySet().retainAll(active.keySet());
    }

    private record ProgressMark(long bytes, long timestamp) { }

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
        return persistenceGate.write(() -> repo.saveAndFlush(e));
    }

    private DownloadEntity saveIfPresent(DownloadEntity e) {
        return persistenceGate.write(() -> repo.existsById(e.getId()) ? repo.saveAndFlush(e) : null);
    }

    private void delete(String id) {
        persistenceGate.write(() -> repo.deleteById(id));
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

    private PreviewParts buildPreviewParts(DownloadCreateRequest req) throws Exception {
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
        HttpRequestHeaders requestHeaders = headersFrom(req);
        HttpProbe.Info info = shouldProbe(req)
                ? HttpProbe.probe(client, uri, requestHeaders)
                : infoFromRequest(req, uri);
        String filename = sanitizeFilename(info.filename());
        Path root = resolveRoot(req.folder());
        Path target = targetFor(root, filename, hasCustomFolder(req.folder())).normalize();
        ensureInside(root, target);
        long size = Math.max(0L, info.contentLength());
        int segments = normalizeSegments(req.segments(), info.acceptsRanges(), size);
        return new PreviewParts(uri, mirrors, info, filename, target, size, segments);
    }

    private boolean shouldProbe(DownloadCreateRequest req) {
        return !Boolean.FALSE.equals(req.probe());
    }

    private HttpProbe.Info infoFromRequest(DownloadCreateRequest req, URI uri) {
        String filename = HttpRequestHeaders.clean(req.filename());
        if (filename == null) filename = filenameFromUri(uri);
        long size = req.sizeBytes() == null ? -1L : Math.max(-1L, req.sizeBytes());
        boolean acceptsRanges = Boolean.TRUE.equals(req.acceptsRanges());
        return new HttpProbe.Info(size, acceptsRanges, uri.toString(), filename, null);
    }

    private HttpRequestHeaders headersFrom(DownloadCreateRequest req) {
        return new HttpRequestHeaders(req.referer(), req.cookies(), req.userAgent());
    }

    private HttpRequestHeaders headersFrom(DownloadEntity e) throws Exception {
        return new HttpRequestHeaders(decryptHeader(e.getEncryptedReferer()),
                decryptHeader(e.getEncryptedCookies()), decryptHeader(e.getEncryptedUserAgent()));
    }

    private String encryptCredentials(DownloadCreateRequest req) throws Exception {
        if (req.username() == null || req.username().isBlank() || req.password() == null) return null;
        return vault.encrypt(req.username() + "\n" + req.password());
    }

    private String encryptHeader(String value) throws Exception {
        String clean = HttpRequestHeaders.clean(value);
        return clean == null ? null : vault.encrypt(clean);
    }

    private String decryptHeader(String value) throws Exception {
        return value == null || value.isBlank() ? null : vault.decrypt(value);
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

    private Path targetFor(Path root, String filename, boolean customFolder) {
        return customFolder ? root.resolve(filename) : categorizer.resolve(root, filename);
    }

    private boolean hasCustomFolder(String folder) {
        return folder != null && !folder.isBlank();
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

    private String filenameFromUri(URI uri) {
        String path = uri.getPath();
        if (path == null || path.isBlank()) return "download.bin";
        int slash = path.lastIndexOf('/');
        String name = slash >= 0 ? path.substring(slash + 1) : path;
        return name == null || name.isBlank() ? "download.bin" : name;
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

    private record PreviewParts(URI uri, List<URI> mirrors, HttpProbe.Info info, String filename, Path target,
                                long size, int segments) { }
}
