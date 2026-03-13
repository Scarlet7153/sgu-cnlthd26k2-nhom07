package com.pcshop.user_service.service;

import com.pcshop.user_service.dto.request.UpdateProfileRequest;
import com.pcshop.user_service.dto.request.UpdateStatusRequest;
import com.pcshop.user_service.dto.response.UserResponse;
import com.pcshop.user_service.exception.BadRequestException;
import com.pcshop.user_service.exception.ResourceNotFoundException;
import com.pcshop.user_service.model.Account;
import com.pcshop.user_service.model.AddressDetails;
import com.pcshop.user_service.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final AccountRepository accountRepository;

    // ==================== Profile ====================

    public UserResponse getProfile(String accountId) {
        Account account = findAccountById(accountId);
        return toUserResponse(account);
    }

    public UserResponse updateProfile(String accountId, UpdateProfileRequest request) {
        Account account = findAccountById(accountId);

        if (StringUtils.hasText(request.getName())) {
            account.setName(request.getName());
        }
        if (StringUtils.hasText(request.getEmail())) {
            // Check email unique
            accountRepository.findByEmail(request.getEmail().toLowerCase())
                    .filter(a -> !a.getId().equals(accountId))
                    .ifPresent(a -> { throw new BadRequestException("Email already in use"); });
            account.setEmail(request.getEmail().toLowerCase());
        }
        if (StringUtils.hasText(request.getPhone())) {
            account.setPhone(request.getPhone());
        }

        // Update address_details
        if (request.getHouseNumber() != null || request.getStreet() != null
                || request.getWard() != null || request.getProvince() != null) {
            AddressDetails current = account.getAddressDetails();
            if (current == null) {
                current = new AddressDetails();
            }
            if (request.getHouseNumber() != null) current.setHouseNumber(request.getHouseNumber());
            if (request.getStreet() != null) current.setStreet(request.getStreet());
            if (request.getWard() != null) current.setWard(request.getWard());
            if (request.getProvince() != null) current.setProvince(request.getProvince());
            account.setAddressDetails(current);
        }

        account = accountRepository.save(account);
        log.info("Profile updated for user: {}", account.getUsername());
        return toUserResponse(account);
    }

    // ==================== Admin Operations ====================

    public Page<UserResponse> getAllUsers(Pageable pageable) {
        return accountRepository.findAll(pageable).map(this::toUserResponse);
    }

    public UserResponse getUserById(String userId) {
        Account account = findAccountById(userId);
        return toUserResponse(account);
    }

    public UserResponse updateUserStatus(String userId, UpdateStatusRequest request) {
        Account account = findAccountById(userId);

        List<String> validStatuses = List.of("active", "inactive", "banned");
        if (!validStatuses.contains(request.getStatus())) {
            throw new BadRequestException("Invalid status. Must be one of: " + validStatuses);
        }

        account.setStatus(request.getStatus());
        account = accountRepository.save(account);
        log.info("User {} status updated to {}", account.getUsername(), request.getStatus());
        return toUserResponse(account);
    }

    // ==================== Helpers ====================

    private Account findAccountById(String id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", id));
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
