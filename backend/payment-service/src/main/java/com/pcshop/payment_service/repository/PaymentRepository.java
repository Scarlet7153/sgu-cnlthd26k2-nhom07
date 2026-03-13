package com.pcshop.payment_service.repository;

import com.pcshop.payment_service.model.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends MongoRepository<Payment, String> {
    Optional<Payment> findByOrderId(String orderId);
    List<Payment> findByAccountId(String accountId);
    Page<Payment> findByStatus(String status, Pageable pageable);
    Page<Payment> findByAccountId(String accountId, Pageable pageable);
}
