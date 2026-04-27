package com.opendownloader.odm.download.http;

import java.net.http.HttpRequest;
import java.util.LinkedHashMap;
import java.util.Map;

public record HttpRequestHeaders(String referer, String cookies, String userAgent) {

    public Map<String, String> asMap() {
        Map<String, String> headers = new LinkedHashMap<>();
        put(headers, "Referer", referer);
        put(headers, "Cookie", cookies);
        put(headers, "User-Agent", userAgent);
        return headers;
    }

    public void apply(HttpRequest.Builder builder) {
        asMap().forEach(builder::header);
    }

    public boolean empty() {
        return blank(referer) && blank(cookies) && blank(userAgent);
    }

    public static HttpRequestHeaders emptyHeaders() {
        return new HttpRequestHeaders(null, null, null);
    }

    private static void put(Map<String, String> headers, String name, String value) {
        String clean = clean(value);
        if (clean != null) headers.put(name, clean);
    }

    public static String clean(String value) {
        if (blank(value)) return null;
        String clean = value.replace('\r', ' ').replace('\n', ' ').trim();
        return clean.isBlank() ? null : clean;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
