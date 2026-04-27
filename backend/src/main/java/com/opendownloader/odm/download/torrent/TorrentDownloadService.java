package com.opendownloader.odm.download.torrent;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Service;

import com.opendownloader.odm.download.DownloadKind;
import com.opendownloader.odm.download.DownloadPreview;
import com.opendownloader.odm.download.DownloadSnapshot;
import com.opendownloader.odm.download.DownloadStatus;
import com.opendownloader.odm.download.DownloadView;
import com.opendownloader.odm.download.ProgressBus;
import com.opendownloader.odm.download.http.HttpClientBuilder;
import com.opendownloader.odm.persistence.DownloadEntity;
import com.opendownloader.odm.persistence.DownloadRepository;
import com.opendownloader.odm.persistence.PersistenceGate;
import com.opendownloader.odm.security.UrlGuard;
import com.opendownloader.odm.settings.RuntimeSettings;
import com.frostwire.jlibtorrent.TorrentHandle;
import com.frostwire.jlibtorrent.TorrentInfo;
import com.frostwire.jlibtorrent.TorrentStatus;

@Service
public class TorrentDownloadService {

    private static final int MAX_TORRENT_BYTES = 25 * 1024 * 1024;

    private final TorrentSession torrents;
    private final DownloadRepository repo;
    private final ProgressBus progressBus;
    private final RuntimeSettings settings;
    private final UrlGuard urlGuard;
    private final PersistenceGate persistenceGate;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TorrentDownloadService.class);
    private final ScheduledExecutorService monitor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "odm-torrent-monitor");
        t.setDaemon(true);
        return t;
    });

    public TorrentDownloadService(TorrentSession torrents, DownloadRepository repo, ProgressBus progressBus,
                                  RuntimeSettings settings, UrlGuard urlGuard, PersistenceGate persistenceGate) {
        this.torrents = torrents;
        this.repo = repo;
        this.progressBus = progressBus;
        this.settings = settings;
        this.urlGuard = urlGuard;
        this.persistenceGate = persistenceGate;
    }

    @PostConstruct
    public void start() {
        monitor.scheduleWithFixedDelay(this::tick, 1000, 1000, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            refresh();
        } catch (Throwable t) {
            log.warn("torrent refresh failed", t);
        }
    }

    @PreDestroy
    public void stop() {
        monitor.shutdownNow();
    }

    public DownloadView create(TorrentCreateRequest req) throws Exception {
        if (!torrents.available()) throw new IllegalStateException("torrent session unavailable");
        Path folder = resolveFolder(req == null ? null : req.folder());
        String id = UUID.randomUUID().toString();
        String key;
        String url;
        String name;
        if (req != null && req.magnet() != null && !req.magnet().isBlank()) {
            url = normalizeRequiredMagnet(req.magnet());
            key = sourceKey(TorrentSession.magnetKey(url), url);
            DownloadEntity existing = reusable(key);
            if (existing != null) {
                restoreMissing(existing);
                return DownloadView.from(existing, 0L);
            }
            name = preferredName(req.name(), magnetDisplayName(url, key));
            prepareTarget(folder, name, req.overwrite());
            key = sourceKey(torrents.addMagnet(url, folder), url);
        } else if (req != null && req.torrentUrl() != null && !req.torrentUrl().isBlank()) {
            URI uri = urlGuard.parseOrReject(req.torrentUrl().trim());
            byte[] bytes = downloadTorrentFile(uri);
            TorrentInfo info = new TorrentInfo(bytes);
            key = info.infoHashV1().toHex();
            DownloadEntity existing = reusable(key);
            if (existing != null) return DownloadView.from(existing, 0L);
            name = preferredName(req.name(), torrentName(info, key));
            prepareTarget(folder, name, req.overwrite());
            key = torrents.addTorrentFile(bytes, folder);
            url = uri.toString();
        } else if (req != null && req.torrentBase64() != null && !req.torrentBase64().isBlank()) {
            byte[] bytes = Base64.getDecoder().decode(req.torrentBase64());
            TorrentInfo info = new TorrentInfo(bytes);
            key = info.infoHashV1().toHex();
            DownloadEntity existing = reusable(key);
            if (existing != null) return DownloadView.from(existing, 0L);
            name = preferredName(req.name(), torrentName(info, key));
            prepareTarget(folder, name, req.overwrite());
            key = torrents.addTorrentFile(bytes, folder);
            url = "torrent:" + key;
        } else {
            throw new IllegalArgumentException("magnet, torrentUrl or torrentBase64 required");
        }

        DownloadEntity e = new DownloadEntity();
        e.setId(id);
        e.setKind(DownloadKind.TORRENT);
        e.setName(name);
        e.setExt("torrent");
        e.setUrl(url);
        e.setSource(key);
        e.setSizeBytes(0L);
        e.setDownloadedBytes(0L);
        e.setStatus(DownloadStatus.DOWNLOADING);
        e.setFolder(folder.toString());
        e.setFilename(name);
        e.setAcceptsRanges(false);
        e.setSegments(1);
        e.setCreatedAt(Instant.now());
        save(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public DownloadPreview preview(TorrentCreateRequest req) throws Exception {
        Path folder = resolveFolder(req == null ? null : req.folder());
        String id = UUID.randomUUID().toString();
        if (req != null && req.magnet() != null && !req.magnet().isBlank()) {
            String magnet = normalizeRequiredMagnet(req.magnet());
            String key = TorrentSession.magnetKey(magnet);
            String name = preferredName(req.name(), magnetDisplayName(magnet, key));
            long size = 0L;
            if (name.equals("Magnet " + shortKey(key))) {
                TorrentInfo info = torrents.fetchMagnetInfo(magnet, folder, 5);
                if (info != null && info.isValid()) {
                    key = info.infoHashV1().toHex();
                    name = torrentName(info, key);
                    size = Math.max(0L, info.totalSize());
                }
            }
            TorrentCreateRequest normalized = new TorrentCreateRequest(magnet, null, null, req.folder(), name, null);
            return new DownloadPreview(id, "torrent", name, key == null ? "magnet" : key, magnet,
                    folder.toString(), size, false, 1, null, normalized, Files.exists(folder.resolve(name)));
        }
        if (req != null && req.torrentUrl() != null && !req.torrentUrl().isBlank()) {
            URI uri = urlGuard.parseOrReject(req.torrentUrl().trim());
            TorrentInfo info = new TorrentInfo(downloadTorrentFile(uri));
            String key = info.infoHashV1().toHex();
            String name = torrentName(info, key);
            TorrentCreateRequest normalized = new TorrentCreateRequest(null, uri.toString(), null, req.folder(), name, null);
            return new DownloadPreview(id, "torrent", name, key, uri.toString(), folder.toString(),
                    Math.max(0L, info.totalSize()), false, 1, null, normalized, Files.exists(folder.resolve(name)));
        }
        if (req != null && req.torrentBase64() != null && !req.torrentBase64().isBlank()) {
            byte[] bytes = Base64.getDecoder().decode(req.torrentBase64());
            TorrentInfo info = new TorrentInfo(bytes);
            String key = info.infoHashV1().toHex();
            String name = torrentName(info, key);
            TorrentCreateRequest normalized = new TorrentCreateRequest(null, null, req.torrentBase64(), req.folder(), name, null);
            return new DownloadPreview(id, "torrent", name, key, "torrent:" + key, folder.toString(),
                    Math.max(0L, info.totalSize()), false, 1, null, normalized, Files.exists(folder.resolve(name)));
        }
        throw new IllegalArgumentException("magnet, torrentUrl or torrentBase64 required");
    }

    public DownloadView pause(String id) {
        DownloadEntity e = find(id);
        torrents.pause(e.getSource());
        e.setStatus(DownloadStatus.PAUSED);
        save(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public DownloadView resume(String id) {
        DownloadEntity e = find(id);
        torrents.resume(e.getSource());
        e.setStatus(DownloadStatus.DOWNLOADING);
        save(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public void remove(String id, boolean deleteFiles) {
        DownloadEntity e = find(id);
        if (repo.countByKindAndSourceIgnoreCaseAndIdNot(DownloadKind.TORRENT, e.getSource(), id) == 0L) {
            torrents.remove(e.getSource(), deleteFiles);
        }
        delete(id);
        progressBus.reset(id);
    }

    private void refresh() {
        try {
            for (DownloadEntity e : repo.findAllByOrderByCreatedAtDesc()) {
                if (e.getKind() != DownloadKind.TORRENT) continue;
                TorrentHandle handle = torrents.handle(e.getSource());
                if ((handle == null || !handle.isValid()) && e.getStatus() != DownloadStatus.COMPLETE && e.getStatus() != DownloadStatus.FAILED) {
                    restoreMissing(e);
                    handle = torrents.handle(e.getSource());
                }
                if (handle == null || !handle.isValid()) continue;
                TorrentStatus status = handle.status();
                long total = Math.max(0L, status.totalWanted());
                long done = Math.max(0L, status.totalWantedDone());
                long speed = Math.max(0L, status.downloadRate());
                if (status.name() != null && !status.name().isBlank()) e.setName(status.name());
                e.setSizeBytes(total);
                e.setDownloadedBytes(done);
                if (status.isFinished() || status.isSeeding()) {
                    e.setStatus(DownloadStatus.COMPLETE);
                    if (e.getCompletedAt() == null) e.setCompletedAt(Instant.now());
                } else if (e.getStatus() != DownloadStatus.PAUSED) {
                    e.setStatus(DownloadStatus.DOWNLOADING);
                }
                DownloadEntity saved = saveIfPresent(e);
                if (saved == null) continue;
                long eta = speed > 0 ? Math.max(0L, total - done) / speed : -1L;
                publish(saved, speed, eta);
            }
        } catch (Exception ignored) {
        }
    }

    private DownloadEntity find(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("torrent not found: " + id));
    }

    private DownloadEntity reusable(String source) {
        if (source == null || source.isBlank()) return null;
        return repo.findFirstByKindAndSourceIgnoreCaseOrderByCreatedAtDesc(DownloadKind.TORRENT, source)
                .filter(e -> e.getStatus() != DownloadStatus.FAILED)
                .orElse(null);
    }

    private void restoreMissing(DownloadEntity e) {
        if (e == null || e.getUrl() == null || !e.getUrl().regionMatches(true, 0, "magnet:", 0, 7)) return;
        try {
            if (torrents.handle(e.getSource()) != null) return;
            Path folder = resolveFolder(e.getFolder());
            String source = sourceKey(torrents.addMagnet(e.getUrl(), folder), e.getUrl());
            e.setSource(source);
            if (e.getStatus() == DownloadStatus.PAUSED) torrents.pause(source);
            save(e);
        } catch (Exception ignored) {
        }
    }

    private Path resolveFolder(String folder) throws Exception {
        String root = settings.get().getOrDefault("downloadRoot", System.getProperty("user.home") + "/Downloads/ODM");
        Path path = folder == null || folder.isBlank()
                ? pathFrom(root).resolve("Torrents")
                : pathFrom(folder);
        Files.createDirectories(path);
        return path.toRealPath();
    }

    private void prepareTarget(Path folder, String name, Boolean overwrite) throws Exception {
        Path target = folder.resolve(sanitizeName(name)).normalize();
        if (!target.startsWith(folder)) throw new IllegalArgumentException("target path is outside download folder");
        if (!Files.exists(target)) return;
        if (!Boolean.TRUE.equals(overwrite)) throw new IllegalArgumentException("target already exists");
        deleteTarget(target);
    }

    private void deleteTarget(Path target) throws IOException {
        if (Files.isDirectory(target)) {
            try (var stream = Files.walk(target)) {
                for (Path path : stream.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
            return;
        }
        Files.deleteIfExists(target);
    }

    private Path pathFrom(String value) {
        if ("~".equals(value)) return Paths.get(System.getProperty("user.home"));
        if (value.startsWith("~/") || value.startsWith("~\\")) {
            return Paths.get(System.getProperty("user.home"), value.substring(2));
        }
        return Paths.get(value);
    }

    private String sourceKey(String key, String fallback) {
        if (key != null && !key.isBlank()) return key.trim();
        return fallback == null ? "magnet" : fallback.trim();
    }

    private String normalizeRequiredMagnet(String magnet) {
        String normalized = TorrentSession.normalizeMagnet(magnet);
        if (normalized == null || normalized.isBlank()) throw new IllegalArgumentException("invalid magnet link");
        return normalized;
    }

    private String shortKey(String key) {
        if (key == null || key.isBlank()) return "download";
        return key.length() <= 12 ? key : key.substring(0, 12);
    }

    private String magnetDisplayName(String magnet, String key) {
        String dn = magnetParam(magnet, "dn");
        if (dn != null && !dn.isBlank()) return sanitizeName(dn);
        return "Magnet " + shortKey(key);
    }

    private String preferredName(String requested, String fallback) {
        if (requested != null && !requested.isBlank()) return sanitizeName(requested);
        return fallback;
    }

    private String torrentName(TorrentInfo info, String key) {
        String name = info.name();
        if (name != null && !name.isBlank()) return sanitizeName(name);
        return "Torrent " + shortKey(key);
    }

    private String magnetParam(String magnet, String name) {
        int q = magnet == null ? -1 : magnet.indexOf('?');
        if (q < 0 || q == magnet.length() - 1) return null;
        String prefix = name + "=";
        for (String part : magnet.substring(q + 1).split("&")) {
            if (!part.regionMatches(true, 0, prefix, 0, prefix.length())) continue;
            try {
                return URLDecoder.decode(part.substring(prefix.length()), StandardCharsets.UTF_8);
            } catch (Exception e) {
                return part.substring(prefix.length());
            }
        }
        return null;
    }

    private String sanitizeName(String name) {
        String value = name == null || name.isBlank() ? "torrent" : name.trim();
        value = value.replace('\\', '_').replace('/', '_').replace(':', '_');
        value = value.replaceAll("[\\x00-\\x1F\\x7F]", "_");
        return value.length() > 180 ? value.substring(0, 180) : value;
    }

    private byte[] downloadTorrentFile(URI uri) throws Exception {
        HttpClient client = HttpClientBuilder.build(settings.proxySettings(), null, null);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(Duration.ofMinutes(2))
                .header("Accept", "application/x-bittorrent,*/*")
                .build();
        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("HTTP " + response.statusCode() + " on " + uri);
        }
        long length = response.headers().firstValueAsLong("content-length").orElse(-1L);
        if (length > MAX_TORRENT_BYTES) throw new IOException("torrent file is too large");
        try (InputStream in = response.body(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            int total = 0;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > MAX_TORRENT_BYTES) throw new IOException("torrent file is too large");
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
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

    private void publish(DownloadEntity e, long speed, long eta) {
        progressBus.publish(new DownloadSnapshot(e.getId(), e.getKind(), e.getName(), e.getExt(), e.getUrl(),
                e.getSource(), e.getSizeBytes(), e.getDownloadedBytes(), speed, eta, e.getStatus(),
                e.getFolder(), e.getCreatedAt(), e.getCompletedAt(), e.getErrorMessage()));
    }
}
