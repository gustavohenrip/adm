package com.opendownloader.odm.security;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(1)
public class TokenFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Odm-Token";
    private static final Set<String> PUBLIC_PATHS = Set.of("/ws", "/actuator/health");

    private final SessionToken sessionToken;

    public TokenFilter(SessionToken sessionToken) {
        this.sessionToken = sessionToken;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if (HttpMethod.OPTIONS.matches(req.getMethod()) || isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }
        String provided = req.getHeader(HEADER);
        if (provided == null || !provided.equals(sessionToken.value())) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"invalid or missing token\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private boolean isPublic(String path) {
        for (String p : PUBLIC_PATHS) {
            if (path.startsWith(p)) return true;
        }
        return false;
    }
}
