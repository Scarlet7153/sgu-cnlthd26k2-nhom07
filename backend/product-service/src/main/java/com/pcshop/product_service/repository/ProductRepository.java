package com.pcshop.product_service.repository;

import com.pcshop.product_service.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {

    @org.springframework.data.mongodb.repository.Query(value = "{ 'categoryID': ?0 }")
    Page<Product> findByCategoryID(String categoryID, Pageable pageable);

    @org.springframework.data.mongodb.repository.Query(value = "{ 'categoryID': ?0 }")
    List<Product> findByCategoryID(String categoryID);

    Page<Product> findBySocket(String socket, Pageable pageable);

    @Query(value = "{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<Product> searchByName(String keyword, Pageable pageable);

    @Query(value = "{ 'categoryID': ?0, 'price': { $gte: ?1, $lte: ?2 } }")
    Page<Product> findByCategoryAndPriceRange(String categoryID, Long minPrice, Long maxPrice, Pageable pageable);

    long countByCategoryID(String categoryID);
}
