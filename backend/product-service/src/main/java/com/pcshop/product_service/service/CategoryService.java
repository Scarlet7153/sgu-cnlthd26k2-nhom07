package com.pcshop.product_service.service;

import com.pcshop.product_service.dto.request.CategoryRequest;
import com.pcshop.product_service.exception.BadRequestException;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Category;
import com.pcshop.product_service.model.Subcategory;
import com.pcshop.product_service.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    // In-memory cache for active categories
    private volatile List<Category> cachedActiveCategories = null;
    private volatile long activeCategoriesCacheTTL = 0;
    private static final long CACHE_TTL_MILLIS = 10 * 60 * 1000; // 10 minutes

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    public List<Category> getActiveCategories() {
        long now = System.currentTimeMillis();
        if (cachedActiveCategories != null && (now - activeCategoriesCacheTTL) < CACHE_TTL_MILLIS) {
            return cachedActiveCategories;
        }
        List<Category> categories = categoryRepository.findByIsActive(true);
        cachedActiveCategories = categories;
        activeCategoriesCacheTTL = now;
        return categories;
    }

    public Category getCategoryById(String id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
    }

    public Category getCategoryByCode(String code) {
        return categoryRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "code", code));
    }

    public Category createCategory(CategoryRequest request) {
        if (categoryRepository.existsByCode(request.getCode())) {
            throw new BadRequestException("Category code already exists: " + request.getCode());
        }

        Category category = Category.builder()
                .code(request.getCode().toUpperCase())
                .name(request.getName())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .subcategory(mapSubcategories(request.getSubcategory()))
                .build();

        category = categoryRepository.save(category);
        clearCache();
        return category;
    }

    public Category updateCategory(String id, CategoryRequest request) {
        Category category = getCategoryById(id);

        // Check code uniqueness if changing
        if (!category.getCode().equals(request.getCode()) &&
                categoryRepository.existsByCode(request.getCode())) {
            throw new BadRequestException("Category code already exists: " + request.getCode());
        }

        category.setCode(request.getCode().toUpperCase());
        category.setName(request.getName());
        if (request.getIsActive() != null) {
            category.setIsActive(request.getIsActive());
        }
        if (request.getSubcategory() != null) {
            category.setSubcategory(mapSubcategories(request.getSubcategory()));
        }

        category = categoryRepository.save(category);
        clearCache();
        return category;
    }

    public void deleteCategory(String id) {
        if (!categoryRepository.existsById(id)) {
            throw new ResourceNotFoundException("Category", "id", id);
        }
        categoryRepository.deleteById(id);
        clearCache();
    }

    private void clearCache() {
        cachedActiveCategories = null;
        activeCategoriesCacheTTL = 0;
    }

    private List<Subcategory> mapSubcategories(List<CategoryRequest.SubcategoryRequest> requests) {
        if (requests == null) return new ArrayList<>();
        return requests.stream()
                .map(r -> Subcategory.builder()
                        .name(r.getName())
                        .filterQuery(r.getFilterQuery())
                        .build())
                .collect(Collectors.toList());
    }
}
