package com.pcshop.auth_service.service;

import com.pcshop.auth_service.dto.request.LoginRequest;
import com.pcshop.auth_service.dto.request.RefreshTokenRequest;
import com.pcshop.auth_service.dto.request.RegisterRequest;
import com.pcshop.auth_service.dto.request.VerifyOtpRequest;
import com.pcshop.auth_service.dto.request.ResendOtpRequest;
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

    private static final long OTP_EXPIRY_MINUTES = 15;

    public RegisterResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        String normalizedPhone = StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null;

        // Check unique constraints
        if (accountRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("Email already exists");
        }
        if (StringUtils.hasText(normalizedPhone) && accountRepository.existsByPhone(normalizedPhone)) {
            throw new BadRequestException("Phone already exists");
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
                .status("unverified")  // Set to unverified until OTP is confirmed
                .build();

        account = accountRepository.save(account);
        log.info("New unverified account created: {}", account.getEmail());

        generateAndSendOtp(normalizedEmail);
        
        return RegisterResponse.builder()
                .message("Mã OTP đã được gửi đến email của bạn")
                .email(normalizedEmail)
                .otpExpiresIn(OTP_EXPIRY_MINUTES * 60)
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        Account account = accountRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        if (!"active".equals(account.getStatus())) {
            String email = account.getEmail().trim().toLowerCase();
            generateAndSendOtp(email);
            throw new BadRequestException("Account not verified. New OTP has been sent to your email");
        }

        log.info("User logged in: {}", account.getEmail());
        return generateAuthResponse(account);
    }

    public AuthResponse refresh(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BadRequestException("Refresh token has expired");
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

        // Find OTP
        Otp otp = otpRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("OTP not found or expired"));

        if (otp.isExpired()) {
            otpRepository.delete(otp);
            throw new BadRequestException("OTP has expired");
        }

        if (!otp.getCode().equals(request.getCode())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            
            if (otp.getAttempts() >= 5) {
                otpRepository.delete(otp);
                throw new BadRequestException("Too many failed attempts. Please request a new OTP");
            }
            throw new BadRequestException("Invalid OTP code");
        }

        // Find and activate account
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("Account not found"));

        account.setStatus("active");
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
                .orElseThrow(() -> new BadRequestException("Account not found"));

        if ("active".equals(account.getStatus())) {
            throw new BadRequestException("Account is already verified");
        }

        generateAndSendOtp(normalizedEmail);

        return RegisterResponse.builder()
                .message("Mã OTP mới đã được gửi đến email của bạn")
                .email(normalizedEmail)
                .otpExpiresIn(OTP_EXPIRY_MINUTES * 60)
                .build();
    }

    private String generateOtpCode() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000); // 6-digit number
        return String.valueOf(otp);
    }

    private void generateAndSendOtp(String normalizedEmail) {
        String otpCode = generateOtpCode();
        Instant expiresAt = Instant.now().plusSeconds(OTP_EXPIRY_MINUTES * 60);

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
