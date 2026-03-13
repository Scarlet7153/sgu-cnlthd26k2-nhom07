package com.pcshop.product_service.service;

import com.pcshop.product_service.dto.request.ProductRequest;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Product;
import com.pcshop.product_service.repository.CategoryRepository;
import com.pcshop.product_service.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

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

    public Page<Product> searchProducts(String keyword, Pageable pageable) {
        return productRepository.searchByName(keyword, pageable);
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
}
