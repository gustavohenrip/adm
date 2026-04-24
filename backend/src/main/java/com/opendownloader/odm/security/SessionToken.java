package com.opendownloader.odm.security;

import java.security.SecureRandom;
import java.util.Base64;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SessionToken {

    private static final Logger log = LoggerFactory.getLogger(SessionToken.class);

    private String token;

    @PostConstruct
    public void init() {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    public String value() {
        return token;
    }

    public void printReadyLine(int port) {
        String ready = "ODM_READY port=" + port + " token=" + token;
        System.out.println(ready);
        log.info("backend ready on 127.0.0.1:{}", port);
    }
}
