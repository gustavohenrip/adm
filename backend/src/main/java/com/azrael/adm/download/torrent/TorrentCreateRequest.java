package com.azrael.adm.download.torrent;

public record TorrentCreateRequest(
        String magnet,
        String torrentBase64,
        String folder
) {
}
