package com.opendownloader.odm.security;

import java.net.InetAddress;
import java.net.URI;
import java.util.Set;

import org.springframework.stereotype.Component;

@Component
public class UrlGuard {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https", "ftp");
    private volatile boolean allowLocal = false;

    public void setAllowLocal(boolean allow) {
        this.allowLocal = allow;
    }

    public URI parseOrReject(String raw) {
        URI uri = URI.create(raw);
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
            throw new IllegalArgumentException("scheme not allowed: " + scheme);
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("missing host");
        }
        if (!allowLocal && isLocalOrPrivate(host)) {
            throw new IllegalArgumentException("host blocked: " + host);
        }
        return uri;
    }

    private boolean isLocalOrPrivate(String host) {
        try {
            InetAddress addr = InetAddress.getByName(host);
            return addr.isAnyLocalAddress()
                    || addr.isLoopbackAddress()
                    || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress()
                    || addr.isMulticastAddress();
        } catch (Exception e) {
            return true;
        }
    }
}
