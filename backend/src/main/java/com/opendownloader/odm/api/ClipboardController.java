package com.opendownloader.odm.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.opendownloader.odm.download.clipboard.ClipboardService;

@RestController
@RequestMapping("/api/clipboard")
public class ClipboardController {

    private final ClipboardService clipboard;

    public ClipboardController(ClipboardService clipboard) {
        this.clipboard = clipboard;
    }

    @PostMapping("/captured")
    public ResponseEntity<Map<String, Object>> captured(@RequestBody Map<String, String> body) {
        if (body == null || body.get("url") == null || body.get("url").isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", "url required"));
        }
        clipboard.capture(body.get("url").trim());
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
