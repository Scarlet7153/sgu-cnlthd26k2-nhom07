package com.pcshop.order_service.websocket;

import com.pcshop.order_service.dto.websocket.WebSocketConnectMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WebSocketController {

    @MessageMapping("/connect")
    @SendToUser("/queue/connect")
    public WebSocketConnectMessage handleConnect(Principal principal) {
        String userId = principal != null ? principal.getName() : "anonymous";
        log.info("User connected via WebSocket: {}", userId);
        
        return WebSocketConnectMessage.builder()
                .type("CONNECTED")
                .message("Successfully connected to notification service")
                .userId(userId)
                .build();
    }

    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public WebSocketConnectMessage handlePing(@Payload String message, Principal principal) {
        String userId = principal != null ? principal.getName() : "anonymous";
        log.debug("Ping received from user: {}", userId);
        
        return WebSocketConnectMessage.builder()
                .type("PONG")
                .message("pong: " + message)
                .userId(userId)
                .build();
    }
}
