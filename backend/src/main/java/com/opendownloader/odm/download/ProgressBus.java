package com.opendownloader.odm.download;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

@Component
public class ProgressBus {

    private final ConcurrentMap<String, Sample> samples = new ConcurrentHashMap<>();
    private volatile Consumer<DownloadSnapshot> sink = snapshot -> { };

    public void setSink(Consumer<DownloadSnapshot> sink) {
        this.sink = sink == null ? s -> { } : sink;
    }

    public void report(String id, long bytesDelta) {
        Sample s = samples.computeIfAbsent(id, k -> new Sample());
        s.downloaded.addAndGet(bytesDelta);
        s.recordTick(bytesDelta);
    }

    public void publish(DownloadSnapshot snapshot) {
        sink.accept(snapshot);
    }

    public long downloaded(String id) {
        Sample s = samples.get(id);
        return s == null ? 0L : s.downloaded.get();
    }

    public long speedBps(String id) {
        Sample s = samples.get(id);
        return s == null ? 0L : s.currentSpeed();
    }

    public void reset(String id) {
        samples.remove(id);
    }

    public void seed(String id, long bytes) {
        Sample s = samples.computeIfAbsent(id, k -> new Sample());
        s.downloaded.set(bytes);
    }

    private static final class Sample {
        private static final long WINDOW_NANOS = 1_000_000_000L;
        private final AtomicLong downloaded = new AtomicLong();
        private volatile long windowStart = System.nanoTime();
        private final AtomicLong windowBytes = new AtomicLong();
        private volatile long lastSpeed = 0L;

        void recordTick(long delta) {
            long now = System.nanoTime();
            long start = windowStart;
            long elapsed = now - start;
            windowBytes.addAndGet(delta);
            if (elapsed >= WINDOW_NANOS) {
                long bytes = windowBytes.getAndSet(0);
                lastSpeed = (long) ((double) bytes * 1_000_000_000.0 / (double) elapsed);
                windowStart = now;
            }
        }

        long currentSpeed() {
            long now = System.nanoTime();
            long elapsed = now - windowStart;
            if (elapsed < WINDOW_NANOS) return lastSpeed;
            long bytes = windowBytes.get();
            if (elapsed <= 0) return lastSpeed;
            return (long) ((double) bytes * 1_000_000_000.0 / (double) elapsed);
        }
    }
}
