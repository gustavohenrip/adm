package com.opendownloader.odm.security;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.context.WebServerApplicationContext;
import org.springframework.boot.web.server.WebServer;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class ReadyAnnouncer implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ReadyAnnouncer.class);

    private final SessionToken token;

    public ReadyAnnouncer(SessionToken token) {
        this.token = token;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (event.getApplicationContext() instanceof WebServerApplicationContext web) {
            WebServer server = web.getWebServer();
            int port = server.getPort();
            token.printReadyLine(port);
            writeHandshake(port);
        }
    }

    private void writeHandshake(int port) {
        try {
            Path dir = Paths.get(System.getProperty("user.home"), ".odm");
            Files.createDirectories(dir);
            Path file = dir.resolve("handshake.json");
            String json = "{\"port\":" + port
                    + ",\"token\":\"" + token.value()
                    + "\",\"baseUrl\":\"http://127.0.0.1:" + port + "\""
                    + ",\"version\":1}";
            Files.writeString(file, json);
            try {
                Files.setPosixFilePermissions(file,
                        EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
            } catch (UnsupportedOperationException ignored) { }
        } catch (Exception e) {
            log.warn("could not write handshake file: {}", e.toString());
        }
    }
}
