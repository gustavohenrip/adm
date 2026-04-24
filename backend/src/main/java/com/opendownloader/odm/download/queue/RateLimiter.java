package com.opendownloader.odm.download.queue;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

@Component
public class RateLimiter {

    private final AtomicLong capacityBps = new AtomicLong(0);
    private final AtomicLong tokens = new AtomicLong(0);
    private volatile long lastRefillNanos = System.nanoTime();

    public void setLimit(long bytesPerSecond) {
        capacityBps.set(Math.max(0, bytesPerSecond));
    }

    public long limit() {
        return capacityBps.get();
    }

    public void acquire(int bytes) throws InterruptedException {
        long cap = capacityBps.get();
        if (cap <= 0) return;
        while (true) {
            refill(cap);
            long current = tokens.get();
            if (current >= bytes) {
                if (tokens.compareAndSet(current, current - bytes)) return;
            } else {
                long deficit = bytes - current;
                long waitMillis = Math.max(1, (deficit * 1000L) / cap);
                Thread.sleep(Math.min(waitMillis, 500));
            }
        }
    }

    private void refill(long capacity) {
        long now = System.nanoTime();
        long elapsed = now - lastRefillNanos;
        if (elapsed <= 0) return;
        long add = (long) (capacity * (elapsed / 1_000_000_000.0));
        if (add <= 0) return;
        lastRefillNanos = now;
        long updated = Math.min(capacity, tokens.get() + add);
        tokens.set(updated);
    }
}
