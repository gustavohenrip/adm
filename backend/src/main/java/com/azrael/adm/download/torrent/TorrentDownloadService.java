package com.azrael.adm.download.torrent;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Service;

import com.azrael.adm.download.DownloadKind;
import com.azrael.adm.download.DownloadSnapshot;
import com.azrael.adm.download.DownloadStatus;
import com.azrael.adm.download.DownloadView;
import com.azrael.adm.download.ProgressBus;
import com.azrael.adm.persistence.DownloadEntity;
import com.azrael.adm.persistence.DownloadRepository;
import com.frostwire.jlibtorrent.TorrentHandle;
import com.frostwire.jlibtorrent.TorrentStatus;

@Service
public class TorrentDownloadService {

    private final TorrentSession torrents;
    private final DownloadRepository repo;
    private final ProgressBus progressBus;
    private final ScheduledExecutorService monitor = Executors.newSingleThreadScheduledExecutor();

    public TorrentDownloadService(TorrentSession torrents, DownloadRepository repo, ProgressBus progressBus) {
        this.torrents = torrents;
        this.repo = repo;
        this.progressBus = progressBus;
    }

    @PostConstruct
    public void start() {
        monitor.scheduleAtFixedRate(this::refresh, 1000, 1000, TimeUnit.MILLISECONDS);
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
            url = req.magnet().trim();
            key = torrents.addMagnet(url, folder);
            name = "Magnet " + shortKey(key);
        } else if (req != null && req.torrentBase64() != null && !req.torrentBase64().isBlank()) {
            byte[] bytes = Base64.getDecoder().decode(req.torrentBase64());
            key = torrents.addTorrentFile(bytes, folder);
            url = "torrent:" + key;
            name = "Torrent " + shortKey(key);
        } else {
            throw new IllegalArgumentException("magnet or torrentBase64 required");
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
        repo.saveAndFlush(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public DownloadView pause(String id) {
        DownloadEntity e = find(id);
        torrents.pause(e.getSource());
        e.setStatus(DownloadStatus.PAUSED);
        repo.save(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public DownloadView resume(String id) {
        DownloadEntity e = find(id);
        torrents.resume(e.getSource());
        e.setStatus(DownloadStatus.DOWNLOADING);
        repo.save(e);
        publish(e, 0L, -1L);
        return DownloadView.from(e, 0L);
    }

    public void remove(String id, boolean deleteFiles) {
        DownloadEntity e = find(id);
        torrents.remove(e.getSource(), deleteFiles);
        repo.deleteById(id);
        progressBus.reset(id);
    }

    private void refresh() {
        try {
            for (DownloadEntity e : repo.findAllByOrderByCreatedAtDesc()) {
                if (e.getKind() != DownloadKind.TORRENT) continue;
                TorrentHandle handle = torrents.handle(e.getSource());
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
                repo.save(e);
                long eta = speed > 0 ? Math.max(0L, total - done) / speed : -1L;
                publish(e, speed, eta);
            }
        } catch (Exception ignored) {
        }
    }

    private DownloadEntity find(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("torrent not found: " + id));
    }

    private Path resolveFolder(String folder) throws Exception {
        Path path = folder == null || folder.isBlank()
                ? Paths.get(System.getProperty("user.home"), "Downloads", "ADM", "Torrents")
                : Paths.get(folder);
        Files.createDirectories(path);
        return path.toRealPath();
    }

    private String shortKey(String key) {
        if (key == null || key.isBlank()) return "download";
        return key.length() <= 12 ? key : key.substring(0, 12);
    }

    private void publish(DownloadEntity e, long speed, long eta) {
        progressBus.publish(new DownloadSnapshot(e.getId(), e.getKind(), e.getName(), e.getExt(), e.getUrl(),
                e.getSource(), e.getSizeBytes(), e.getDownloadedBytes(), speed, eta, e.getStatus(),
                e.getFolder(), e.getCreatedAt(), e.getCompletedAt(), e.getErrorMessage()));
    }
}
