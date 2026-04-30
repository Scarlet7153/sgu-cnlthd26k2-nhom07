package com.pcshop.auth_service.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcshop.auth_service.controller.AuthController;
import com.pcshop.auth_service.dto.request.LoginRequest;
import com.pcshop.auth_service.dto.request.RegisterRequest;
import com.pcshop.auth_service.dto.request.VerifyOtpRequest;
import com.pcshop.auth_service.dto.response.AuthResponse;
import com.pcshop.auth_service.dto.response.RegisterResponse;
import com.pcshop.auth_service.dto.response.UserResponse;
import com.pcshop.auth_service.exception.BadRequestException;
import com.pcshop.auth_service.security.JwtTokenProvider;
import com.pcshop.auth_service.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private AuthService authService;
    @MockBean private JwtTokenProvider jwtTokenProvider;

    @Test
    @DisplayName("POST /api/auth/register → 201 Created")
    void register_success() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Test"); req.setEmail("t@t.com"); req.setPassword("pass123");
        RegisterResponse res = RegisterResponse.builder()
                .email("t@t.com").message("OTP đã được gửi").otpExpiresIn(300).build();
        when(authService.register(any())).thenReturn(res);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("t@t.com"));
    }

    @Test
    @DisplayName("POST /api/auth/register → 400 khi email trùng")
    void register_duplicate() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setFullName("Test"); req.setEmail("dup@t.com"); req.setPassword("pass123");
        when(authService.register(any())).thenThrow(new BadRequestException("Email đã tồn tại"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/login → 200 OK + token")
    void login_success() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("t@t.com"); req.setPassword("pass");
        AuthResponse res = AuthResponse.builder()
                .accessToken("jwt-tok").refreshToken("rt").tokenType("Bearer").expiresIn(3600)
                .user(UserResponse.builder().id("u1").email("t@t.com").build())
                .build();
        when(authService.login(any())).thenReturn(res);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("jwt-tok"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"));
    }

    @Test
    @DisplayName("POST /api/auth/login → 401 khi sai mật khẩu")
    void login_wrongPassword() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("t@t.com"); req.setPassword("wrong");
        when(authService.login(any())).thenThrow(new BadCredentialsException("Invalid"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/auth/verify-otp → 200 OK + token")
    void verifyOtp_success() throws Exception {
        VerifyOtpRequest req = VerifyOtpRequest.builder().email("t@t.com").code("123456").build();
        AuthResponse res = AuthResponse.builder()
                .accessToken("new-jwt").refreshToken("rt").tokenType("Bearer").expiresIn(3600).build();
        when(authService.verifyOtp(any())).thenReturn(res);

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("new-jwt"));
    }
}
