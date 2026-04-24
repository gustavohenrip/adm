package com.opendownloader.odm.fs;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(CategorizerProperties.class)
public class FileCategorizer {

    private static final String FALLBACK = "General";

    private final CategorizerProperties props;
    private final Map<String, String> extToFolder = new HashMap<>();

    public FileCategorizer(CategorizerProperties props) {
        this.props = props;
        buildIndex();
    }

    private void buildIndex() {
        extToFolder.clear();
        for (Map.Entry<String, List<String>> entry : props.getFolders().entrySet()) {
            String folder = entry.getKey();
            for (String ext : entry.getValue()) {
                extToFolder.put(ext.toLowerCase(Locale.ROOT), folder);
            }
        }
    }

    public String folderFor(String filename) {
        if (!props.isEnabled()) return "";
        if (filename == null) return FALLBACK;
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return FALLBACK;
        String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        return extToFolder.getOrDefault(ext, FALLBACK);
    }

    public Path resolve(Path root, String filename) {
        String category = folderFor(filename);
        if (category == null || category.isEmpty()) return root.resolve(filename);
        return root.resolve(category).resolve(filename);
    }

    public String extOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
