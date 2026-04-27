package com.opendownloader.odm.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.opendownloader.odm.download.DownloadCreateRequest;
import com.opendownloader.odm.download.DownloadIntakePublisher;
import com.opendownloader.odm.download.DownloadPreview;
import com.opendownloader.odm.download.DownloadService;
import com.opendownloader.odm.download.torrent.TorrentCreateRequest;
import com.opendownloader.odm.download.torrent.TorrentDownloadService;
import java.util.List;

@RestController
@RequestMapping("/api/intake")
public class IntakeController {

    private final DownloadService downloads;
    private final TorrentDownloadService torrents;
    private final DownloadIntakePublisher publisher;

    public IntakeController(DownloadService downloads, TorrentDownloadService torrents, DownloadIntakePublisher publisher) {
        this.downloads = downloads;
        this.torrents = torrents;
        this.publisher = publisher;
    }

    @PostMapping
    public ResponseEntity<DownloadPreview> submit(@RequestBody DownloadCreateRequest payload) throws Exception {
        DownloadPreview preview = preview(payload);
        publisher.publish(preview);
        return ResponseEntity.accepted().body(preview);
    }

    @GetMapping
    public List<DownloadPreview> pending() {
        return publisher.drain();
    }

    private DownloadPreview preview(DownloadCreateRequest payload) throws Exception {
        if (payload == null || payload.url() == null || payload.url().isBlank()) {
            throw new IllegalArgumentException("url is required");
        }
        String url = payload.url().trim();
        if (url.regionMatches(true, 0, "magnet:", 0, 7)) {
            return torrents.preview(new TorrentCreateRequest(url, null, null, payload.folder(), null));
        }
        if (url.matches("(?i)^https?://.*\\.torrent(?:[?#].*)?$")) {
            return torrents.preview(new TorrentCreateRequest(null, url, null, payload.folder(), null));
        }
        return downloads.preview(payload);
    }
}
