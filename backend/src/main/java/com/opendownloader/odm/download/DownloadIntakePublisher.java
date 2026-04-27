package com.opendownloader.odm.download;

import java.util.List;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class DownloadIntakePublisher {

    private static final String TOPIC = "/topic/intake";
    private static final long RECENT_MS = 45_000L;

    private final SimpMessagingTemplate template;
    private final ConcurrentLinkedQueue<DownloadPreview> pending = new ConcurrentLinkedQueue<>();
    private final ConcurrentHashMap<String, Long> recent = new ConcurrentHashMap<>();

    public DownloadIntakePublisher(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void publish(DownloadPreview preview) {
        if (preview == null) return;
        String key = key(preview);
        long now = System.currentTimeMillis();
        prune(now);
        Long previous = recent.put(key, now);
        if (previous != null && now - previous < RECENT_MS) return;
        pending.add(preview);
        template.convertAndSend(TOPIC, List.of(preview));
    }

    public List<DownloadPreview> drain() {
        List<DownloadPreview> items = new ArrayList<>();
        DownloadPreview item;
        while ((item = pending.poll()) != null) items.add(item);
        return items;
    }

    private String key(DownloadPreview preview) {
        String kind = preview.kind() == null ? "" : preview.kind().toLowerCase(Locale.ROOT);
        String source = preview.source() == null ? "" : preview.source().trim().toLowerCase(Locale.ROOT);
        if (!source.isBlank() && !"magnet".equals(source)) return kind + ":" + source;
        String url = preview.url() == null ? "" : preview.url().trim().toLowerCase(Locale.ROOT);
        if (!url.isBlank()) return kind + ":" + url;
        return preview.id() == null ? "" : preview.id();
    }

    private void prune(long now) {
        for (var entry : recent.entrySet()) {
            if (now - entry.getValue() > RECENT_MS) recent.remove(entry.getKey(), entry.getValue());
        }
    }
}
