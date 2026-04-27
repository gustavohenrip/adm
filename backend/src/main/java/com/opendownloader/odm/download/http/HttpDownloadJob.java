package com.opendownloader.odm.download.http;

import java.io.IOException;
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

public final class HttpDownloadJob implements DownloadRunner {

    private static final Logger log = LoggerFactory.getLogger(HttpDownloadJob.class);
    private static final int DEFAULT_BUFFER_SIZE = 512 * 1024;

    private final String id;
    private final HttpClient client;
    private final URI uri;
    private final Path target;
    private final long totalSize;
    private final boolean acceptsRanges;
    private final ProgressBus progressBus;
    private final RateLimiter rateLimiter;
    private final int bufferSize;
    private final HttpRequestHeaders headers;
    private final AtomicBoolean stopFlag = new AtomicBoolean(false);

    public HttpDownloadJob(String id, HttpClient client, URI uri, Path target,
                           long totalSize, boolean acceptsRanges, ProgressBus bus, RateLimiter rateLimiter) {
        this(id, client, uri, target, totalSize, acceptsRanges, bus, rateLimiter, DEFAULT_BUFFER_SIZE,
                HttpRequestHeaders.emptyHeaders());
    }

    public HttpDownloadJob(String id, HttpClient client, URI uri, Path target,
                           long totalSize, boolean acceptsRanges, ProgressBus bus, RateLimiter rateLimiter,
                           int bufferSize) {
        this(id, client, uri, target, totalSize, acceptsRanges, bus, rateLimiter, bufferSize,
                HttpRequestHeaders.emptyHeaders());
    }

    public HttpDownloadJob(String id, HttpClient client, URI uri, Path target,
                           long totalSize, boolean acceptsRanges, ProgressBus bus, RateLimiter rateLimiter,
                           int bufferSize, HttpRequestHeaders headers) {
        this.id = id;
        this.client = client;
        this.uri = uri;
        this.target = target;
        this.totalSize = totalSize;
        this.acceptsRanges = acceptsRanges;
        this.progressBus = bus;
        this.rateLimiter = rateLimiter;
        this.bufferSize = Math.max(8 * 1024, bufferSize);
        this.headers = headers == null ? HttpRequestHeaders.emptyHeaders() : headers;
    }

    public void stop() {
        stopFlag.set(true);
    }

    public void run() throws Exception {
        long existing = resumeOffset();
        if (existing > 0 && !acceptsRanges) {
            existing = 0;
        }
        if (totalSize > 0 && existing >= totalSize) {
            return;
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(Duration.ofMinutes(10));
        headers.apply(builder);
        if (existing > 0 && acceptsRanges) {
            builder.header("Range", "bytes=" + existing + "-");
        }

        HttpResponse<InputStream> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        int status = response.statusCode();
        if (status / 100 != 2) {
            throw new IOException("HTTP " + status + " on " + uri);
        }
        if (existing > 0 && status != 206) {
            existing = 0;
        }

        progressBus.seed(id, existing);

        try (InputStream in = response.body();
             FileChannel channel = FileChannel.open(target,
                     StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.READ)) {
            channel.truncate(existing);
            channel.position(existing);
            byte[] buf = new byte[bufferSize];
            long written = existing;
            int read;
            while (!stopFlag.get() && (read = in.read(buf)) != -1) {
                rateLimiter.acquire(read);
                channel.write(ByteBuffer.wrap(buf, 0, read));
                written += read;
                progressBus.report(id, read);
            }
            if (stopFlag.get()) {
                log.debug("download {} paused at {}", id, written);
                return;
            }
            channel.force(false);
        }
    }

    private long resumeOffset() {
        try {
            return java.nio.file.Files.exists(target) ? java.nio.file.Files.size(target) : 0L;
        } catch (IOException e) {
            return 0L;
        }
    }
}
