package com.pcshop.product_service.service;

import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.repository.CategoryRepository;
import com.pcshop.product_service.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final MongoTemplate mongoTemplate;
    
    // Cache brands in memory (simple caching)
    private volatile List<String> cachedBrands = null;
    private volatile long brandsCacheTTL = 0;
    private static final long CACHE_TTL_MILLIS = 5 * 60 * 1000; // 5 minutes

    public Page<Product> getAllProducts(Pageable pageable) {
        return productRepository.findAll(pageable);
    }

    public Product getProductById(String id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));
    }

    public Page<Product> getProductsByCategory(String categoryId, Pageable pageable) {
        if (categoryId == null || categoryId.trim().isEmpty()) {
            return Page.empty(pageable);
        }
        return productRepository.findByCategoryId(categoryId, pageable);
    }

    public Page<Product> searchProducts(String keyword, String categoryId, Pageable pageable) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return Page.empty(pageable);
        }

        List<String> tokens = Arrays.stream(keyword.trim().split("\\s+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(6)
                .collect(Collectors.toList());

        if (tokens.isEmpty()) {
            return Page.empty(pageable);
        }

        // Build "contains all tokens" regex per field, e.g. (?i)(?=.*AMD)(?=.*9800x3d).*
        String lookAheadRegex = tokens.stream()
                .map(token -> "(?=.*" + Pattern.quote(token) + ")")
                .collect(Collectors.joining("", "", ".*"));

        Criteria searchCriteria = new Criteria().orOperator(
                Criteria.where("name").regex(lookAheadRegex, "i"),
                Criteria.where("model").regex(lookAheadRegex, "i"),
                Criteria.where("socket").regex(lookAheadRegex, "i")
        );

        Query query;
        if (categoryId != null && !categoryId.trim().isEmpty()) {
            query = new Query(new Criteria().andOperator(
                    Criteria.where("categoryId").is(categoryId),
                    searchCriteria
            ));
        } else {
            query = new Query(searchCriteria);
        }

        long total = mongoTemplate.count(query, Product.class);
        query.with(pageable);
        List<Product> content = mongoTemplate.find(query, Product.class);

        return new PageImpl<>(content, pageable, total);
    }

    public Page<Product> filterByPriceRange(String categoryId, Long minPrice, Long maxPrice, Pageable pageable) {
        if (categoryId == null || categoryId.trim().isEmpty()) {
            return Page.empty(pageable);
        }
        return productRepository.findByCategoryAndPriceRange(categoryId, minPrice, maxPrice, pageable);
    }

    public Product createProduct(ProductRequest request) {
        // Validate categoryId exists
        if (!categoryRepository.existsById(request.getCategoryId())) {
            throw new ResourceNotFoundException("Category", "id", request.getCategoryId());
        }

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
    }

    public Product updateProduct(String id, ProductRequest request) {
        Product product = getProductById(id);

        if (request.getCategoryId() != null) {
            if (!categoryRepository.existsById(request.getCategoryId())) {
                throw new ResourceNotFoundException("Category", "id", request.getCategoryId());
            }
            product.setCategoryId(request.getCategoryId());
        }

        if (request.getName() != null) product.setName(request.getName());
        if (request.getModel() != null) product.setModel(request.getModel());
        if (request.getUrl() != null) product.setUrl(request.getUrl());
        if (request.getPrice() != null) product.setPrice(request.getPrice());
        if (request.getImage() != null) product.setImage(request.getImage());
        if (request.getSocket() != null) product.setSocket(request.getSocket());
        if (request.getRamType() != null) product.setRamType(request.getRamType());
        if (request.getHasIgpu() != null) product.setHasIGpu(request.getHasIgpu());
        if (request.getIgpuName() != null) product.setIGpuName(request.getIgpuName());
        if (request.getTdpW() != null) product.setTdpW(request.getTdpW());
        if (request.getCores() != null) product.setCores(request.getCores());
        if (request.getThreads() != null) product.setThreads(request.getThreads());
        if (request.getBaseClockGhz() != null) product.setBaseClockGhz(request.getBaseClockGhz());
        if (request.getBoostClockGhz() != null) product.setBoostClockGhz(request.getBoostClockGhz());
        if (request.getFormFactor() != null) product.setFormFactor(request.getFormFactor());
        if (request.getCapacityGb() != null) product.setCapacityGb(request.getCapacityGb());
        if (request.getColor() != null) product.setColor(request.getColor());
        if (request.getSpecsRaw() != null) product.setSpecsRaw(request.getSpecsRaw());

        product = productRepository.save(product);
        return product;
    }

    public void deleteProduct(String id) {
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Product", "id", id);
        }
        productRepository.deleteById(id);
        log.info("Product deleted: {}", id);
    }

    public List<String> getBrands() {
        // Check if cache is valid
        long now = System.currentTimeMillis();
        if (cachedBrands != null && (now - brandsCacheTTL) < CACHE_TTL_MILLIS) {
            return cachedBrands;
        }

        Query query = new Query();
        List<String> brands = mongoTemplate.findDistinct(query, "specs_raw.Thương hiệu", Product.class, String.class);
        
        List<String> cleanedBrands = brands.stream()
                .filter(b -> b != null && !b.trim().isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        // Update cache
        cachedBrands = cleanedBrands;
        brandsCacheTTL = now;
        
        return cleanedBrands;
    }

    /**
     * Search products by a specific spec field (e.g., type, efficiency, case_type, cooler_type)
     * Handles specs stored in specsRaw map
     */
    public Page<Product> searchBySpec(String specField, String specValue, String categoryId, Pageable pageable) {
        if (specValue == null || specValue.trim().isEmpty()) {
            return Page.empty(pageable);
        }

        Query query;
        if (categoryId != null && !categoryId.trim().isEmpty()) {
            try {
                ObjectId catId = new ObjectId(categoryId);
                query = new Query(new Criteria().andOperator(
                        Criteria.where("categoryId").is(catId),
                        Criteria.where("specs_raw." + specField).is(specValue)
                ));
            } catch (IllegalArgumentException e) {
                return Page.empty(pageable);
            }
        } else {
            query = new Query(Criteria.where("specs_raw." + specField).is(specValue));
        }

        long total = mongoTemplate.count(query, Product.class);
        query.with(pageable);
        List<Product> content = mongoTemplate.find(query, Product.class);

        return new PageImpl<>(content, pageable, total);
    }

}

