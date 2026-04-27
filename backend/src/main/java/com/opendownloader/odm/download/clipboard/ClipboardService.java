package com.opendownloader.odm.download.clipboard;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

import com.opendownloader.odm.settings.RuntimeSettings;
import com.opendownloader.odm.ws.SystemEventsBroadcaster;

@Service
public class ClipboardService {

    private static final long DEDUP_WINDOW_MS = 5_000L;

    private final RuntimeSettings settings;
    private final SystemEventsBroadcaster events;
    private final ConcurrentMap<String, Long> recent = new ConcurrentHashMap<>();

    public ClipboardService(RuntimeSettings settings, SystemEventsBroadcaster events) {
        this.settings = settings;
        this.events = events;
    }

    public void capture(String url) {
        if (url == null || url.isBlank()) return;
        if (!"true".equalsIgnoreCase(settings.get().getOrDefault("clipboardWatch", "true"))) return;
        long now = Instant.now().toEpochMilli();
        Long last = recent.put(url, now);
        if (last != null && now - last < DEDUP_WINDOW_MS) return;
        prune(now);
        events.emit("clipboard.url", Map.of("url", url, "at", now));
    }

    private void prune(long now) {
        recent.entrySet().removeIf(entry -> now - entry.getValue() > DEDUP_WINDOW_MS * 4);
    }
}
