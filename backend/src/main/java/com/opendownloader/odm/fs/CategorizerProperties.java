package com.opendownloader.odm.fs;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "odm.categorizer")
public class CategorizerProperties {

    private boolean enabled = true;
    private Map<String, List<String>> folders = new HashMap<>();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Map<String, List<String>> getFolders() { return folders; }
    public void setFolders(Map<String, List<String>> folders) { this.folders = folders; }
}
