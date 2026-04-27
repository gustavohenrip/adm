package com.opendownloader.odm.download;

import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentLinkedQueue;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class DownloadIntakePublisher {

    private static final String TOPIC = "/topic/intake";

    private final SimpMessagingTemplate template;
    private final ConcurrentLinkedQueue<DownloadPreview> pending = new ConcurrentLinkedQueue<>();

    public DownloadIntakePublisher(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void publish(DownloadPreview preview) {
        pending.add(preview);
        template.convertAndSend(TOPIC, List.of(preview));
    }

    public List<DownloadPreview> drain() {
        List<DownloadPreview> items = new ArrayList<>();
        DownloadPreview item;
        while ((item = pending.poll()) != null) items.add(item);
        return items;
    }
}
