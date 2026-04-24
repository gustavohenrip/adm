package com.azrael.adm.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.azrael.adm.download.DownloadCreateRequest;
import com.azrael.adm.download.DownloadKind;
import com.azrael.adm.download.DownloadService;
import com.azrael.adm.download.DownloadView;
import com.azrael.adm.download.torrent.TorrentDownloadService;
import com.azrael.adm.persistence.DownloadRepository;

import java.util.List;

@RestController
@RequestMapping("/api/downloads")
public class DownloadsController {

    private final DownloadService downloads;
    private final TorrentDownloadService torrents;
    private final DownloadRepository repo;

    public DownloadsController(DownloadService downloads, TorrentDownloadService torrents, DownloadRepository repo) {
        this.downloads = downloads;
        this.torrents = torrents;
        this.repo = repo;
    }

    @GetMapping
    public List<DownloadView> list() {
        return downloads.list();
    }

    @PostMapping
    public ResponseEntity<DownloadView> create(@RequestBody DownloadCreateRequest payload) throws Exception {
        return ResponseEntity.accepted().body(downloads.create(payload));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<DownloadView> pause(@PathVariable String id) {
        return ResponseEntity.ok(isTorrent(id) ? torrents.pause(id) : downloads.pause(id));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<DownloadView> resume(@PathVariable String id) throws Exception {
        return ResponseEntity.ok(isTorrent(id) ? torrents.resume(id) : downloads.resume(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id, @RequestParam(defaultValue = "false") boolean deleteFiles) {
        try {
            if (isTorrent(id)) torrents.remove(id, deleteFiles);
            else downloads.remove(id, deleteFiles);
        } catch (Exception e) {
            throw new IllegalArgumentException(e.getMessage(), e);
        }
        return ResponseEntity.noContent().build();
    }

    private boolean isTorrent(String id) {
        return repo.findById(id).map(d -> d.getKind() == DownloadKind.TORRENT).orElse(false);
    }
}
