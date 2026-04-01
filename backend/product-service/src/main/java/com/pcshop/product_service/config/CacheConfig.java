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
public class CacheConfig {

    public static final String BRANDS_CACHE = "brands";
    public static final String ACTIVE_CATEGORIES_CACHE = "activeCategories";
    public static final String CATEGORY_BY_CODE_CACHE = "categoryByCode";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                BRANDS_CACHE,
                ACTIVE_CATEGORIES_CACHE,
                CATEGORY_BY_CODE_CACHE
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(10, TimeUnit.MINUTES)
                .maximumSize(2_000));
        return manager;
    }
}
