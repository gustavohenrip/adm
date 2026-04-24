package com.opendownloader.odm.download;

import java.time.Instant;

public record DownloadSnapshot(
        String id,
        DownloadKind kind,
        String name,
        String ext,
        String url,
        String source,
        long sizeBytes,
        long downloadedBytes,
        long speedBps,
        long etaSeconds,
        DownloadStatus status,
        String folder,
        Instant createdAt,
        Instant completedAt,
        String errorMessage
) {
    public double progress() {
        if (sizeBytes <= 0) return 0.0;
        double p = (double) downloadedBytes / (double) sizeBytes;
        if (p < 0) return 0.0;
        if (p > 1) return 1.0;
        return p;
    }
}
