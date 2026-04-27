package com.opendownloader.odm.download;

import java.util.List;

public record DownloadCreateRequest(
        String url,
        String folder,
        Integer segments,
        String username,
        String password,
        List<String> mirrors,
        String checksumAlgo,
        String checksumExpected
) {
    public DownloadCreateRequest(String url, String folder, Integer segments, String username, String password) {
        this(url, folder, segments, username, password, null, null, null);
    }
}
