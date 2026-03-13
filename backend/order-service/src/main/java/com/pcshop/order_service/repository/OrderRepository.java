package com.pcshop.order_service.repository;

import com.pcshop.order_service.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {
    Page<Order> findByAccountId(String accountId, Pageable pageable);
    Page<Order> findByStatus(String status, Pageable pageable);
    Page<Order> findByAccountIdAndStatus(String accountId, String status, Pageable pageable);
}
