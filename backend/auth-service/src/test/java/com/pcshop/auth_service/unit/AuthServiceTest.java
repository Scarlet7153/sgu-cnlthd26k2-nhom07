package com.pcshop.auth_service.unit;

import com.pcshop.auth_service.config.AuthConstants;
import com.pcshop.auth_service.dto.request.*;
import com.pcshop.auth_service.dto.response.AuthResponse;
import com.pcshop.auth_service.dto.response.RegisterResponse;
import com.pcshop.auth_service.exception.BadRequestException;
import com.pcshop.auth_service.model.Account;
import com.pcshop.auth_service.model.Otp;
import com.pcshop.auth_service.model.RefreshToken;
import com.pcshop.auth_service.repository.AccountRepository;
import com.pcshop.auth_service.repository.OtpRepository;
import com.pcshop.auth_service.repository.RefreshTokenRepository;
import com.pcshop.auth_service.security.JwtTokenProvider;
import com.pcshop.auth_service.service.AuthService;
import com.pcshop.auth_service.service.EmailService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private AccountRepository accountRepo;
    @Mock private RefreshTokenRepository refreshRepo;
    @Mock private OtpRepository otpRepo;
    @Mock private PasswordEncoder encoder;
    @Mock private JwtTokenProvider jwt;
    @Mock private EmailService emailService;
    @InjectMocks private AuthService authService;

    // ── Fixtures ──────────────────────────────────────────────
    private Account activeAccount() {
        return Account.builder()
                .id("acc-1").email("user@test.com")
                .password("hashed").status("active").role("user")
                .build();
    }
    private Account unverifiedAccount() {
        return Account.builder()
                .id("acc-2").email("new@test.com")
                .password("hashed").status("unverified")
                .build();
    }
    private void stubTokenGeneration() {
        when(jwt.generateAccessToken(anyString(), anyString(), anyString())).thenReturn("access-tok");
        when(jwt.getAccessTokenExpirationMs()).thenReturn(3600_000L);
        when(jwt.getRefreshTokenExpirationMs()).thenReturn(2_592_000_000L);
        when(refreshRepo.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));
    }

    // ==================== Registration ====================
    @Nested @DisplayName("register()")
    class Register {
        @Test @DisplayName("thành công với email mới")
        void success() {
            RegisterRequest req = new RegisterRequest();
            req.setFullName("Nguyen Van A"); req.setEmail("a@test.com"); req.setPassword("pass");

            when(accountRepo.existsByEmail("a@test.com")).thenReturn(false);
            when(encoder.encode("pass")).thenReturn("hashed");
            when(accountRepo.save(any())).thenAnswer(i -> { Account a = i.getArgument(0); a.setId("new-id"); return a; });
            doNothing().when(emailService).sendOtpEmail(anyString(), anyString());

            RegisterResponse res = authService.register(req);
            assertThat(res.getEmail()).isEqualTo("a@test.com");
            assertThat(res.getMessage()).containsIgnoringCase("OTP");
            verify(accountRepo).save(argThat(a -> "unverified".equals(a.getStatus())));
        }

        @Test @DisplayName("email trùng → BadRequestException")
        void duplicateEmail() {
            RegisterRequest req = new RegisterRequest();
            req.setFullName("B"); req.setEmail("dup@test.com"); req.setPassword("pass");
            when(accountRepo.existsByEmail("dup@test.com")).thenReturn(true);

            assertThatThrownBy(() -> authService.register(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_EMAIL_EXISTS);
        }

        @Test @DisplayName("lưu địa chỉ khi có houseNumber")
        void savesAddress() {
            RegisterRequest req = new RegisterRequest();
            req.setFullName("C"); req.setEmail("c@test.com"); req.setPassword("pass");
            req.setHouseNumber("42"); req.setStreet("Lê Lợi");

            when(accountRepo.existsByEmail(anyString())).thenReturn(false);
            when(encoder.encode(anyString())).thenReturn("h");
            when(accountRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            doNothing().when(emailService).sendOtpEmail(anyString(), anyString());

            authService.register(req);
            verify(accountRepo).save(argThat(a ->
                    a.getAddressDetails() != null && "42".equals(a.getAddressDetails().getHouseNumber())));
        }
    }

    // ==================== Login ====================
    @Nested @DisplayName("login()")
    class Login {
        @Test @DisplayName("thành công với tài khoản active")
        void success() {
            LoginRequest req = new LoginRequest();
            req.setEmail("user@test.com"); req.setPassword("pw");
            Account acc = activeAccount();

            when(accountRepo.findByEmail("user@test.com")).thenReturn(Optional.of(acc));
            when(encoder.matches("pw", "hashed")).thenReturn(true);
            stubTokenGeneration();

            AuthResponse res = authService.login(req);
            assertThat(res.getAccessToken()).isEqualTo("access-tok");
            assertThat(res.getTokenType()).isEqualTo("Bearer");
        }

        @Test @DisplayName("sai mật khẩu → BadCredentialsException")
        void wrongPassword() {
            LoginRequest req = new LoginRequest();
            req.setEmail("user@test.com"); req.setPassword("wrong");

            when(accountRepo.findByEmail("user@test.com")).thenReturn(Optional.of(activeAccount()));
            when(encoder.matches("wrong", "hashed")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(req))
                    .isInstanceOf(BadCredentialsException.class);
        }

        @Test @DisplayName("tài khoản chưa xác minh → gửi OTP lại")
        void unverifiedSendsOtp() {
            LoginRequest req = new LoginRequest();
            req.setEmail("new@test.com"); req.setPassword("pw");
            Account acc = unverifiedAccount();

            when(accountRepo.findByEmail("new@test.com")).thenReturn(Optional.of(acc));
            when(encoder.matches("pw", "hashed")).thenReturn(true);
            doNothing().when(emailService).sendOtpEmail(anyString(), anyString());

            assertThatThrownBy(() -> authService.login(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_ACCOUNT_NOT_VERIFIED);
            verify(emailService).sendOtpEmail(eq("new@test.com"), anyString());
        }

        @Test @DisplayName("email không tồn tại → BadCredentialsException")
        void emailNotFound() {
            LoginRequest req = new LoginRequest();
            req.setEmail("no@test.com"); req.setPassword("pw");
            when(accountRepo.findByEmail("no@test.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(req))
                    .isInstanceOf(BadCredentialsException.class);
        }
    }

    // ==================== OTP Verification ====================
    @Nested @DisplayName("verifyOtp()")
    class VerifyOtp {
        @Test @DisplayName("OTP hợp lệ → kích hoạt tài khoản + trả token")
        void success() {
            VerifyOtpRequest req = VerifyOtpRequest.builder().email("new@test.com").code("123456").build();
            Otp otp = Otp.builder().email("new@test.com").code("123456").attempts(0)
                    .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(900)).build();
            Account acc = unverifiedAccount();

            when(otpRepo.findByEmail("new@test.com")).thenReturn(Optional.of(otp));
            when(accountRepo.findByEmail("new@test.com")).thenReturn(Optional.of(acc));
            when(accountRepo.save(any())).thenReturn(acc);
            stubTokenGeneration();
            doNothing().when(otpRepo).delete(any());

            AuthResponse res = authService.verifyOtp(req);
            assertThat(res.getAccessToken()).isNotBlank();
            assertThat(acc.getStatus()).isEqualTo("active");
            verify(otpRepo).delete(otp);
        }

        @Test @DisplayName("OTP hết hạn → xóa + throw")
        void expired() {
            VerifyOtpRequest req = VerifyOtpRequest.builder().email("x@test.com").code("123456").build();
            Otp otp = Otp.builder().email("x@test.com").code("123456").attempts(0)
                    .createdAt(Instant.now().minusSeconds(1000)).expiresAt(Instant.now().minusSeconds(100)).build();
            when(otpRepo.findByEmail("x@test.com")).thenReturn(Optional.of(otp));
            doNothing().when(otpRepo).delete(any());

            assertThatThrownBy(() -> authService.verifyOtp(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_OTP_EXPIRED);
        }

        @Test @DisplayName("OTP sai mã → tăng attempts")
        void wrongCode() {
            VerifyOtpRequest req = VerifyOtpRequest.builder().email("x@test.com").code("999999").build();
            Otp otp = Otp.builder().email("x@test.com").code("123456").attempts(0)
                    .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(900)).build();
            when(otpRepo.findByEmail("x@test.com")).thenReturn(Optional.of(otp));
            when(otpRepo.save(any())).thenReturn(otp);

            assertThatThrownBy(() -> authService.verifyOtp(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_INVALID_OTP);
            verify(otpRepo).save(argThat(o -> o.getAttempts() == 1));
        }

        @Test @DisplayName("vượt quá max attempts → xóa OTP")
        void maxAttempts() {
            VerifyOtpRequest req = VerifyOtpRequest.builder().email("x@test.com").code("000000").build();
            Otp otp = Otp.builder().email("x@test.com").code("123456").attempts(5)
                    .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(900)).build();
            when(otpRepo.findByEmail("x@test.com")).thenReturn(Optional.of(otp));
            doNothing().when(otpRepo).delete(any());

            assertThatThrownBy(() -> authService.verifyOtp(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_TOO_MANY_ATTEMPTS);
        }

        @Test @DisplayName("OTP format sai (5 chữ số) → throw ngay")
        void invalidFormat() {
            VerifyOtpRequest req = VerifyOtpRequest.builder().email("x@test.com").code("12345").build();
            assertThatThrownBy(() -> authService.verifyOtp(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_INVALID_OTP_FORMAT);
        }
    }

    // ==================== Refresh Token ====================
    @Nested @DisplayName("refresh()")
    class Refresh {
        @Test @DisplayName("refresh hợp lệ → trả token mới")
        void success() {
            RefreshTokenRequest req = new RefreshTokenRequest();
            req.setRefreshToken("valid-rt");
            RefreshToken rt = RefreshToken.builder()
                    .id("rt-1").accountId("acc-1").token("valid-rt")
                    .expiresAt(Instant.now().plusSeconds(86400)).createdAt(Instant.now()).build();

            when(refreshRepo.findByToken("valid-rt")).thenReturn(Optional.of(rt));
            when(accountRepo.findById("acc-1")).thenReturn(Optional.of(activeAccount()));
            stubTokenGeneration();
            doNothing().when(refreshRepo).delete(any());

            AuthResponse res = authService.refresh(req);
            assertThat(res.getAccessToken()).isNotBlank();
            verify(refreshRepo).delete(rt);
        }

        @Test @DisplayName("token hết hạn → xóa + throw")
        void expired() {
            RefreshTokenRequest req = new RefreshTokenRequest();
            req.setRefreshToken("expired-rt");
            RefreshToken rt = RefreshToken.builder()
                    .id("rt-2").accountId("acc-1").token("expired-rt")
                    .expiresAt(Instant.now().minusSeconds(100)).createdAt(Instant.now().minusSeconds(86400)).build();

            when(refreshRepo.findByToken("expired-rt")).thenReturn(Optional.of(rt));
            doNothing().when(refreshRepo).delete(any());

            assertThatThrownBy(() -> authService.refresh(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_REFRESH_TOKEN_EXPIRED);
        }

        @Test @DisplayName("token không tồn tại → throw")
        void notFound() {
            RefreshTokenRequest req = new RefreshTokenRequest();
            req.setRefreshToken("unknown");
            when(refreshRepo.findByToken("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.refresh(req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(AuthConstants.ERROR_INVALID_REFRESH_TOKEN);
        }
    }

    // ==================== Logout ====================
    @Test @DisplayName("logout() xóa tất cả refresh tokens")
    void logout() {
        doNothing().when(refreshRepo).deleteByAccountId("acc-1");
        authService.logout("acc-1");
        verify(refreshRepo).deleteByAccountId("acc-1");
    }

    // ==================== Forgot / Reset Password ====================
    @Nested @DisplayName("forgotPassword()")
    class ForgotPassword {
        @Test @DisplayName("gửi OTP cho tài khoản active")
        void success() {
            ForgotPasswordRequest req = new ForgotPasswordRequest();
            req.setEmail("user@test.com");
            when(accountRepo.findByEmail("user@test.com")).thenReturn(Optional.of(activeAccount()));
            doNothing().when(emailService).sendOtpEmail(anyString(), anyString());

            RegisterResponse res = authService.forgotPassword(req);
            assertThat(res.getEmail()).isEqualTo("user@test.com");
            verify(emailService).sendOtpEmail(eq("user@test.com"), anyString());
        }

        @Test @DisplayName("tài khoản chưa active → throw")
        void notActive() {
            ForgotPasswordRequest req = new ForgotPasswordRequest();
            req.setEmail("new@test.com");
            when(accountRepo.findByEmail("new@test.com")).thenReturn(Optional.of(unverifiedAccount()));

            assertThatThrownBy(() -> authService.forgotPassword(req))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested @DisplayName("resetPassword()")
    class ResetPassword {
        @Test @DisplayName("đổi mật khẩu thành công với OTP hợp lệ")
        void success() {
            ResetPasswordRequest req = new ResetPasswordRequest();
            req.setEmail("user@test.com"); req.setCode("654321"); req.setNewPassword("newPw");
            Otp otp = Otp.builder().email("user@test.com").code("654321").attempts(0)
                    .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(900)).build();

            when(otpRepo.findByEmail("user@test.com")).thenReturn(Optional.of(otp));
            when(accountRepo.findByEmail("user@test.com")).thenReturn(Optional.of(activeAccount()));
            when(encoder.encode("newPw")).thenReturn("newHash");
            when(accountRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            doNothing().when(otpRepo).delete(any());
            doNothing().when(refreshRepo).deleteByAccountId(anyString());

            authService.resetPassword(req);
            verify(accountRepo).save(argThat(a -> "newHash".equals(a.getPassword())));
            verify(refreshRepo).deleteByAccountId("acc-1");
        }
    }
}
