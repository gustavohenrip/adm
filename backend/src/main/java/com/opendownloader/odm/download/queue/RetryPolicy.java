package com.opendownloader.odm.download.queue;

import java.util.concurrent.ThreadLocalRandom;

public final class RetryPolicy {

    private final int maxAttempts;
    private final long initialDelayMs;
    private final long maxDelayMs;

    public RetryPolicy(int maxAttempts, long initialDelayMs, long maxDelayMs) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.initialDelayMs = Math.max(0, initialDelayMs);
        this.maxDelayMs = Math.max(initialDelayMs, maxDelayMs);
    }

    public int maxAttempts() { return maxAttempts; }

    public long computeDelayMs(int attempt) {
        long exp = initialDelayMs << Math.min(attempt, 10);
        long capped = Math.min(maxDelayMs, exp);
        long jitter = ThreadLocalRandom.current().nextLong(capped / 2 + 1);
        return capped / 2 + jitter;
    }

    public <T> T execute(Callable<T> action) throws Exception {
        int attempt = 0;
        Exception last = null;
        while (attempt < maxAttempts) {
            try {
                return action.call();
            } catch (Exception e) {
                last = e;
                attempt++;
                if (attempt >= maxAttempts) break;
                long delay = computeDelayMs(attempt);
                try { Thread.sleep(delay); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw ie;
                }
            }
        }
        throw last;
    }

    @FunctionalInterface
    public interface Callable<T> {
        T call() throws Exception;
    }
}
