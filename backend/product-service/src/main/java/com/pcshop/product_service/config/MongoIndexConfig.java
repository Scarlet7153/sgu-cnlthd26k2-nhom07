package com.pcshop.product_service.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import lombok.extern.slf4j.Slf4j;

/**
 * Programmatic MongoDB index creation for product_db.
 * 
 * Ensures compound indexes exist on startup. These indexes are critical for:
 * - Category + price range filter queries
 * - Category + brand spec field queries
 * - Text search across name field
 * - Brand aggregation (distinct) queries
 *
 * INDEX RECOMMENDATIONS (also documented here for DBA reference):
 * db.products.createIndex({ categoryId: 1, price: 1 })
 * db.products.createIndex({ categoryId: 1, "specs_raw.Thương hiệu": 1 })
 * db.products.createIndex({ "specs_raw.Thương hiệu": 1 })
 * db.products.createIndex({ name: "text", model: "text" })
 * db.categories.createIndex({ is_active: 1 })
 * db.categories.createIndex({ code: 1 }, { unique: true })
 */
@Slf4j
@Configuration
public class MongoIndexConfig {

    @Bean
    CommandLineRunner ensureIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            log.info("Ensuring MongoDB indexes for product_db...");

            // Compound: categoryId + price — used by filterByPriceRange
            mongoTemplate.indexOps("products").ensureIndex(
                    new Index()
                            .on("categoryId", Sort.Direction.ASC)
                            .on("price", Sort.Direction.ASC)
                            .named("idx_category_price"));

            // Compound: categoryId + brand spec — used by searchBySpec(brand)
            mongoTemplate.indexOps("products").ensureIndex(
                    new Index()
                            .on("categoryId", Sort.Direction.ASC)
                            .on("specs_raw.Thương hiệu", Sort.Direction.ASC)
                            .named("idx_category_brand"));

            // Single: brand spec — used by getBrands() aggregation
            mongoTemplate.indexOps("products").ensureIndex(
                    new Index()
                            .on("specs_raw.Thương hiệu", Sort.Direction.ASC)
                            .named("specs_brand_idx"));

            // Single: is_active on categories — used by $lookup + $match in aggregation
            mongoTemplate.indexOps("categories").ensureIndex(
                    new Index()
                            .on("is_active", Sort.Direction.ASC)
                            .named("idx_is_active"));

            log.info("MongoDB indexes ensured successfully.");
        };
    }
}
