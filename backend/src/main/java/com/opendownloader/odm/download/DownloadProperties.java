package com.opendownloader.odm.download;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "odm.downloads")
public class DownloadProperties {
    private String root;
    private int defaultSegments = 8;
    private int maxSegments = 32;
    private Retry retry = new Retry();

    public String getRoot() { return root; }
    public void setRoot(String root) { this.root = root; }
    public int getDefaultSegments() { return defaultSegments; }
    public void setDefaultSegments(int defaultSegments) { this.defaultSegments = defaultSegments; }
    public int getMaxSegments() { return maxSegments; }
    public void setMaxSegments(int maxSegments) { this.maxSegments = maxSegments; }
    public Retry getRetry() { return retry; }
    public void setRetry(Retry retry) { this.retry = retry; }

    public static class Retry {
        private int maxAttempts = 5;
        private long initialDelayMs = 500;
        private long maxDelayMs = 30000;

        public int getMaxAttempts() { return maxAttempts; }
        public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
        public long getInitialDelayMs() { return initialDelayMs; }
        public void setInitialDelayMs(long initialDelayMs) { this.initialDelayMs = initialDelayMs; }
        public long getMaxDelayMs() { return maxDelayMs; }
        public void setMaxDelayMs(long maxDelayMs) { this.maxDelayMs = maxDelayMs; }
    }
}
