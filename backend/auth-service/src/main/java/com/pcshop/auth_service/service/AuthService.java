package com.pcshop.auth_service.service;

import com.pcshop.auth_service.config.AuthConstants;
import com.pcshop.auth_service.dto.request.LoginRequest;
import com.pcshop.auth_service.dto.request.RefreshTokenRequest;
import com.pcshop.auth_service.dto.request.RegisterRequest;
import com.pcshop.auth_service.dto.request.VerifyOtpRequest;
import com.pcshop.auth_service.dto.request.ResendOtpRequest;
import com.pcshop.auth_service.dto.request.ForgotPasswordRequest;
import com.pcshop.auth_service.dto.request.ResetPasswordRequest;
import com.pcshop.auth_service.dto.response.AuthResponse;
import com.pcshop.auth_service.dto.response.UserResponse;
import com.pcshop.auth_service.dto.response.RegisterResponse;
import com.pcshop.auth_service.exception.BadRequestException;
import com.pcshop.auth_service.model.Account;
import com.pcshop.auth_service.model.AddressDetails;
import com.pcshop.auth_service.model.RefreshToken;
import com.pcshop.auth_service.model.Otp;
import com.pcshop.auth_service.repository.AccountRepository;
import com.pcshop.auth_service.repository.RefreshTokenRepository;
import com.pcshop.auth_service.repository.OtpRepository;
import com.pcshop.auth_service.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;
import java.util.Random;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;

    public RegisterResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        String normalizedPhone = StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null;

        // Check unique constraints
        if (accountRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException(AuthConstants.ERROR_EMAIL_EXISTS);
        }
        if (StringUtils.hasText(normalizedPhone) && accountRepository.existsByPhone(normalizedPhone)) {
            throw new BadRequestException(AuthConstants.ERROR_PHONE_EXISTS);
        }

        // Build address_details if provided
        AddressDetails addressDetails = null;
        if (request.getHouseNumber() != null || request.getStreet() != null) {
            addressDetails = AddressDetails.builder()
                    .houseNumber(request.getHouseNumber())
                    .street(request.getStreet())
                    .ward(request.getWard())
                    .province(request.getProvince())
                    .build();
        }

        // Create account with "unverified" status
        Account account = Account.builder()
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .email(normalizedEmail)
                .phone(normalizedPhone)
                .addressDetails(addressDetails)
                .status(AuthConstants.STATUS_UNVERIFIED)  // Set to unverified until OTP is confirmed
                .build();

        account = accountRepository.save(account);
        log.info("New unverified account created: {}", account.getEmail());

        generateAndSendOtp(normalizedEmail);
        
        return RegisterResponse.builder()
                .message("Mã OTP đã được gửi đến email của bạn")
                .email(normalizedEmail)
                .otpExpiresIn(AuthConstants.OTP_EXPIRY_MINUTES * 60)
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        Account account = accountRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            throw new BadCredentialsException(AuthConstants.ERROR_INVALID_CREDENTIALS);
        }

        if (!AuthConstants.STATUS_ACTIVE.equals(account.getStatus())) {
            String email = account.getEmail().trim().toLowerCase();
            generateAndSendOtp(email);
            throw new BadRequestException(AuthConstants.ERROR_ACCOUNT_NOT_VERIFIED);
        }

        log.info("User logged in: {}", account.getEmail());
        return generateAuthResponse(account);
    }

    public AuthResponse refresh(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_INVALID_REFRESH_TOKEN));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BadRequestException(AuthConstants.ERROR_REFRESH_TOKEN_EXPIRED);
        }

        Account account = accountRepository.findById(refreshToken.getAccountId())
                .orElseThrow(() -> new BadRequestException("Account not found"));

        // Delete old refresh token and generate new pair
        refreshTokenRepository.delete(refreshToken);

        log.info("Token refreshed for user: {}", account.getEmail());
        return generateAuthResponse(account);
    }

    public void logout(String accountId) {
        refreshTokenRepository.deleteByAccountId(accountId);
        log.info("User logged out, tokens cleared for accountId: {}", accountId);
    }

    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // Validate OTP code format (must be 6 digits)
        if (request.getCode() == null || !request.getCode().matches("\\d{" + AuthConstants.OTP_LENGTH + "}")) {
            throw new BadRequestException(AuthConstants.ERROR_INVALID_OTP_FORMAT);
        }

        // Find OTP
        Otp otp = otpRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_OTP_EXPIRED));

        if (otp.isExpired()) {
            otpRepository.delete(otp);
            throw new BadRequestException(AuthConstants.ERROR_OTP_EXPIRED);
        }

        if (!otp.getCode().equals(request.getCode())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            
            if (otp.getAttempts() >= AuthConstants.MAX_OTP_ATTEMPTS) {
                otpRepository.delete(otp);
                throw new BadRequestException(AuthConstants.ERROR_TOO_MANY_ATTEMPTS);
            }
            throw new BadRequestException(AuthConstants.ERROR_INVALID_OTP);
        }

        // Find and activate account
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_ACCOUNT_NOT_FOUND));

        account.setStatus(AuthConstants.STATUS_ACTIVE);
        accountRepository.save(account);
        
        // Delete OTP
        otpRepository.delete(otp);

        log.info("Account verified and activated: {}", normalizedEmail);

        // Return auth response (auto login)
        return generateAuthResponse(account);
    }

    public RegisterResponse resendOtp(ResendOtpRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // Find account
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_ACCOUNT_NOT_FOUND));

        if (AuthConstants.STATUS_ACTIVE.equals(account.getStatus())) {
            throw new BadRequestException(AuthConstants.ERROR_ACCOUNT_ALREADY_VERIFIED);
        }

        generateAndSendOtp(normalizedEmail);

        return RegisterResponse.builder()
                .message("Mã OTP mới đã được gửi đến email của bạn")
                .email(normalizedEmail)
                .otpExpiresIn(AuthConstants.OTP_EXPIRY_MINUTES * 60)
                .build();
    }

    public RegisterResponse forgotPassword(ForgotPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // Find account — must exist and be active
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_ACCOUNT_NOT_FOUND));

        if (!AuthConstants.STATUS_ACTIVE.equals(account.getStatus())) {
            throw new BadRequestException("Account is not active. Please verify your account first.");
        }

        generateAndSendOtp(normalizedEmail);

        log.info("Password reset OTP sent to: {}", normalizedEmail);
        return RegisterResponse.builder()
                .message("Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn")
                .email(normalizedEmail)
                .otpExpiresIn(AuthConstants.OTP_EXPIRY_MINUTES * 60)
                .build();
    }

    public void resetPassword(ResetPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // Validate OTP code format
        if (request.getCode() == null || !request.getCode().matches("\\d{" + AuthConstants.OTP_LENGTH + "}")) {
            throw new BadRequestException(AuthConstants.ERROR_INVALID_OTP_FORMAT);
        }

        // Find and validate OTP
        Otp otp = otpRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_OTP_EXPIRED));

        if (otp.isExpired()) {
            otpRepository.delete(otp);
            throw new BadRequestException(AuthConstants.ERROR_OTP_EXPIRED);
        }

        if (!otp.getCode().equals(request.getCode())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);

            if (otp.getAttempts() >= AuthConstants.MAX_OTP_ATTEMPTS) {
                otpRepository.delete(otp);
                throw new BadRequestException(AuthConstants.ERROR_TOO_MANY_ATTEMPTS);
            }
            throw new BadRequestException(AuthConstants.ERROR_INVALID_OTP);
        }

        // Find account and update password
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException(AuthConstants.ERROR_ACCOUNT_NOT_FOUND));

        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accountRepository.save(account);

        // Clean up OTP and refresh tokens
        otpRepository.delete(otp);
        refreshTokenRepository.deleteByAccountId(account.getId());

        log.info("Password reset successful for: {}", normalizedEmail);
    }

    private String generateOtpCode() {
        Random random = new Random();
        int otp = (int) Math.pow(10, AuthConstants.OTP_LENGTH - 1) + random.nextInt((int) (Math.pow(10, AuthConstants.OTP_LENGTH) - Math.pow(10, AuthConstants.OTP_LENGTH - 1)));
        return String.valueOf(otp);
    }

    private void generateAndSendOtp(String normalizedEmail) {
        String otpCode = generateOtpCode();
        Instant expiresAt = Instant.now().plusSeconds(AuthConstants.OTP_EXPIRY_MINUTES * 60);

        otpRepository.deleteByEmail(normalizedEmail);

        Otp otp = Otp.builder()
                .email(normalizedEmail)
                .code(otpCode)
                .expiresAt(expiresAt)
                .createdAt(Instant.now())
                .attempts(0)
                .build();

        otpRepository.save(otp);
        emailService.sendOtpEmail(normalizedEmail, otpCode);
    }

    private AuthResponse generateAuthResponse(Account account) {
        String accessToken = jwtTokenProvider.generateAccessToken(
                account.getId(), account.getEmail(), account.getRole());

        String refreshTokenStr = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .token(refreshTokenStr)
                .accountId(account.getId())
                .expiresAt(Instant.now().plusMillis(jwtTokenProvider.getRefreshTokenExpirationMs()))
                .createdAt(Instant.now())
                .build();

        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getAccessTokenExpirationMs() / 1000)
                .user(toUserResponse(account))
                .build();
    }

    private UserResponse toUserResponse(Account account) {
        return UserResponse.builder()
                .id(account.getId())
                .email(account.getEmail())
                .fullName(account.getFullName())
                .phone(account.getPhone())
                .role(account.getRole())
                .status(account.getStatus())
                .addressDetails(account.getAddressDetails())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
