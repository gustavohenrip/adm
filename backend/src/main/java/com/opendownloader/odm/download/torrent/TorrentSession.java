package com.opendownloader.odm.download.torrent;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import com.frostwire.jlibtorrent.AlertListener;
import com.frostwire.jlibtorrent.SessionManager;
import com.frostwire.jlibtorrent.SessionParams;
import com.frostwire.jlibtorrent.SettingsPack;
import com.frostwire.jlibtorrent.TorrentFlags;
import com.frostwire.jlibtorrent.TorrentHandle;
import com.frostwire.jlibtorrent.TorrentInfo;
import com.frostwire.jlibtorrent.alerts.Alert;
import com.frostwire.jlibtorrent.alerts.AlertType;
import com.frostwire.jlibtorrent.alerts.TorrentAlert;
import com.frostwire.jlibtorrent.swig.session_handle;

@Component
@EnableConfigurationProperties(TorrentProperties.class)
public class TorrentSession {

    private static final Logger log = LoggerFactory.getLogger(TorrentSession.class);
    private static final Pattern BTIH = Pattern.compile("xt=urn:btih:([^&]+)", Pattern.CASE_INSENSITIVE);

    private final TorrentProperties props;
    private SessionManager manager;
    private final ConcurrentMap<String, String> handleIds = new ConcurrentHashMap<>();

    public TorrentSession(TorrentProperties props) {
        this.props = props;
    }

    @PostConstruct
    public synchronized void start() {
        startManager();
    }

    public synchronized void configure() {
        stopManager();
        startManager();
    }

    private void startManager() {
        if (!props.isEnabled()) {
            log.info("torrent disabled by config");
            return;
        }
        try {
            manager = new SessionManager();
            SettingsPack pack = new SettingsPack();
            pack.setEnableDht(props.isDhtEnabled());
            pack.setEnableLsd(props.isLsdEnabled());
            if (props.getListenPort() > 0) {
                pack.setString(
                    com.frostwire.jlibtorrent.swig.settings_pack.string_types.listen_interfaces.swigValue(),
                    "0.0.0.0:" + props.getListenPort()
                );
            }
            manager.start(new SessionParams(pack));
            manager.addListener(new AlertListener() {
                @Override public int[] types() { return null; }
                @Override public void alert(Alert<?> alert) { handleAlert(alert); }
            });
            log.info("torrent session started");
        } catch (Throwable t) {
            log.error("failed to start torrent session", t);
            manager = null;
        }
    }

    @PreDestroy
    public synchronized void stop() {
        stopManager();
    }

    private void stopManager() {
        if (manager != null) {
            try { manager.stop(); } catch (Throwable ignored) { }
            manager = null;
        }
    }

    public String addMagnet(String magnet, Path savePath) {
        Objects.requireNonNull(manager, "torrent session unavailable");
        manager.download(magnet, savePath.toFile(), TorrentFlags.AUTO_MANAGED);
        String key = magnetKey(magnet);
        return key == null ? magnet : key;
    }

    public String addTorrentFile(byte[] torrentBytes, Path savePath) throws Exception {
        Objects.requireNonNull(manager, "torrent session unavailable");
        Path tmp = Files.createTempFile("odm-", ".torrent");
        Files.write(tmp, torrentBytes);
        try {
            TorrentInfo info = new TorrentInfo(tmp.toFile());
            File dir = savePath.toFile();
            if (!dir.exists()) dir.mkdirs();
            manager.download(info, dir);
            return info.infoHashV1().toHex();
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    public void pause(String infoHash) {
        TorrentHandle h = findHandle(infoHash);
        if (h != null) h.pause();
    }

    public void resume(String infoHash) {
        TorrentHandle h = findHandle(infoHash);
        if (h != null) h.resume();
    }

    public void remove(String infoHash, boolean deleteFiles) {
        if (manager == null) return;
        TorrentHandle h = findHandle(infoHash);
        if (h == null) return;
        if (deleteFiles) {
            manager.remove(h, session_handle.delete_files);
        } else {
            manager.remove(h);
        }
    }

    private TorrentHandle findHandle(String infoHash) {
        if (manager == null) return null;
        for (TorrentHandle h : manager.getTorrentHandles()) {
            if (matches(h, infoHash)) return h;
        }
        return null;
    }

    public TorrentHandle handle(String key) {
        return findHandle(key);
    }

    public static String magnetKey(String magnet) {
        if (magnet == null) return null;
        Matcher matcher = BTIH.matcher(magnet);
        return matcher.find() ? matcher.group(1) : null;
    }

    private boolean matches(TorrentHandle h, String key) {
        if (key == null || key.isBlank()) return false;
        String normalized = key.trim();
        try {
            if (h.infoHash().toHex().equalsIgnoreCase(normalized)) return true;
        } catch (Exception ignored) {
        }
        try {
            if (h.status().infoHashV1().toHex().equalsIgnoreCase(normalized)) return true;
        } catch (Exception ignored) {
        }
        try {
            return h.makeMagnetUri().toLowerCase().contains(normalized.toLowerCase());
        } catch (Exception ignored) {
            return false;
        }
    }

    private void handleAlert(Alert<?> alert) {
        if (!(alert instanceof TorrentAlert<?> ta)) return;
        AlertType type = alert.type();
        if (type == AlertType.TORRENT_FINISHED || type == AlertType.SESSION_STATS) {
            log.debug("torrent alert {} for {}", type, ta.torrentName());
        }
    }

    public boolean available() {
        return props.isEnabled() && manager != null;
    }

    public static String toBase64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }
}
