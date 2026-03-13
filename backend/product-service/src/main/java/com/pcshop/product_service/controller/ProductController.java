package com.pcshop.product_service.controller;

import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.dto.response.ApiResponse;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Product>>> getAllProducts(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.getAllProducts(pageable);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Product>> getProductById(@PathVariable String id) {
        Product product = productService.getProductById(id);
        return ResponseEntity.ok(ApiResponse.ok(product));
    }

    @GetMapping("/category/{categoryID}")
    public ResponseEntity<ApiResponse<Page<Product>>> getProductsByCategory(
            @PathVariable String categoryID,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.getProductsByCategory(categoryID, pageable);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<Product>>> searchProducts(
            @RequestParam String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.searchProducts(keyword, pageable);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/filter")
    public ResponseEntity<ApiResponse<Page<Product>>> filterProducts(
            @RequestParam String categoryID,
            @RequestParam(defaultValue = "0") Long minPrice,
            @RequestParam(defaultValue = "999999999") Long maxPrice,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Product> products = productService.filterByPriceRange(categoryID, minPrice, maxPrice, pageable);
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
}
