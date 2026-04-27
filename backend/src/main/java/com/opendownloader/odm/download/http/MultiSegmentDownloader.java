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
import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.opendownloader.odm.download.ProgressBus;
import com.opendownloader.odm.download.queue.RateLimiter;

public final class MultiSegmentDownloader implements DownloadRunner {

    private static final Logger log = LoggerFactory.getLogger(MultiSegmentDownloader.class);
    private static final int MAX_SEGMENT_CAP = 64;
    private static final int DEFAULT_BUFFER_SIZE = 512 * 1024;
    private static final long DEFAULT_MIN_SPLIT = 64L * 1024L;

    private final String id;
    private final HttpClient client;
    private final URI uri;
    private final List<URI> mirrors;
    private final Path target;
    private final long totalSize;
    private final int segmentCount;
    private final int bufferSize;
    private final long minSplitBytes;
    private final ProgressBus progressBus;
    private final RateLimiter rateLimiter;
    private final HttpRequestHeaders headers;
    private final AtomicBoolean stopFlag = new AtomicBoolean(false);

    public MultiSegmentDownloader(String id, HttpClient client, URI uri, Path target,
                                  long totalSize, int segmentCount, ProgressBus bus, RateLimiter limiter) {
        this(id, client, uri, List.of(uri), target, totalSize, segmentCount,
                DEFAULT_BUFFER_SIZE, DEFAULT_MIN_SPLIT, bus, limiter, HttpRequestHeaders.emptyHeaders());
    }

    public MultiSegmentDownloader(String id, HttpClient client, URI uri, List<URI> mirrors, Path target,
                                  long totalSize, int segmentCount, int bufferSize, long minSplitBytes,
                                  ProgressBus bus, RateLimiter limiter) {
        this(id, client, uri, mirrors, target, totalSize, segmentCount, bufferSize, minSplitBytes, bus, limiter,
                HttpRequestHeaders.emptyHeaders());
    }

    public MultiSegmentDownloader(String id, HttpClient client, URI uri, List<URI> mirrors, Path target,
                                  long totalSize, int segmentCount, int bufferSize, long minSplitBytes,
                                  ProgressBus bus, RateLimiter limiter, HttpRequestHeaders headers) {
        this.id = id;
        this.client = client;
        this.uri = uri;
        this.mirrors = mirrors == null || mirrors.isEmpty() ? List.of(uri) : mirrors;
        this.target = target;
        this.totalSize = totalSize;
        this.segmentCount = clampSegments(segmentCount, totalSize);
        this.bufferSize = Math.max(8 * 1024, bufferSize);
        this.minSplitBytes = Math.max(4 * 1024L, minSplitBytes);
        this.progressBus = bus;
        this.rateLimiter = limiter;
        this.headers = headers == null ? HttpRequestHeaders.emptyHeaders() : headers;
    }

    public void stop() { stopFlag.set(true); }

    public void run() throws Exception {
        if (totalSize <= 0) {
            throw new IllegalStateException("Unknown content length; cannot segment");
        }
        preallocate();
        SegmentManager manager = new SegmentManager(totalSize, segmentCount, minSplitBytes);
        List<Segment> initial = manager.snapshot();
        AtomicInteger mirrorCursor = new AtomicInteger();

        ExecutorService pool = Executors.newFixedThreadPool(segmentCount);
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (Segment seg : initial) {
            RangeWorker worker = new RangeWorker(id, client, uri, target, manager, progressBus,
                    stopFlag, rateLimiter, bufferSize, mirrors, mirrorCursor, headers);
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

    private static int clampSegments(int requested, long totalSize) {
        int base = Math.max(1, Math.min(MAX_SEGMENT_CAP, requested));
        if (totalSize > 0) {
            int byCapacity = (int) Math.min(MAX_SEGMENT_CAP, Math.max(1L, totalSize / DEFAULT_MIN_SPLIT));
            return Math.min(base, byCapacity);
        }
        return base;
    }

    private void preallocate() throws Exception {
        java.nio.file.Files.createDirectories(target.getParent());
        try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(target.toFile(), "rw")) {
            if (raf.length() < totalSize) raf.setLength(totalSize);
        }
    }
}
