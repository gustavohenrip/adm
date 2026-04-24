package com.opendownloader.odm.download;

import java.time.Instant;

import com.opendownloader.odm.persistence.DownloadEntity;

public record DownloadView(
        String id,
        String kind,
        String name,
        String ext,
        long sizeBytes,
        long downloadedBytes,
        double progress,
        long speedBps,
        long etaSeconds,
        String status,
        String source,
        Instant completedAt,
        String folder,
        String url,
        String errorMessage
) {
    public static DownloadView from(DownloadEntity e, long speedBps) {
        long downloaded = Math.max(e.getDownloadedBytes(), 0L);
        long size = Math.max(e.getSizeBytes(), 0L);
        double progress = size <= 0 ? 0.0 : Math.max(0.0, Math.min(1.0, (double) downloaded / (double) size));
        long remaining = Math.max(0L, size - downloaded);
        long activeSpeed = e.getStatus() == DownloadStatus.DOWNLOADING ? Math.max(0L, speedBps) : 0L;
        long eta = activeSpeed > 0 ? remaining / activeSpeed : -1L;
        return new DownloadView(
                e.getId(),
                e.getKind().name().toLowerCase(),
                e.getName(),
                e.getExt(),
                size,
                downloaded,
                progress,
                activeSpeed,
                eta,
                e.getStatus().name().toLowerCase(),
                e.getSource(),
                e.getCompletedAt(),
                e.getFolder(),
                e.getUrl(),
                e.getErrorMessage()
        );
    }
}
