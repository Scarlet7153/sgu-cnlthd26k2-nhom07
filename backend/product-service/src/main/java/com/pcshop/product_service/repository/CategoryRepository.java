package com.pcshop.product_service.repository;

import com.pcshop.product_service.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends MongoRepository<Category, String> {
    Optional<Category> findByCode(String code);
    boolean existsByCode(String code);
    List<Category> findByIsActive(Boolean isActive);
}
