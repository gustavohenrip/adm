package com.opendownloader.odm.download.http;

import java.net.Authenticator;
import java.net.PasswordAuthentication;

public final class HttpAuth {

    private HttpAuth() { }

    public static Authenticator forCredentials(String username, char[] password) {
        return new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(username, password);
            }
        };
    }
}
