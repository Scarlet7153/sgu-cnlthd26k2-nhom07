package com.pcshop.order_service.controller;

import com.pcshop.order_service.dto.request.CartItemRequest;
import com.pcshop.order_service.dto.response.ApiResponse;
import com.pcshop.order_service.model.Cart;
import com.pcshop.order_service.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<ApiResponse<Cart>> getCart(
            @RequestHeader("X-User-Id") String accountId) {
        Cart cart = cartService.getCart(accountId);
        return ResponseEntity.ok(ApiResponse.ok(cart));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<Cart>> addItem(
            @RequestHeader("X-User-Id") String accountId,
            @Valid @RequestBody CartItemRequest request) {
        Cart cart = cartService.addItem(accountId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Item added to cart", cart));
    }

    @PutMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<Cart>> updateItemQuantity(
            @RequestHeader("X-User-Id") String accountId,
            @PathVariable String productId,
            @RequestParam Integer quantity) {
        Cart cart = cartService.updateItemQuantity(accountId, productId, quantity);
        return ResponseEntity.ok(ApiResponse.ok("Cart updated", cart));
    }

    @DeleteMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<Cart>> removeItem(
            @RequestHeader("X-User-Id") String accountId,
            @PathVariable String productId) {
        Cart cart = cartService.removeItem(accountId, productId);
        return ResponseEntity.ok(ApiResponse.ok("Item removed", cart));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> clearCart(
            @RequestHeader("X-User-Id") String accountId) {
        cartService.clearCart(accountId);
        return ResponseEntity.ok(ApiResponse.ok("Cart cleared", null));
    }
}
