package com.opendownloader.odm.download.http;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.opendownloader.odm.download.ProgressBus;
import com.opendownloader.odm.download.queue.RateLimiter;

public final class MultiSegmentDownloader {

    private static final Logger log = LoggerFactory.getLogger(MultiSegmentDownloader.class);

    private final String id;
    private final HttpClient client;
    private final URI uri;
    private final Path target;
    private final long totalSize;
    private final int segmentCount;
    private final ProgressBus progressBus;
    private final RateLimiter rateLimiter;
    private final AtomicBoolean stopFlag = new AtomicBoolean(false);

    public MultiSegmentDownloader(String id, HttpClient client, URI uri, Path target,
                                  long totalSize, int segmentCount, ProgressBus bus, RateLimiter limiter) {
        this.id = id;
        this.client = client;
        this.uri = uri;
        this.target = target;
        this.totalSize = totalSize;
        this.segmentCount = Math.max(1, Math.min(32, segmentCount));
        this.progressBus = bus;
        this.rateLimiter = limiter;
    }

    public void stop() { stopFlag.set(true); }

    public void run() throws Exception {
        if (totalSize <= 0) {
            throw new IllegalStateException("Unknown content length; cannot segment");
        }
        preallocate();
        SegmentManager manager = new SegmentManager(totalSize, segmentCount, 256L * 1024L);
        List<Segment> initial = manager.snapshot();

        ExecutorService pool = Executors.newFixedThreadPool(segmentCount);
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (Segment seg : initial) {
            RangeWorker worker = new RangeWorker(id, client, uri, target, manager, progressBus, stopFlag, rateLimiter);
            CompletableFuture<Void> f = CompletableFuture.runAsync(() -> {
                try {
                    worker.processAssigned(seg);
                    while (!stopFlag.get() && !manager.allCompleted()) {
                        Segment stolen = manager.stealFromLargest();
                        if (stolen == null) break;
                        worker.processAssigned(stolen);
                    }
                } catch (Exception e) {
                    log.error("worker failed", e);
                    throw new RuntimeException(e);
                }
            }, pool);
            futures.add(f);
        }

        try {
            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
        } finally {
            pool.shutdown();
        }
    }

    private void preallocate() throws Exception {
        java.nio.file.Files.createDirectories(target.getParent());
        try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(target.toFile(), "rw")) {
            if (raf.length() < totalSize) raf.setLength(totalSize);
        }
    }
}
