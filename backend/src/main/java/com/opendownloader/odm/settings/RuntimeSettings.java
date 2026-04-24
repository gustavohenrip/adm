package com.opendownloader.odm.settings;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import jakarta.annotation.PostConstruct;

import org.springframework.stereotype.Service;

import com.opendownloader.odm.download.DownloadProperties;
import com.opendownloader.odm.download.http.ProxySettings;
import com.opendownloader.odm.download.queue.RateLimiter;
import com.opendownloader.odm.download.torrent.TorrentProperties;
import com.opendownloader.odm.download.torrent.TorrentSession;
import com.opendownloader.odm.persistence.SettingEntity;
import com.opendownloader.odm.persistence.SettingRepository;

@Service
public class RuntimeSettings {

    private static final Set<String> ALLOWED = Set.of(
            "downloadRoot",
            "defaultSegments",
            "maxSegments",
            "rateLimitKbps",
            "proxyKind",
            "proxyHost",
            "proxyPort",
            "torrentEnabled",
            "dhtEnabled",
            "lsdEnabled",
            "listenPort",
            "clipboardWatch",
            "trayEnabled",
            "autoUpdate"
    );

    private final SettingRepository repo;
    private final DownloadProperties downloads;
    private final TorrentProperties torrents;
    private final TorrentSession torrentSession;
    private final RateLimiter rateLimiter;

    public RuntimeSettings(SettingRepository repo, DownloadProperties downloads, TorrentProperties torrents,
                           TorrentSession torrentSession, RateLimiter rateLimiter) {
        this.repo = repo;
        this.downloads = downloads;
        this.torrents = torrents;
        this.torrentSession = torrentSession;
        this.rateLimiter = rateLimiter;
    }

    @PostConstruct
    public void start() {
        apply(get());
    }

    public Map<String, String> get() {
        Map<String, String> values = defaults();
        for (SettingEntity e : repo.findAll()) {
            if (ALLOWED.contains(e.getKey()) && e.getValue() != null) {
                values.put(e.getKey(), e.getValue());
            }
        }
        return normalize(values);
    }

    public Map<String, String> save(Map<String, String> body) {
        if (body == null) return get();
        Map<String, String> next = new HashMap<>();
        for (Map.Entry<String, String> entry : body.entrySet()) {
            if (ALLOWED.contains(entry.getKey())) {
                next.put(entry.getKey(), entry.getValue());
            }
        }
        next = normalize(next);
        for (Map.Entry<String, String> entry : next.entrySet()) {
            SettingEntity e = repo.findById(entry.getKey()).orElseGet(() -> {
                SettingEntity fresh = new SettingEntity();
                fresh.setKey(entry.getKey());
                return fresh;
            });
            e.setValue(entry.getValue());
            repo.save(e);
        }
        Map<String, String> applied = get();
        apply(applied);
        return applied;
    }

    public ProxySettings proxySettings() {
        Map<String, String> values = get();
        ProxySettings.Kind kind = proxyKind(values.get("proxyKind"));
        String host = values.getOrDefault("proxyHost", "");
        int port = parseInt(values.get("proxyPort"), 0, 0, 65535);
        if (kind == ProxySettings.Kind.NONE || host.isBlank() || port <= 0) return ProxySettings.none();
        return new ProxySettings(kind, host, port);
    }

    private void apply(Map<String, String> values) {
        int maxSegments = parseInt(values.get("maxSegments"), downloads.getMaxSegments(), 1, 32);
        boolean torrentChanged = torrents.isEnabled() != parseBoolean(values.get("torrentEnabled"), torrents.isEnabled())
                || torrents.isDhtEnabled() != parseBoolean(values.get("dhtEnabled"), torrents.isDhtEnabled())
                || torrents.isLsdEnabled() != parseBoolean(values.get("lsdEnabled"), torrents.isLsdEnabled())
                || torrents.getListenPort() != parseInt(values.get("listenPort"), torrents.getListenPort(), 0, 65535);
        downloads.setRoot(values.get("downloadRoot"));
        downloads.setMaxSegments(maxSegments);
        downloads.setDefaultSegments(parseInt(values.get("defaultSegments"), downloads.getDefaultSegments(), 1, maxSegments));
        rateLimiter.setLimit(parseLong(values.get("rateLimitKbps"), 0L, 0L, 10_000_000L) * 1024L);
        torrents.setEnabled(parseBoolean(values.get("torrentEnabled"), torrents.isEnabled()));
        torrents.setDhtEnabled(parseBoolean(values.get("dhtEnabled"), torrents.isDhtEnabled()));
        torrents.setLsdEnabled(parseBoolean(values.get("lsdEnabled"), torrents.isLsdEnabled()));
        torrents.setListenPort(parseInt(values.get("listenPort"), torrents.getListenPort(), 0, 65535));
        if (torrentChanged) torrentSession.configure();
    }

    private Map<String, String> defaults() {
        Map<String, String> values = new HashMap<>();
        values.put("downloadRoot", downloads.getRoot());
        values.put("defaultSegments", Integer.toString(downloads.getDefaultSegments()));
        values.put("maxSegments", Integer.toString(downloads.getMaxSegments()));
        values.put("rateLimitKbps", Long.toString(rateLimiter.limit() / 1024L));
        values.put("proxyKind", "NONE");
        values.put("proxyHost", "");
        values.put("proxyPort", "0");
        values.put("torrentEnabled", Boolean.toString(torrents.isEnabled()));
        values.put("dhtEnabled", Boolean.toString(torrents.isDhtEnabled()));
        values.put("lsdEnabled", Boolean.toString(torrents.isLsdEnabled()));
        values.put("listenPort", Integer.toString(torrents.getListenPort()));
        values.put("clipboardWatch", "true");
        values.put("trayEnabled", "true");
        values.put("autoUpdate", "true");
        return values;
    }

    private Map<String, String> normalize(Map<String, String> input) {
        Map<String, String> base = defaults();
        if (input != null) base.putAll(input);
        Map<String, String> defaultValues = defaults();
        Map<String, String> values = new HashMap<>();
        values.put("downloadRoot", stringValue(base.get("downloadRoot"), defaultValues.get("downloadRoot")));
        int maxSegments = parseInt(base.get("maxSegments"), downloads.getMaxSegments(), 1, 32);
        values.put("maxSegments", Integer.toString(maxSegments));
        values.put("defaultSegments", Integer.toString(parseInt(base.get("defaultSegments"), downloads.getDefaultSegments(), 1, maxSegments)));
        values.put("rateLimitKbps", Long.toString(parseLong(base.get("rateLimitKbps"), 0L, 0L, 10_000_000L)));
        values.put("proxyKind", proxyKind(base.get("proxyKind")).name());
        values.put("proxyHost", stringValue(base.get("proxyHost"), ""));
        values.put("proxyPort", Integer.toString(parseInt(base.get("proxyPort"), 0, 0, 65535)));
        values.put("torrentEnabled", Boolean.toString(parseBoolean(base.get("torrentEnabled"), torrents.isEnabled())));
        values.put("dhtEnabled", Boolean.toString(parseBoolean(base.get("dhtEnabled"), torrents.isDhtEnabled())));
        values.put("lsdEnabled", Boolean.toString(parseBoolean(base.get("lsdEnabled"), torrents.isLsdEnabled())));
        values.put("listenPort", Integer.toString(parseInt(base.get("listenPort"), torrents.getListenPort(), 0, 65535)));
        values.put("clipboardWatch", Boolean.toString(parseBoolean(base.get("clipboardWatch"), true)));
        values.put("trayEnabled", Boolean.toString(parseBoolean(base.get("trayEnabled"), true)));
        values.put("autoUpdate", Boolean.toString(parseBoolean(base.get("autoUpdate"), true)));
        Set<String> missing = new HashSet<>(ALLOWED);
        missing.removeAll(values.keySet());
        for (String key : missing) values.put(key, base.getOrDefault(key, ""));
        return values;
    }

    private ProxySettings.Kind proxyKind(String value) {
        try {
            return ProxySettings.Kind.valueOf(stringValue(value, "NONE").toUpperCase());
        } catch (Exception e) {
            return ProxySettings.Kind.NONE;
        }
    }

    private String stringValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private boolean parseBoolean(String value, boolean fallback) {
        if (value == null) return fallback;
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        return fallback;
    }

    private int parseInt(String value, int fallback, int min, int max) {
        try {
            return Math.max(min, Math.min(max, Integer.parseInt(value)));
        } catch (Exception e) {
            return Math.max(min, Math.min(max, fallback));
        }
    }

    private long parseLong(String value, long fallback, long min, long max) {
        try {
            return Math.max(min, Math.min(max, Long.parseLong(value)));
        } catch (Exception e) {
            return Math.max(min, Math.min(max, fallback));
        }
    }
}
