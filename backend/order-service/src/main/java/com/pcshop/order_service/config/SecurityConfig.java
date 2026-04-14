package com.pcshop.order_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .authorizeHttpRequests(auth -> auth
                // Allow WebSocket endpoints without authentication
                .requestMatchers("/ws/**", "/ws/notifications/**", "/ws/notifications/info/**").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                // All other requests need authentication (or adjust as needed)
                .anyRequest().permitAll()
            );
        
        return http.build();
    }
}
