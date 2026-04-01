package com.pcshop.product_service.service;

import com.pcshop.product_service.dto.request.CategoryRequest;
import com.pcshop.product_service.exception.BadRequestException;
import com.pcshop.product_service.exception.ResourceNotFoundException;
import com.pcshop.product_service.model.Category;
import com.pcshop.product_service.model.Subcategory;
import com.pcshop.product_service.repository.CategoryRepository;
import com.pcshop.product_service.config.CacheConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    @Cacheable(cacheNames = CacheConfig.ACTIVE_CATEGORIES_CACHE)
    public List<Category> getActiveCategories() {
        return categoryRepository.findByIsActive(true);
    }

    public Category getCategoryById(String id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
    }

    @Cacheable(cacheNames = CacheConfig.CATEGORY_BY_CODE_CACHE, key = "#code.toUpperCase()")
    public Category getCategoryByCode(String code) {
        return categoryRepository.findByCode(code.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "code", code));
    }

    @CacheEvict(cacheNames = {CacheConfig.ACTIVE_CATEGORIES_CACHE, CacheConfig.CATEGORY_BY_CODE_CACHE}, allEntries = true)
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
        return category;
    }

    @CacheEvict(cacheNames = {CacheConfig.ACTIVE_CATEGORIES_CACHE, CacheConfig.CATEGORY_BY_CODE_CACHE}, allEntries = true)
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
        return category;
    }

    @CacheEvict(cacheNames = {CacheConfig.ACTIVE_CATEGORIES_CACHE, CacheConfig.CATEGORY_BY_CODE_CACHE}, allEntries = true)
    public void deleteCategory(String id) {
        if (!categoryRepository.existsById(id)) {
            throw new ResourceNotFoundException("Category", "id", id);
        }
        categoryRepository.deleteById(id);
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
