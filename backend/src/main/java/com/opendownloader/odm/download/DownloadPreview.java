package com.opendownloader.odm.download;

public record DownloadPreview(
        String id,
        String kind,
        String name,
        String source,
        String url,
        String folder,
        long sizeBytes,
        boolean acceptsRanges,
        int segments,
        DownloadCreateRequest http,
        com.opendownloader.odm.download.torrent.TorrentCreateRequest torrent,
        boolean targetExists
) {
}
