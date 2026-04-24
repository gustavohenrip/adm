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
    private static final int BUFFER_SIZE = 64 * 1024;

    private final String downloadId;
    private final HttpClient client;
    private final URI uri;
    private final Path target;
    private final SegmentManager manager;
    private final ProgressBus progressBus;
    private final AtomicBoolean stopFlag;
    private final RateLimiter rateLimiter;

    public RangeWorker(String downloadId, HttpClient client, URI uri, Path target,
                       SegmentManager manager, ProgressBus progressBus,
                       AtomicBoolean stopFlag, RateLimiter rateLimiter) {
        this.downloadId = downloadId;
        this.client = client;
        this.uri = uri;
        this.target = target;
        this.manager = manager;
        this.progressBus = progressBus;
        this.stopFlag = stopFlag;
        this.rateLimiter = rateLimiter;
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
        HttpRequest req = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(Duration.ofMinutes(10))
                .header("Range", "bytes=" + start + "-" + end)
                .build();

        HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (res.statusCode() != 206 && res.statusCode() / 100 != 2) {
            throw new RuntimeException("HTTP " + res.statusCode() + " on range " + start + "-" + end);
        }

        try (InputStream in = res.body();
             FileChannel ch = FileChannel.open(target,
                     StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.READ)) {
            byte[] buf = new byte[BUFFER_SIZE];
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
}
