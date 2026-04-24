package com.opendownloader.odm.download.http;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

public final class HttpProbe {

    public record Info(long contentLength, boolean acceptsRanges, String finalUrl, String filename, String contentType) { }

    private HttpProbe() { }

    public static Info probe(HttpClient client, URI uri) throws Exception {
        HttpRequest head = HttpRequest.newBuilder(uri)
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(30))
                .build();
        HttpResponse<Void> res;
        try {
            res = client.send(head, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            return rangeProbe(client, uri);
        }
        if (res.statusCode() / 100 != 2) {
            return rangeProbe(client, uri);
        }
        return fromHeaders(res, uri);
    }

    private static Info rangeProbe(HttpClient client, URI uri) throws Exception {
        HttpRequest rangeReq = HttpRequest.newBuilder(uri)
                .GET()
                .header("Range", "bytes=0-0")
                .timeout(Duration.ofSeconds(30))
                .build();
        HttpResponse<Void> res = client.send(rangeReq, HttpResponse.BodyHandlers.discarding());
        return fromHeaders(res, uri);
    }

    private static Info fromHeaders(HttpResponse<?> res, URI uri) {
        long length = res.headers().firstValueAsLong("Content-Length").orElse(-1L);
        String contentRange = res.headers().firstValue("Content-Range").orElse(null);
        if (contentRange != null) {
            int slash = contentRange.lastIndexOf('/');
            if (slash > 0) {
                String total = contentRange.substring(slash + 1).trim();
                if (!total.equals("*")) {
                    try { length = Long.parseLong(total); } catch (NumberFormatException ignored) { }
                }
            }
        }
        boolean acceptsRanges = res.headers().firstValue("Accept-Ranges")
                .map(v -> v.equalsIgnoreCase("bytes"))
                .orElse(res.statusCode() == 206);
        String disposition = res.headers().firstValue("Content-Disposition").orElse(null);
        String filename = parseFilename(disposition);
        if (filename == null) filename = filenameFromUri(res.uri());
        String contentType = res.headers().firstValue("Content-Type").orElse(null);
        URI finalUri = res.uri() != null ? res.uri() : uri;
        return new Info(length, acceptsRanges, finalUri.toString(), filename, contentType);
    }

    private static String parseFilename(String disposition) {
        if (disposition == null) return null;
        String lower = disposition.toLowerCase(Locale.ROOT);
        int idxStar = lower.indexOf("filename*=");
        if (idxStar >= 0) {
            String raw = disposition.substring(idxStar + "filename*=".length()).trim();
            int sep = raw.indexOf("''");
            if (sep >= 0) raw = raw.substring(sep + 2);
            return stripQuotes(splitSemi(raw));
        }
        int idx = lower.indexOf("filename=");
        if (idx >= 0) {
            String raw = disposition.substring(idx + "filename=".length()).trim();
            return stripQuotes(splitSemi(raw));
        }
        return null;
    }

    private static String splitSemi(String s) {
        int semi = s.indexOf(';');
        return semi >= 0 ? s.substring(0, semi).trim() : s;
    }

    private static String stripQuotes(String s) {
        if (s.length() >= 2 && s.charAt(0) == '"' && s.charAt(s.length() - 1) == '"') {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    private static String filenameFromUri(URI uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty()) return "download.bin";
        int slash = path.lastIndexOf('/');
        String name = slash >= 0 ? path.substring(slash + 1) : path;
        if (name.isEmpty()) return "download.bin";
        return name;
    }
}
