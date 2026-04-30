package com.pcshop.user_service.unit;

import com.pcshop.user_service.dto.request.ChangePasswordRequest;
import com.pcshop.user_service.dto.request.UpdateProfileRequest;
import com.pcshop.user_service.dto.request.UpdateStatusRequest;
import com.pcshop.user_service.dto.response.UserResponse;
import com.pcshop.user_service.exception.BadRequestException;
import com.pcshop.user_service.exception.ResourceNotFoundException;
import com.pcshop.user_service.model.Account;
import com.pcshop.user_service.repository.AccountRepository;
import com.pcshop.user_service.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private AccountRepository accountRepo;
    @Mock private PasswordEncoder encoder;
    @InjectMocks private UserService userService;

    private Account sample() {
        return Account.builder().id("u1").fullName("A").email("a@t.com")
                .phone("090").role("user").status("active").password("h").build();
    }

    @Nested @DisplayName("getProfile")
    class GetProfile {
        @Test void success() {
            when(accountRepo.findById("u1")).thenReturn(Optional.of(sample()));
            assertThat(userService.getProfile("u1").getEmail()).isEqualTo("a@t.com");
        }
        @Test void notFound() {
            when(accountRepo.findById("x")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> userService.getProfile("x")).isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested @DisplayName("updateProfile")
    class Update {
        @Test void updatesName() {
            Account a = sample();
            when(accountRepo.findById("u1")).thenReturn(Optional.of(a));
            when(accountRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            UpdateProfileRequest r = new UpdateProfileRequest(); r.setFullName("B");
            assertThat(userService.updateProfile("u1", r).getFullName()).isEqualTo("B");
        }
        @Test void dupEmail() {
            when(accountRepo.findById("u1")).thenReturn(Optional.of(sample()));
            when(accountRepo.findByEmail("t@t.com")).thenReturn(Optional.of(Account.builder().id("u2").build()));
            UpdateProfileRequest r = new UpdateProfileRequest(); r.setEmail("t@t.com");
            assertThatThrownBy(() -> userService.updateProfile("u1", r)).isInstanceOf(BadRequestException.class);
        }
    }

    @Nested @DisplayName("changePassword")
    class ChangePw {
        @Test void success() {
            Account a = sample();
            when(accountRepo.findById("u1")).thenReturn(Optional.of(a));
            when(encoder.matches("old", "h")).thenReturn(true);
            when(encoder.encode("new")).thenReturn("nh");
            when(accountRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            ChangePasswordRequest r = new ChangePasswordRequest(); r.setCurrentPassword("old"); r.setNewPassword("new");
            userService.changePassword("u1", r);
            verify(accountRepo).save(argThat(ac -> "nh".equals(ac.getPassword())));
        }
        @Test void wrongPw() {
            when(accountRepo.findById("u1")).thenReturn(Optional.of(sample()));
            when(encoder.matches("bad", "h")).thenReturn(false);
            ChangePasswordRequest r = new ChangePasswordRequest(); r.setCurrentPassword("bad"); r.setNewPassword("n");
            assertThatThrownBy(() -> userService.changePassword("u1", r)).isInstanceOf(BadRequestException.class);
        }
    }

    @Nested @DisplayName("updateUserStatus")
    class Status {
        @Test void valid() {
            when(accountRepo.findById("u1")).thenReturn(Optional.of(sample()));
            when(accountRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            UpdateStatusRequest r = new UpdateStatusRequest(); r.setStatus("banned");
            assertThat(userService.updateUserStatus("u1", r).getStatus()).isEqualTo("banned");
        }
        @Test void invalid() {
            when(accountRepo.findById("u1")).thenReturn(Optional.of(sample()));
            UpdateStatusRequest r = new UpdateStatusRequest(); r.setStatus("xyz");
            assertThatThrownBy(() -> userService.updateUserStatus("u1", r)).isInstanceOf(BadRequestException.class);
        }
    }
}
