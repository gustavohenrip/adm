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
        String checksumExpected,
        String referer,
        String cookies,
        String userAgent,
        String filename,
        Long sizeBytes,
        Boolean acceptsRanges,
        Boolean probe,
        Boolean overwrite
) {
    public DownloadCreateRequest(String url, String folder, Integer segments, String username, String password) {
        this(url, folder, segments, username, password, null, null, null, null, null, null, null, null, null, null, null);
    }

    public DownloadCreateRequest(String url, String folder, Integer segments, String username, String password,
                                 List<String> mirrors, String checksumAlgo, String checksumExpected) {
        this(url, folder, segments, username, password, mirrors, checksumAlgo, checksumExpected,
                null, null, null, null, null, null, null, null);
    }
}
