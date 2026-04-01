package com.pcshop.product_service.service;

import com.pcshop.product_service.config.CacheConfig;
import com.pcshop.product_service.config.ProductConstants;
import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.repository.CategoryRepository;
import com.pcshop.product_service.repository.ProductRepository;
import com.pcshop.product_service.util.InputValidationUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final MongoTemplate mongoTemplate;

    // MongoDB index recommendations (referenced for documentation):
    // db.products.createIndex({ categoryId: 1, price: 1 })
    // db.products.createIndex({ categoryId: 1, "specs_raw.Thương hiệu": 1 })
    // db.products.createIndex({ "specs_raw.Thương hiệu": 1 })
    // db.categories.createIndex({ is_active: 1 })
    // db.categories.createIndex({ code: 1 }, { unique: true })
    public Page<Product> getAllProducts(Pageable pageable, boolean includeInactiveCategory) {
        if (includeInactiveCategory) {
            return productRepository.findAll(pageable);
        }
        return findWithActiveCategoryFilter(new Criteria(), pageable);
    }

    public Product getProductById(String id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));
    }

    public Product getProductById(String id, boolean includeInactiveCategory) {
        Product product = getProductById(id);
        if (!includeInactiveCategory && !isCategoryActive(product.getCategoryId())) {
            throw new ResourceNotFoundException("Product", "id", id);
        }
        return product;
    }

    public Page<Product> getProductsByCategory(String categoryId, Pageable pageable) {
        return getProductsByCategory(categoryId, pageable, false);
    }

    public Page<Product> getProductsByCategory(String categoryId, Pageable pageable, boolean includeInactiveCategory) {
        Optional<String> catId = parseObjectId(categoryId);
        if (catId.isEmpty()) {
            return Page.empty(pageable);
        }

        if (includeInactiveCategory) {
            return productRepository.findByCategoryId(catId.get(), pageable);
        }

        return findWithActiveCategoryFilter(
                Criteria.where(ProductConstants.FIELD_CATEGORY_ID).is(new ObjectId(catId.get())),
                pageable);
    }

    public Page<Product> searchProducts(String keyword, String categoryId, Pageable pageable) {
        return searchProducts(keyword, categoryId, pageable, false);
    }

    public Page<Product> searchProducts(String keyword, String categoryId, Pageable pageable,
            boolean includeInactiveCategory) {
        Optional<String> keywordOpt = Optional.ofNullable(keyword).filter(k -> !k.trim().isEmpty());
        if (keywordOpt.isEmpty()) {
            return Page.empty(pageable);
        }

        Optional<String> catId = parseObjectId(categoryId);

        String sanitizedKeyword = InputValidationUtil.validateSearchKeyword(keyword);
        Criteria baseCriteria = MongoQueryBuilder.builder()
                .withSearchKeyword(Optional.of(sanitizedKeyword))
                .withCategoryId(catId)
                .build();

        if (includeInactiveCategory) {
            return executePaginatedQuery(baseCriteria, pageable);
        }

        return findWithActiveCategoryFilter(baseCriteria, pageable);
    }

    public Page<Product> filterByPriceRange(String categoryId, Long minPrice, Long maxPrice, Pageable pageable) {
        if (categoryId == null || categoryId.trim().isEmpty()) {
            return Page.empty(pageable);
        }
        return productRepository.findByCategoryAndPriceRange(categoryId, minPrice, maxPrice, pageable);
    }

    public Page<Product> filterByPriceRange(String categoryId, Long minPrice, Long maxPrice, Pageable pageable,
            boolean includeInactiveCategory) {
        // Validate price range
        InputValidationUtil.validatePriceRange(minPrice, maxPrice);

        Optional<String> catId = parseObjectId(categoryId);
        if (catId.isEmpty()) {
            return Page.empty(pageable);
        }

        Criteria baseCriteria = MongoQueryBuilder.builder()
                .withCategoryId(catId)
                .withPriceRange(Optional.ofNullable(minPrice), Optional.ofNullable(maxPrice))
                .build();

        if (includeInactiveCategory) {
            return executePaginatedQuery(baseCriteria, pageable);
        }

        return findWithActiveCategoryFilter(baseCriteria, pageable);
    }

    @CacheEvict(cacheNames = CacheConfig.BRANDS_CACHE, allEntries = true)
    public Product createProduct(ProductRequest request) {
        if (!categoryRepository.existsById(request.getCategoryId())) {
            throw new ResourceNotFoundException("Category", "id", request.getCategoryId());
        }

        try {
            Product product = Product.builder()
                    .categoryId(request.getCategoryId())
                    .name(request.getName())
                    .model(request.getModel())
                    .url(request.getUrl())
                    .price(request.getPrice())
                    .image(request.getImage())
                    .socket(request.getSocket())
                    .ramType(request.getRamType())
                    .hasIGpu(request.getHasIgpu())
                    .iGpuName(request.getIgpuName())
                    .tdpW(request.getTdpW())
                    .cores(request.getCores())
                    .threads(request.getThreads())
                    .baseClockGhz(request.getBaseClockGhz())
                    .boostClockGhz(request.getBoostClockGhz())
                    .formFactor(request.getFormFactor())
                    .capacityGb(request.getCapacityGb())
                    .color(request.getColor())
                    .specsRaw(request.getSpecsRaw())
                    .build();

            product = productRepository.save(product);
            return product;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(ProductConstants.ERROR_INVALID_CATEGORY_ID + request.getCategoryId());
        }
    }

    @CacheEvict(cacheNames = CacheConfig.BRANDS_CACHE, allEntries = true)
    public Product updateProduct(String id, ProductRequest request) {
        Product product = getProductById(id);

        Optional.ofNullable(request.getCategoryId()).ifPresent(categoryId -> {
            if (!categoryRepository.existsById(categoryId)) {
                throw new ResourceNotFoundException("Category", "id", categoryId);
            }
            product.setCategoryId(categoryId);
        });

        updateProductField(product::setName, request.getName());
        updateProductField(product::setModel, request.getModel());
        updateProductField(product::setUrl, request.getUrl());
        updateProductField(product::setPrice, request.getPrice());
        updateProductField(product::setImage, request.getImage());
        updateProductField(product::setSocket, request.getSocket());
        updateProductField(product::setRamType, request.getRamType());
        updateProductField(product::setHasIGpu, request.getHasIgpu());
        updateProductField(product::setIGpuName, request.getIgpuName());
        updateProductField(product::setTdpW, request.getTdpW());
        updateProductField(product::setCores, request.getCores());
        updateProductField(product::setThreads, request.getThreads());
        updateProductField(product::setBaseClockGhz, request.getBaseClockGhz());
        updateProductField(product::setBoostClockGhz, request.getBoostClockGhz());
        updateProductField(product::setFormFactor, request.getFormFactor());
        updateProductField(product::setCapacityGb, request.getCapacityGb());
        updateProductField(product::setColor, request.getColor());
        updateProductField(product::setSpecsRaw, request.getSpecsRaw());
        updateProductField(product::setDescriptionHtml, request.getDescriptionHtml());

        return productRepository.save(product);
    }

    private <T> void updateProductField(Consumer<T> setter, T value) {
        if (value != null) {
            setter.accept(value);
        }
    }

    @CacheEvict(cacheNames = CacheConfig.BRANDS_CACHE, allEntries = true)
    public void deleteProduct(String id) {
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Product", "id", id);
        }
        productRepository.deleteById(id);
        log.info("Product deleted: {}", id);
    }

    @Cacheable(cacheNames = CacheConfig.BRANDS_CACHE)
    public List<String> getBrands() {
        // findDistinct chỉ lấy field brand thay vì load full document.
        List<String> brands = mongoTemplate.findDistinct(new Query(), ProductConstants.FIELD_BRAND, Product.class,
                String.class);

        return brands.stream()
                .filter(b -> b != null && !b.trim().isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    public Page<Product> searchBySpec(String specField, String specValue, String categoryId, Pageable pageable) {
        return searchBySpec(specField, specValue, categoryId, pageable, false);
    }

    public Page<Product> searchBySpec(String specField, String specValue, String categoryId, Pageable pageable,
            boolean includeInactiveCategory) {
        // Validate and sanitize inputs to prevent NoSQL injection
        InputValidationUtil.validateSpecField(specField);
        String sanitizedValue = InputValidationUtil.sanitizeSpecValue(specValue);

        if (sanitizedValue.isEmpty()) {
            return Page.empty(pageable);
        }

        Optional<String> catId = parseObjectId(categoryId);

        Criteria baseCriteria = MongoQueryBuilder.builder()
                .withSpecField(Optional.of(specField), Optional.of(sanitizedValue))
                .withCategoryId(catId)
                .build();

        if (includeInactiveCategory) {
            return executePaginatedQuery(baseCriteria, pageable);
        }

        return findWithActiveCategoryFilter(baseCriteria, pageable);
    }

    private Page<Product> executePaginatedQuery(Criteria criteria, Pageable pageable) {
        Query query = new Query(criteria).with(pageable);
        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), Product.class);
        List<Product> content = mongoTemplate.find(query, Product.class);
        return new PageImpl<>(content, pageable, total);
    }

    private Page<Product> findWithActiveCategoryFilter(Criteria productCriteria, Pageable pageable) {
        List<AggregationOperation> baseOperations = buildBaseAggregationOperations(productCriteria);
        List<AggregationOperation> dataPipeline = buildDataPipeline(pageable);
        baseOperations.add(createFacetOperation(dataPipeline));

        Aggregation aggregation = Aggregation.newAggregation(baseOperations);
        AggregationResults<Document> results = mongoTemplate.aggregate(aggregation,
                ProductConstants.COLLECTION_PRODUCTS, Document.class);

        return toProductPage(results.getUniqueMappedResult(), pageable);
    }

    private List<AggregationOperation> buildBaseAggregationOperations(Criteria productCriteria) {
        List<AggregationOperation> operations = new ArrayList<>();
        operations.add(Aggregation.match(productCriteria));
        operations.add(Aggregation.lookup(ProductConstants.COLLECTION_CATEGORIES, ProductConstants.FIELD_CATEGORY_ID,
                ProductConstants.FIELD_ID, ProductConstants.CATEGORY_DOCS_FIELD));
        operations.add(Aggregation.unwind(ProductConstants.CATEGORY_DOCS_FIELD));
        operations.add(Aggregation.match(Criteria.where(ProductConstants.CATEGORY_ACTIVE_FIELD).is(true)));
        return operations;
    }

    private List<AggregationOperation> buildDataPipeline(Pageable pageable) {
        List<AggregationOperation> pipeline = new ArrayList<>();
        if (pageable.getSort().isSorted()) {
            pipeline.add(Aggregation.sort(pageable.getSort()));
        }
        pipeline.add(Aggregation.skip((long) pageable.getPageNumber() * pageable.getPageSize()));
        pipeline.add(Aggregation.limit(pageable.getPageSize()));
        return pipeline;
    }

    private AggregationOperation createFacetOperation(List<AggregationOperation> dataPipeline) {
        return Aggregation.facet(dataPipeline.toArray(new AggregationOperation[0]))
                .as("data")
                .and(Aggregation.count().as("total"))
                .as("meta");
    }

    private Page<Product> toProductPage(Document facetResult, Pageable pageable) {
        if (facetResult == null) {
            return Page.empty(pageable);
        }

        List<Document> rows = facetResult.getList("data", Document.class);
        List<Product> content = Optional.ofNullable(rows)
                .orElseGet(List::of)
                .stream()
                .map(doc -> mongoTemplate.getConverter().read(Product.class, doc))
                .toList();

        long total = extractTotalFromMeta(facetResult.getList("meta", Document.class));
        return new PageImpl<>(content, pageable, total);
    }

    private long extractTotalFromMeta(List<Document> meta) {
        return Optional.ofNullable(meta)
                .filter(m -> !m.isEmpty())
                .map(m -> m.get(0))
                .map(doc -> doc.get("total"))
                .filter(Number.class::isInstance)
                .map(Number.class::cast)
                .map(Number::longValue)
                .orElse(0L);
    }

    private Optional<String> parseObjectId(String value) {
        return Optional.ofNullable(value)
                .map(String::trim)
                .filter(v -> !v.isEmpty() && ObjectId.isValid(v));
    }

    @Cacheable(cacheNames = CacheConfig.ACTIVE_CATEGORIES_CACHE, key = "#categoryId")
    private boolean isCategoryActive(String categoryId) {
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

    private boolean isValidSpecField(String specField) {
        return Optional.ofNullable(specField)
                .map(ProductConstants.ALLOWED_SPEC_FIELDS::contains)
                .orElse(false);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
