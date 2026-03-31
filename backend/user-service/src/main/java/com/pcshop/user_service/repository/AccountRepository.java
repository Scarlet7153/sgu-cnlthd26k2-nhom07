package com.pcshop.user_service.repository;

import com.pcshop.user_service.model.Account;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AccountRepository extends MongoRepository<Account, String> {
    Optional<Account> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    Page<Account> findByStatus(String status, Pageable pageable);
}
