package com.opendownloader.odm.download.torrent;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "odm.torrent")
public class TorrentProperties {

    private boolean enabled = true;
    private boolean dhtEnabled = true;
    private boolean lsdEnabled = true;
    private boolean upnpEnabled = true;
    private int listenPort = 0;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isDhtEnabled() { return dhtEnabled; }
    public void setDhtEnabled(boolean dhtEnabled) { this.dhtEnabled = dhtEnabled; }
    public boolean isLsdEnabled() { return lsdEnabled; }
    public void setLsdEnabled(boolean lsdEnabled) { this.lsdEnabled = lsdEnabled; }
    public boolean isUpnpEnabled() { return upnpEnabled; }
    public void setUpnpEnabled(boolean upnpEnabled) { this.upnpEnabled = upnpEnabled; }
    public int getListenPort() { return listenPort; }
    public void setListenPort(int listenPort) { this.listenPort = listenPort; }
}
