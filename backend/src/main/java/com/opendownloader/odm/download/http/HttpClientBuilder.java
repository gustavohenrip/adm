package com.opendownloader.odm.download.http;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executors;

public final class HttpClientBuilder {

    private HttpClientBuilder() { }

    public static HttpClient build(ProxySettings proxy, String username, char[] password) {
        HttpClient.Builder b = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(30))
                .version(HttpClient.Version.HTTP_2)
                .executor(Executors.newCachedThreadPool());

        if (proxy != null && proxy.kind() != ProxySettings.Kind.NONE) {
            b.proxy(proxy.toSelector());
        }
        if (username != null && !username.isBlank() && password != null) {
            b.authenticator(HttpAuth.forCredentials(username, password));
        }
        return b.build();
    }
}
