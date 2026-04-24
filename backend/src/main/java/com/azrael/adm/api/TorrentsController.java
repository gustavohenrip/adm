package com.azrael.adm.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.azrael.adm.download.DownloadView;
import com.azrael.adm.download.torrent.TorrentCreateRequest;
import com.azrael.adm.download.torrent.TorrentDownloadService;

@RestController
@RequestMapping("/api/torrents")
public class TorrentsController {

    private final TorrentDownloadService torrents;

    public TorrentsController(TorrentDownloadService torrents) {
        this.torrents = torrents;
    }

    @PostMapping
    public ResponseEntity<DownloadView> add(@RequestBody TorrentCreateRequest body) throws Exception {
        return ResponseEntity.accepted().body(torrents.create(body));
    }
}
