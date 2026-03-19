package com.pcshop.auth_service.security;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserPrincipal {
    private String id;
    private String email;
    private String role;
}
