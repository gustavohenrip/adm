package com.opendownloader.odm.download;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "odm.downloads")
public class DownloadProperties {
    private String root;
    private int defaultSegments = 16;
    private int maxSegments = 64;
    private int bufferBytes = 524288;
    private long minSplitBytes = 65536L;
    private boolean dnsPrefetch = true;
    private boolean tcpPrewarm = true;
    private boolean dynamicChunkSize = true;
    private Retry retry = new Retry();

    public String getRoot() { return root; }
    public void setRoot(String root) { this.root = root; }
    public int getDefaultSegments() { return defaultSegments; }
    public void setDefaultSegments(int defaultSegments) { this.defaultSegments = defaultSegments; }
    public int getMaxSegments() { return maxSegments; }
    public void setMaxSegments(int maxSegments) { this.maxSegments = maxSegments; }
    public int getBufferBytes() { return bufferBytes; }
    public void setBufferBytes(int bufferBytes) { this.bufferBytes = bufferBytes; }
    public long getMinSplitBytes() { return minSplitBytes; }
    public void setMinSplitBytes(long minSplitBytes) { this.minSplitBytes = minSplitBytes; }
    public boolean isDnsPrefetch() { return dnsPrefetch; }
    public void setDnsPrefetch(boolean dnsPrefetch) { this.dnsPrefetch = dnsPrefetch; }
    public boolean isTcpPrewarm() { return tcpPrewarm; }
    public void setTcpPrewarm(boolean tcpPrewarm) { this.tcpPrewarm = tcpPrewarm; }
    public boolean isDynamicChunkSize() { return dynamicChunkSize; }
    public void setDynamicChunkSize(boolean dynamicChunkSize) { this.dynamicChunkSize = dynamicChunkSize; }
    public Retry getRetry() { return retry; }
    public void setRetry(Retry retry) { this.retry = retry; }

    public static class Retry {
        private int maxAttempts = 8;
        private long initialDelayMs = 400;
        private long maxDelayMs = 30000;

        public int getMaxAttempts() { return maxAttempts; }
        public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
        public long getInitialDelayMs() { return initialDelayMs; }
        public void setInitialDelayMs(long initialDelayMs) { this.initialDelayMs = initialDelayMs; }
        public long getMaxDelayMs() { return maxDelayMs; }
        public void setMaxDelayMs(long maxDelayMs) { this.maxDelayMs = maxDelayMs; }
    }
}
