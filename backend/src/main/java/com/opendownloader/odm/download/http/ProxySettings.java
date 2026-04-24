package com.opendownloader.odm.download.http;

import java.net.InetSocketAddress;
import java.net.ProxySelector;

public final class ProxySettings {

    public enum Kind { NONE, HTTP, SOCKS }

    private final Kind kind;
    private final String host;
    private final int port;

    public ProxySettings(Kind kind, String host, int port) {
        this.kind = kind;
        this.host = host;
        this.port = port;
    }

    public static ProxySettings none() {
        return new ProxySettings(Kind.NONE, null, 0);
    }

    public ProxySelector toSelector() {
        if (kind == Kind.NONE || host == null || host.isBlank()) return ProxySelector.getDefault();
        return ProxySelector.of(new InetSocketAddress(host, port));
    }

    public Kind kind() { return kind; }
    public String host() { return host; }
    public int port() { return port; }
}
