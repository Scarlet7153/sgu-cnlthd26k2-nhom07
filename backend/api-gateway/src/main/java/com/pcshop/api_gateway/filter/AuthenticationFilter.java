package com.pcshop.api_gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class AuthenticationFilter implements GlobalFilter, Ordered {

    @Value("${jwt.secret:pcshop-jwt-secret-key-2026-must-be-at-least-256-bits-long-for-hs256}")
    private String jwtSecret;

    // Always-public routes (any HTTP method)
    private final List<String> publicPrefixes = List.of(
            "/api/auth/",             // login, register, verify-otp, resend-otp, refresh
            "/api/payments/callback/" // payment webhooks
    );

    // Public for GET only (product browsing without login)
    private final List<String> publicGetPrefixes = List.of(
            "/api/products",
            "/api/categories",
            "/api/reviews"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path   = request.getURI().getPath();
        String method = request.getMethod().name();

        // 1. Always-public (any method)
        boolean isAlwaysPublic = publicPrefixes.stream().anyMatch(path::startsWith);
        if (isAlwaysPublic) return chain.filter(exchange);

        // 2. Public GET only
        boolean isPublicGet = "GET".equals(method)
                && publicGetPrefixes.stream().anyMatch(path::startsWith);
        if (isPublicGet) return chain.filter(exchange);

        // 3. All others require valid JWT
        if (!request.getHeaders().containsKey("Authorization")) {
            return onError(exchange, "Missing Authorization Header", HttpStatus.UNAUTHORIZED);
        }

        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return onError(exchange, "Invalid Authorization Header", HttpStatus.UNAUTHORIZED);
        }

        String token = authHeader.substring(7);

        try {
            // IMPORTANT: auth-service signs with getBytes(UTF_8) — must match here
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String userId = claims.getSubject();
            String role   = claims.get("role", String.class);

            // Pass user info to downstream services via custom headers
            ServerHttpRequest modifiedRequest = request.mutate()
                    .header("X-User-Id",   userId != null ? userId : "")
                    .header("X-User-Role", role   != null ? role   : "")
                    .build();

            return chain.filter(exchange.mutate().request(modifiedRequest).build());

        } catch (Exception e) {
            return onError(exchange, "Invalid or Expired Token", HttpStatus.UNAUTHORIZED);
        }
    }

    private Mono<Void> onError(ServerWebExchange exchange, String message, HttpStatus status) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().add("Content-Type", "application/json");
        byte[] body = ("{\"status\":\"error\",\"message\":\"" + message + "\"}")
                .getBytes(StandardCharsets.UTF_8);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body)));
    }

    @Override
    public int getOrder() {
        return -1; // highest priority
    }
}
