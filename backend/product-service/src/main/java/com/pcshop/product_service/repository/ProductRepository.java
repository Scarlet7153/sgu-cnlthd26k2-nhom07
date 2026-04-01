package com.pcshop.product_service.repository;

import com.pcshop.product_service.model.Product;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {

    Page<Product> findByCategoryId(String categoryId, Pageable pageable);

    @org.springframework.data.mongodb.repository.Query(value = "{ 'categoryId': ?0 }")
    List<Product> findByCategoryId(String categoryId);

    Page<Product> findBySocket(String socket, Pageable pageable);

    @Query(value = "{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<Product> searchByName(String keyword, Pageable pageable);

    @Query(value = "{ 'categoryId': ?0, 'price': { $gte: ?1, $lte: ?2 } }")
    Page<Product> findByCategoryAndPriceRange(String categoryId, Long minPrice, Long maxPrice, Pageable pageable);

    long countByCategoryId(String categoryId);
}
