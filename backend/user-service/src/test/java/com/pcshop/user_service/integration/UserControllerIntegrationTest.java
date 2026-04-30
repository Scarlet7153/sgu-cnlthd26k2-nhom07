package com.pcshop.user_service.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcshop.user_service.controller.UserController;
import com.pcshop.user_service.dto.request.UpdateStatusRequest;
import com.pcshop.user_service.dto.response.UserResponse;
import com.pcshop.user_service.exception.BadRequestException;
import com.pcshop.user_service.exception.ResourceNotFoundException;
import com.pcshop.user_service.security.JwtTokenProvider;
import com.pcshop.user_service.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private UserService userService;
    @MockBean private JwtTokenProvider jwtTokenProvider;

    private UserResponse sampleUser() {
        return UserResponse.builder()
                .id("u1").fullName("A").email("a@t.com").role("user").status("active")
                .build();
    }

    @Test
    @DisplayName("GET /api/users/{id} → 200 OK")
    void getUserById_success() throws Exception {
        when(userService.getUserById("u1")).thenReturn(sampleUser());
        mockMvc.perform(get("/api/users/u1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("a@t.com"));
    }

    @Test
    @DisplayName("GET /api/users/{id} → 404 Not Found")
    void getUserById_notFound() throws Exception {
        when(userService.getUserById("x")).thenThrow(new ResourceNotFoundException("Account", "id", "x"));
        mockMvc.perform(get("/api/users/x"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/users → 200 trả về paginated list")
    void getAllUsers() throws Exception {
        when(userService.getAllUsers(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(sampleUser())));
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value("u1"));
    }

    @Test
    @DisplayName("PUT /api/users/{id}/status → 200 cập nhật status")
    void updateStatus_success() throws Exception {
        UserResponse updated = sampleUser();
        updated.setStatus("banned");
        when(userService.updateUserStatus(eq("u1"), any())).thenReturn(updated);

        UpdateStatusRequest req = new UpdateStatusRequest();
        req.setStatus("banned");

        mockMvc.perform(put("/api/users/u1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("banned"));
    }

    @Test
    @DisplayName("PUT /api/users/{id}/status → 400 status không hợp lệ")
    void updateStatus_invalid() throws Exception {
        when(userService.updateUserStatus(eq("u1"), any()))
                .thenThrow(new BadRequestException("Invalid status"));

        mockMvc.perform(put("/api/users/u1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"xyz\"}"))
                .andExpect(status().isBadRequest());
    }
}
