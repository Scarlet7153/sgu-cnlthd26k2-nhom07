package com.pcshop.product_service.service;

import com.pcshop.product_service.config.ProductConstants;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Encapsulates MongoDB query building logic with fluent API.
 * Promotes Single Responsibility Principle by separating query construction concerns from business logic.
 * Refactored from large buildKeywordCriteria into smaller, testable methods.
 */
public class MongoQueryBuilder {

    private final List<Criteria> criteria;

    private MongoQueryBuilder(List<Criteria> criteria) {
        this.criteria = new ArrayList<>(criteria);
    }

    public static MongoQueryBuilder builder() {
        return new MongoQueryBuilder(new ArrayList<>());
    }

    /**
     * Adds category ID criteria if provided.
     */
    public MongoQueryBuilder withCategoryId(Optional<ObjectId> categoryId) {
        categoryId.ifPresent(id -> criteria.add(Criteria.where(ProductConstants.FIELD_CATEGORY_ID).is(id)));
        return this;
    }

    /**
     * Adds price range criteria: minPrice <= price <= maxPrice.
     */
    public MongoQueryBuilder withPriceRange(Optional<Long> minPrice, Optional<Long> maxPrice) {
        if (minPrice.isPresent() || maxPrice.isPresent()) {
            Criteria priceCriteria = Criteria.where(ProductConstants.FIELD_PRICE);
            if (minPrice.isPresent()) {
                priceCriteria = priceCriteria.gte(minPrice.get());
            }
            if (maxPrice.isPresent()) {
                priceCriteria = priceCriteria.lte(maxPrice.get());
            }
            criteria.add(priceCriteria);
        }
        return this;
    }

    /**
     * Adds spec field criteria with field validation and value trimming.
     */
    public MongoQueryBuilder withSpecField(Optional<String> specField, Optional<String> specValue) {
        if (specField.isPresent() && specValue.isPresent()) {
            String field = specField.get();
            String value = specValue.get().trim();
            if (!value.isEmpty()) {
                criteria.add(Criteria.where(ProductConstants.FIELD_SPECS_RAW + "." + field).is(value));
            }
        }
        return this;
    }

    /**
     * Adds keyword search criteria across multiple fields using lookahead regex.
     * Splits keyword by whitespace, limits to MAX_SEARCH_TOKENS tokens, 
     * and matches all tokens in name/model/socket.
     */
    public MongoQueryBuilder withSearchKeyword(Optional<String> keyword) {
        keyword.filter(k -> !k.trim().isEmpty()).ifPresent(k -> {
            Criteria searchCriteria = buildKeywordCriteria(k);
            criteria.add(searchCriteria);
        });
        return this;
    }

    /**
     * Builds the final Criteria with AND logic across all added criteria.
     */
    public Criteria build() {
        return criteria.isEmpty()
                ? new Criteria()
                : new Criteria().andOperator(criteria.toArray(new Criteria[0]));
    }

    /**
     * Builds keyword search criteria using lookahead regex for multi-field matching.
     * Extracted method to improve readability and testability.
     */
    private Criteria buildKeywordCriteria(String keyword) {
        List<String> tokens = tokenizeKeyword(keyword);
        
        if (tokens.isEmpty()) {
            return new Criteria();
        }

        String lookAheadRegex = buildLookaheadPattern(tokens);
        return buildSearchCriteria(lookAheadRegex);
    }

    /**
     * Tokenize keyword and limit to MAX_SEARCH_TOKENS to prevent DoS.
     */
    private List<String> tokenizeKeyword(String keyword) {
        return Arrays.asList(keyword.trim().split("\\s+"))
                .stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(ProductConstants.MAX_SEARCH_TOKENS)
                .collect(Collectors.toUnmodifiableList());
    }

    /**
     * Build lookahead regex pattern for multi-token matching.
     */
    private String buildLookaheadPattern(List<String> tokens) {
        return tokens.stream()
                .map(token -> "(?=.*" + Pattern.quote(token) + ")")
                .collect(Collectors.joining("", "", ".*"));
    }

    /**
     * Build search criteria across name, model, and socket fields.
     */
    private Criteria buildSearchCriteria(String pattern) {
        return new Criteria().orOperator(
                Criteria.where(ProductConstants.FIELD_NAME).regex(pattern, "i"),
                Criteria.where(ProductConstants.FIELD_MODEL).regex(pattern, "i"),
                Criteria.where(ProductConstants.FIELD_SOCKET).regex(pattern, "i")
        );
    }
}
