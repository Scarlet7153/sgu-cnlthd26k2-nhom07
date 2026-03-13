package com.pcshop.user_service.service;

import com.pcshop.user_service.dto.request.LoginRequest;
import com.pcshop.user_service.dto.request.RefreshTokenRequest;
import com.pcshop.user_service.dto.request.RegisterRequest;
import com.pcshop.user_service.dto.response.AuthResponse;
import com.pcshop.user_service.dto.response.UserResponse;
import com.pcshop.user_service.exception.BadRequestException;
import com.pcshop.user_service.model.Account;
import com.pcshop.user_service.model.AddressDetails;
import com.pcshop.user_service.model.RefreshToken;
import com.pcshop.user_service.repository.AccountRepository;
import com.pcshop.user_service.repository.RefreshTokenRepository;
import com.pcshop.user_service.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthResponse register(RegisterRequest request) {
        // Check unique constraints
        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username already exists");
        }
        if (accountRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already exists");
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

        // Create account
        Account account = Account.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .email(request.getEmail().toLowerCase())
                .phone(request.getPhone())
                .addressDetails(addressDetails)
                .build();

        account = accountRepository.save(account);
        log.info("New account registered: {}", account.getUsername());

        return generateAuthResponse(account);
    }

    public AuthResponse login(LoginRequest request) {
        Account account = accountRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            throw new BadCredentialsException("Invalid username or password");
        }

        if (!"active".equals(account.getStatus())) {
            throw new BadRequestException("Account is " + account.getStatus());
        }

        log.info("User logged in: {}", account.getUsername());
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

        log.info("Token refreshed for user: {}", account.getUsername());
        return generateAuthResponse(account);
    }

    public void logout(String accountId) {
        refreshTokenRepository.deleteByAccountId(accountId);
        log.info("User logged out, tokens cleared for accountId: {}", accountId);
    }

    private AuthResponse generateAuthResponse(Account account) {
        String accessToken = jwtTokenProvider.generateAccessToken(
                account.getId(), account.getUsername(), account.getRole());

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
                .username(account.getUsername())
                .name(account.getName())
                .email(account.getEmail())
                .phone(account.getPhone())
                .role(account.getRole())
                .status(account.getStatus())
                .addressDetails(account.getAddressDetails())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
