package com.opendownloader.odm.download.http;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.opendownloader.odm.download.ProgressBus;
import com.opendownloader.odm.download.queue.RateLimiter;

public final class RangeWorker implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(RangeWorker.class);
    private static final int DEFAULT_BUFFER_SIZE = 512 * 1024;

    private final String downloadId;
    private final HttpClient client;
    private final URI uri;
    private final Path target;
    private final SegmentManager manager;
    private final ProgressBus progressBus;
    private final AtomicBoolean stopFlag;
    private final RateLimiter rateLimiter;
    private final int bufferSize;
    private final java.util.List<URI> mirrors;
    private final java.util.concurrent.atomic.AtomicInteger mirrorCursor;
    private final HttpRequestHeaders headers;

    public RangeWorker(String downloadId, HttpClient client, URI uri, Path target,
                       SegmentManager manager, ProgressBus progressBus,
                       AtomicBoolean stopFlag, RateLimiter rateLimiter) {
        this(downloadId, client, uri, target, manager, progressBus, stopFlag, rateLimiter,
                DEFAULT_BUFFER_SIZE, java.util.List.of(uri), new java.util.concurrent.atomic.AtomicInteger(),
                HttpRequestHeaders.emptyHeaders());
    }

    public RangeWorker(String downloadId, HttpClient client, URI uri, Path target,
                       SegmentManager manager, ProgressBus progressBus,
                       AtomicBoolean stopFlag, RateLimiter rateLimiter,
                       int bufferSize, java.util.List<URI> mirrors,
                       java.util.concurrent.atomic.AtomicInteger mirrorCursor) {
        this(downloadId, client, uri, target, manager, progressBus, stopFlag, rateLimiter,
                bufferSize, mirrors, mirrorCursor, HttpRequestHeaders.emptyHeaders());
    }

    public RangeWorker(String downloadId, HttpClient client, URI uri, Path target,
                       SegmentManager manager, ProgressBus progressBus,
                       AtomicBoolean stopFlag, RateLimiter rateLimiter,
                       int bufferSize, java.util.List<URI> mirrors,
                       java.util.concurrent.atomic.AtomicInteger mirrorCursor,
                       HttpRequestHeaders headers) {
        this.downloadId = downloadId;
        this.client = client;
        this.uri = uri;
        this.target = target;
        this.manager = manager;
        this.progressBus = progressBus;
        this.stopFlag = stopFlag;
        this.rateLimiter = rateLimiter;
        this.bufferSize = Math.max(8 * 1024, bufferSize);
        this.mirrors = mirrors == null || mirrors.isEmpty() ? java.util.List.of(uri) : mirrors;
        this.mirrorCursor = mirrorCursor == null ? new java.util.concurrent.atomic.AtomicInteger() : mirrorCursor;
        this.headers = headers == null ? HttpRequestHeaders.emptyHeaders() : headers;
    }

    @Override
    public void run() {
        try {
            while (!stopFlag.get()) {
                Segment seg = manager.stealFromLargest();
                if (seg == null) return;
                processSegment(seg);
                if (manager.allCompleted()) return;
            }
        } catch (Exception e) {
            log.warn("range worker failed: {}", e.toString());
            throw new RuntimeException(e);
        }
    }

    public void processAssigned(Segment seg) throws Exception {
        processSegment(seg);
    }

    private void processSegment(Segment seg) throws Exception {
        long start = seg.cursor();
        long end = seg.end();
        if (start > end) {
            seg.markComplete();
            return;
        }
        URI source = pickMirror();
        HttpRequest.Builder builder = HttpRequest.newBuilder(source)
                .GET()
                .timeout(Duration.ofMinutes(10))
                .header("Range", "bytes=" + start + "-" + end);
        headers.apply(builder);

        HttpResponse<InputStream> res = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        if (res.statusCode() != 206 && res.statusCode() / 100 != 2) {
            throw new RuntimeException("HTTP " + res.statusCode() + " on range " + start + "-" + end);
        }

        try (InputStream in = res.body();
             FileChannel ch = FileChannel.open(target,
                     StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.READ)) {
            byte[] buf = new byte[bufferSize];
            long position = start;
            int read;
            while (!stopFlag.get() && position <= seg.end() && (read = in.read(buf)) != -1) {
                long remaining = seg.end() - position + 1;
                int toWrite = (int) Math.min(read, remaining);
                if (rateLimiter != null) rateLimiter.acquire(toWrite);
                ch.write(ByteBuffer.wrap(buf, 0, toWrite), position);
                position += toWrite;
                seg.advance(toWrite);
                progressBus.report(downloadId, toWrite);
                if (toWrite < read) break;
            }
            ch.force(false);
        }
    }

    private URI pickMirror() {
        if (mirrors.size() == 1) return mirrors.get(0);
        int idx = Math.floorMod(mirrorCursor.getAndIncrement(), mirrors.size());
        return mirrors.get(idx);
    }
}
