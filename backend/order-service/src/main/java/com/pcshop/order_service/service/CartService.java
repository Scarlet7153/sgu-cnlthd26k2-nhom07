package com.pcshop.order_service.service;

import com.pcshop.order_service.client.ProductClient;
import com.pcshop.order_service.client.ProductDto;
import com.pcshop.order_service.dto.request.CartItemRequest;
import com.pcshop.order_service.dto.response.ApiResponse;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.model.Cart;
import com.pcshop.order_service.model.CartItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ProductClient productClient;
    private static final String CART_KEY_PREFIX = "cart:";
    private static final long CART_TTL_DAYS = 7;

    public Cart getCart(String accountId) {
        Cart cart = (Cart) redisTemplate.opsForValue().get(cartKey(accountId));
        return cart != null ? cart : Cart.builder().items(new ArrayList<>()).build();
    }

    public Cart addItem(String accountId, CartItemRequest request) {
        // Retrieve actual product data to trust pricing
        ApiResponse<ProductDto> productResponse = productClient.getProductById(request.getProductId());
        if (!productResponse.isSuccess() || productResponse.getData() == null) {
            throw new BadRequestException("Product not found or unavailable");
        }
        ProductDto product = productResponse.getData();

        Cart cart = getCart(accountId);

        // Check if product already in cart → update quantity
        CartItem existing = cart.getItems().stream()
                .filter(item -> item.getProductId().equals(request.getProductId()))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + request.getQuantity());
            existing.setPrice(product.getPrice());
            existing.setProductName(product.getName());
        } else {
            cart.getItems().add(CartItem.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .price(product.getPrice())
                    .quantity(request.getQuantity())
                    .build());
        }

        cart.setUpdatedAt(Instant.now());
        saveCart(accountId, cart);
        log.info("Cart updated for account: {}", accountId);
        return cart;
    }

    public Cart updateItemQuantity(String accountId, String productId, Integer quantity) {
        Cart cart = getCart(accountId);

        CartItem item = cart.getItems().stream()
                .filter(i -> i.getProductId().equals(productId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Product not found in cart"));

        if (quantity <= 0) {
            cart.getItems().remove(item);
        } else {
            item.setQuantity(quantity);
        }

        cart.setUpdatedAt(Instant.now());
        saveCart(accountId, cart);
        return cart;
    }

    public Cart removeItem(String accountId, String productId) {
        Cart cart = getCart(accountId);
        cart.getItems().removeIf(item -> item.getProductId().equals(productId));
        cart.setUpdatedAt(Instant.now());
        saveCart(accountId, cart);
        return cart;
    }

    public void clearCart(String accountId) {
        redisTemplate.delete(cartKey(accountId));
        log.info("Cart cleared for account: {}", accountId);
    }

    private void saveCart(String accountId, Cart cart) {
        redisTemplate.opsForValue().set(cartKey(accountId), cart, CART_TTL_DAYS, TimeUnit.DAYS);
    }

    private String cartKey(String accountId) {
        return CART_KEY_PREFIX + accountId;
    }
}
