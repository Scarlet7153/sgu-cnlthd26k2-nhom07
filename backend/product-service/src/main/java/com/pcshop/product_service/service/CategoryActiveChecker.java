package com.pcshop.product_service.service;

import com.pcshop.product_service.config.CacheConfig;
import com.pcshop.product_service.config.ProductConstants;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Extracted from ProductService to fix a critical caching bug:
 * Spring @Cacheable uses proxy-based AOP, so it does NOT intercept
 * private method calls within the same class. The original
 * ProductService.isCategoryActive() was private + @Cacheable → cache
 * was NEVER populated, causing a DB roundtrip on every call.
 *
 * By extracting to a separate @Component, the Spring proxy intercepts
 * the call correctly and the cache works as intended.
 *
 * Uses mongoTemplate.exists() (returns boolean, no document loaded).
 */
@Component
@RequiredArgsConstructor
public class CategoryActiveChecker {

    private final MongoTemplate mongoTemplate;

    /**
     * Check if a category is active (cached per categoryId, 30min TTL).
     * Uses exists() query — lightweight boolean check, no full document load.
     */
    @Cacheable(cacheNames = CacheConfig.ACTIVE_CATEGORIES_CACHE, key = "#categoryId")
    public boolean isCategoryActive(String categoryId) {
        return Optional.ofNullable(categoryId)
                .map(String::trim)
                .filter(ObjectId::isValid)
                .map(id -> {
                    Query query = new Query(new Criteria().andOperator(
                            Criteria.where(ProductConstants.FIELD_ID).is(new ObjectId(id)),
                            Criteria.where(ProductConstants.FIELD_IS_ACTIVE).is(true)));
                    return mongoTemplate.exists(query, ProductConstants.COLLECTION_CATEGORIES);
                })
                .orElse(false);
    }
}
