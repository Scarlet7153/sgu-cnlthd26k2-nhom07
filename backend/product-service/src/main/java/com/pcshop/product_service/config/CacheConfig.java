package com.pcshop.product_service.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
@SuppressWarnings({"null", "unchecked"})
public class CacheConfig {

    public static final String BRANDS_CACHE = "brands";
    public static final String ACTIVE_CATEGORIES_CACHE = "activeCategories";
    public static final String CATEGORY_BY_CODE_CACHE = "categoryByCode";
    public static final String PRODUCT_BY_ID_CACHE = "productById";
    public static final String PRODUCT_LIST_CACHE = "productList";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();

        // Register per-cache Caffeine specs for optimal memory/hit-rate balance
        manager.registerCustomCache(BRANDS_CACHE, Caffeine.newBuilder()
                .expireAfterWrite(30, TimeUnit.MINUTES) // brands rarely change
                .maximumSize(1)
                .recordStats()
                .build());

        manager.registerCustomCache(ACTIVE_CATEGORIES_CACHE, Caffeine.newBuilder()
                .expireAfterWrite(30, TimeUnit.MINUTES) // categories rarely change
                .maximumSize(50)
                .recordStats()
                .build());

        manager.registerCustomCache(CATEGORY_BY_CODE_CACHE, Caffeine.newBuilder()
                .expireAfterWrite(30, TimeUnit.MINUTES)
                .maximumSize(100)
                .recordStats()
                .build());

        manager.registerCustomCache(PRODUCT_BY_ID_CACHE, Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES) // products update more often
                .maximumSize(500)
                .recordStats()
                .build());

        // Cache for paginated product list queries (high-traffic endpoints)
        manager.registerCustomCache(PRODUCT_LIST_CACHE, Caffeine.newBuilder()
                .expireAfterWrite(2, TimeUnit.MINUTES) // short TTL for listing freshness
                .maximumSize(200) // ~200 unique page/category/sort combinations
                .recordStats()
                .build());

        return manager;
    }
}
