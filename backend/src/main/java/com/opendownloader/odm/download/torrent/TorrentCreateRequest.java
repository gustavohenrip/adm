package com.opendownloader.odm.download.torrent;

public record TorrentCreateRequest(
        String magnet,
        String torrentUrl,
        String torrentBase64,
        String folder,
        String name,
        Boolean overwrite
) {
}
