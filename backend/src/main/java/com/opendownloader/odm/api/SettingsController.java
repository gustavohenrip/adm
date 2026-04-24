package com.opendownloader.odm.api;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.opendownloader.odm.settings.RuntimeSettings;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final RuntimeSettings settings;

    public SettingsController(RuntimeSettings settings) {
        this.settings = settings;
    }

    @GetMapping
    public Map<String, String> get() {
        return settings.get();
    }

    @PutMapping
    public Map<String, String> put(@RequestBody Map<String, String> body) {
        return settings.save(body);
    }
}
