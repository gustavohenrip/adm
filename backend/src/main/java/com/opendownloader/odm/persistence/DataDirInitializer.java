package com.opendownloader.odm.persistence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import jakarta.annotation.PostConstruct;

import org.springframework.stereotype.Component;

@Component
public class DataDirInitializer {

    @PostConstruct
    public void ensureDataDir() throws Exception {
        Path home = Paths.get(System.getProperty("user.home"), ".odm");
        if (!Files.exists(home)) {
            Files.createDirectories(home);
        }
    }
}
