package com.pcshop.product_service.controller;

import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.dto.response.ApiResponse;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.service.ProductService;
import com.pcshop.product_service.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Slf4j
public class ProductController {

    private final ProductService productService;
    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Product>>> getAllProducts(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long minPrice,
            @RequestParam(required = false) Long maxPrice,
            @RequestParam(defaultValue = "false") boolean includeInactiveCategory,
            // Additional filters for subcategories
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String efficiency,
            @RequestParam(required = false) String case_type,
            @RequestParam(required = false) String cooler_type,
            @PageableDefault(size = 20) Pageable pageable) {
        
        // Normalize: use 'q' or 'search', prefer 'q' if both provided
        String keyword = (q != null && !q.trim().isEmpty()) ? q : search;
        
        try {
            // Case 1: Search + Category filter
            if (keyword != null && !keyword.trim().isEmpty() && category != null && !category.trim().isEmpty()) {
                String categoryId = resolveCategoryCode(category);
                Page<Product> products = productService.searchProducts(keyword, categoryId, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 2: Only search
            if (keyword != null && !keyword.trim().isEmpty()) {
                Page<Product> products = productService.searchProducts(keyword, null, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 3: Category + optional price filter
            if (category != null && !category.trim().isEmpty()) {
                String categoryId = resolveCategoryCode(category);
                long min = minPrice != null ? minPrice : 0L;
                long max = maxPrice != null ? maxPrice : 999999999L;
                Page<Product> products = productService.filterByPriceRange(categoryId, min, max, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 4: Type filter (e.g., RAM subcategories: DDR5, DDR4, DDR3)
            if (type != null && !type.trim().isEmpty()) {
                String categoryId = resolveCategoryCode("RAM");
                Page<Product> products = productService.searchBySpec("type", type, categoryId, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 5: Efficiency filter (e.g., PSU subcategories)
            if (efficiency != null && !efficiency.trim().isEmpty()) {
                String categoryId = resolveCategoryCode("PSU");
                Page<Product> products = productService.searchBySpec("efficiency", efficiency, categoryId, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 6: Case type filter (e.g., CASE subcategories)
            if (case_type != null && !case_type.trim().isEmpty()) {
                String categoryId = resolveCategoryCode("CASE");
                Page<Product> products = productService.searchBySpec("case_type", case_type, categoryId, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 7: Cooler type filter (e.g., COOLER subcategories)
            if (cooler_type != null && !cooler_type.trim().isEmpty()) {
                String categoryId = resolveCategoryCode("COOLER");
                Page<Product> products = productService.searchBySpec("cooler_type", cooler_type, categoryId, pageable, includeInactiveCategory);
                return ResponseEntity.ok(ApiResponse.ok(products));
            }
            
            // Case 8: No filters - return all
            Page<Product> products = productService.getAllProducts(pageable, includeInactiveCategory);
            return ResponseEntity.ok(ApiResponse.ok(products));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(ApiResponse.ok(Page.empty(pageable)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Error fetching products: " + e.getMessage()));
        }
    }
    
    /**
     * Resolve category code (e.g., "mainboard", "vga") to MongoDB ObjectId
     * Returns the ID if found, otherwise returns the input as-is
     */
    private String resolveCategoryCode(String code) {
        try {
            return categoryService.getCategoryByCode(code.toUpperCase()).getId();
        } catch (Exception ex) {
            return code;
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Product>> getProductById(
            @PathVariable String id,
            @RequestParam(defaultValue = "false") boolean includeInactiveCategory) {
        Product product = productService.getProductById(id, includeInactiveCategory);
        return ResponseEntity.ok(ApiResponse.ok(product));
    }

    @GetMapping("/category/{code}")
    public ResponseEntity<ApiResponse<Page<Product>>> getProductsByCategory(
            @PathVariable String code,
            @RequestParam(defaultValue = "false") boolean includeInactiveCategory,
            @PageableDefault(size = 20) Pageable pageable) {
        // Try to resolve category code to its DB id; if resolution fails, treat the path variable as an id
        String categoryId;
        try {
            categoryId = categoryService.getCategoryByCode(code.toUpperCase()).getId();
        } catch (Exception ex) {
            categoryId = code;
        }

        Page<Product> products = productService.getProductsByCategory(categoryId, pageable, includeInactiveCategory);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<Product>>> searchProducts(
            @RequestParam String keyword,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "false") boolean includeInactiveCategory,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.searchProducts(keyword, categoryId, pageable, includeInactiveCategory);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/filter")
    public ResponseEntity<ApiResponse<Page<Product>>> filterProducts(
            @RequestParam String categoryId,
            @RequestParam(defaultValue = "0") Long minPrice,
            @RequestParam(defaultValue = "999999999") Long maxPrice,
            @RequestParam(defaultValue = "false") boolean includeInactiveCategory,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.filterByPriceRange(categoryId, minPrice, maxPrice, pageable, includeInactiveCategory);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Product>> createProduct(
            @Valid @RequestBody ProductRequest request) {
        Product product = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Product created", product));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Product>> updateProduct(
            @PathVariable String id,
            @Valid @RequestBody ProductRequest request) {
        Product product = productService.updateProduct(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Product updated", product));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(@PathVariable String id) {
        productService.deleteProduct(id);
        return ResponseEntity.ok(ApiResponse.ok("Product deleted", null));
    }

    @GetMapping("/brands")
    public ResponseEntity<ApiResponse<java.util.List<String>>> getBrands() {
        java.util.List<String> brands = productService.getBrands();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(ApiResponse.ok(brands));
    }
}
