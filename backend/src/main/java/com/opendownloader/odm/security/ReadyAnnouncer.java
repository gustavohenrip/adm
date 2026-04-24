package com.opendownloader.odm.security;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.context.WebServerApplicationContext;
import org.springframework.boot.web.server.WebServer;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class ReadyAnnouncer implements ApplicationListener<ApplicationReadyEvent> {

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
        }
    }
}
