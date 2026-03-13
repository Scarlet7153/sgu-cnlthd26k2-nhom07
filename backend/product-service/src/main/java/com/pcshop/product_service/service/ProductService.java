package com.pcshop.product_service.service;

import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.repository.CategoryRepository;
import com.pcshop.product_service.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    public Page<Product> getAllProducts(Pageable pageable) {
        return productRepository.findAll(pageable);
    }

    public Product getProductById(String id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));
    }

    public Page<Product> getProductsByCategory(String categoryID, Pageable pageable) {
        return productRepository.findByCategoryID(categoryID, pageable);
    }

    public Page<Product> searchProducts(String keyword, String categoryID, Pageable pageable) {
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
        if (categoryID != null && !categoryID.trim().isEmpty()) {
            query = new Query(new Criteria().andOperator(
                Criteria.where("categoryID").is(categoryID.trim()),
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

    public Page<Product> filterByPriceRange(String categoryID, Long minPrice, Long maxPrice, Pageable pageable) {
        return productRepository.findByCategoryAndPriceRange(categoryID, minPrice, maxPrice, pageable);
    }

    public Product createProduct(ProductRequest request) {
        // Validate categoryID exists
        if (!categoryRepository.existsById(request.getCategoryID())) {
            throw new ResourceNotFoundException("Category", "id", request.getCategoryID());
        }

        Product product = Product.builder()
                .categoryID(request.getCategoryID())
                .name(request.getName())
                .model(request.getModel())
                .url(request.getUrl())
                .price(request.getPrice())
                .image(request.getImage())
                .socket(request.getSocket())
                .ramType(request.getRamType())
                .hasIgpu(request.getHasIgpu())
                .igpuName(request.getIgpuName())
                .tdpW(request.getTdpW())
                .cores(request.getCores())
                .threads(request.getThreads())
                .baseClockGhz(request.getBaseClockGhz())
                .boostClockGhz(request.getBoostClockGhz())
                .specsRaw(request.getSpecsRaw())
                .build();

        product = productRepository.save(product);
        log.info("Product created: {} (id={})", product.getName(), product.getId());
        return product;
    }

    public Product updateProduct(String id, ProductRequest request) {
        Product product = getProductById(id);

        if (request.getCategoryID() != null) {
            if (!categoryRepository.existsById(request.getCategoryID())) {
                throw new ResourceNotFoundException("Category", "id", request.getCategoryID());
            }
            product.setCategoryID(request.getCategoryID());
        }

        if (request.getName() != null) product.setName(request.getName());
        if (request.getModel() != null) product.setModel(request.getModel());
        if (request.getUrl() != null) product.setUrl(request.getUrl());
        if (request.getPrice() != null) product.setPrice(request.getPrice());
        if (request.getImage() != null) product.setImage(request.getImage());
        if (request.getSocket() != null) product.setSocket(request.getSocket());
        if (request.getRamType() != null) product.setRamType(request.getRamType());
        if (request.getHasIgpu() != null) product.setHasIgpu(request.getHasIgpu());
        if (request.getIgpuName() != null) product.setIgpuName(request.getIgpuName());
        if (request.getTdpW() != null) product.setTdpW(request.getTdpW());
        if (request.getCores() != null) product.setCores(request.getCores());
        if (request.getThreads() != null) product.setThreads(request.getThreads());
        if (request.getBaseClockGhz() != null) product.setBaseClockGhz(request.getBaseClockGhz());
        if (request.getBoostClockGhz() != null) product.setBoostClockGhz(request.getBoostClockGhz());
        if (request.getSpecsRaw() != null) product.setSpecsRaw(request.getSpecsRaw());

        product = productRepository.save(product);
        log.info("Product updated: {} (id={})", product.getName(), product.getId());
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
        Query query = new Query();
        List<String> brands = mongoTemplate.findDistinct(query, "specs_raw.Thương hiệu", Product.class, String.class);
        return brands.stream()
                .filter(b -> b != null && !b.trim().isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }
}
