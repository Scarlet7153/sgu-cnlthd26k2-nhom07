package com.pcshop.user_service.security;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserPrincipal {
    private String id;
    private String username;
    private String role;
}
