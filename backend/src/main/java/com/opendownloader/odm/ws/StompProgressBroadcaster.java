package com.opendownloader.odm.ws;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.opendownloader.odm.download.DownloadSnapshot;
import com.opendownloader.odm.download.ProgressBus;

@Component
public class StompProgressBroadcaster {

    private static final String TOPIC = "/topic/progress";
    private static final long INTERVAL_MS = 250;

    private final SimpMessagingTemplate template;
    private final ProgressBus progressBus;
    private final ConcurrentMap<String, DownloadSnapshot> buffer = new ConcurrentHashMap<>();
    private final ScheduledExecutorService executor =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "odm-progress-broadcaster");
                t.setDaemon(true);
                return t;
            });

    public StompProgressBroadcaster(SimpMessagingTemplate template, ProgressBus progressBus) {
        this.template = template;
        this.progressBus = progressBus;
    }

    @PostConstruct
    public void start() {
        progressBus.setSink(this::enqueue);
        executor.scheduleWithFixedDelay(this::tick, INTERVAL_MS, INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            flush();
        } catch (Throwable ignored) {
        }
    }

    @PreDestroy
    public void stop() {
        executor.shutdownNow();
    }

    public void enqueue(DownloadSnapshot snapshot) {
        buffer.put(snapshot.id(), snapshot);
    }

    private void flush() {
        if (buffer.isEmpty()) return;
        List<DownloadSnapshot> batch = new ArrayList<>(buffer.values());
        buffer.clear();
        try {
            template.convertAndSend(TOPIC, batch);
        } catch (Exception ignored) {
        }
    }
}
