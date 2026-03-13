package com.pcshop.order_service.service;

import com.pcshop.order_service.client.ProductClient;
import com.pcshop.order_service.client.ProductDto;
import com.pcshop.order_service.dto.request.CartItemRequest;
import com.pcshop.order_service.dto.response.ApiResponse;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.model.Cart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private ProductClient productClient;

    @InjectMocks
    private CartService cartService;

    private final String accountId = "user123";

    @BeforeEach
    void setUp() {
        // leniency for tests that don't need this
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void testGetCart_Empty() {
        when(valueOperations.get("cart:" + accountId)).thenReturn(null);

        Cart cart = cartService.getCart(accountId);

        assertNotNull(cart);
        assertTrue(cart.getItems().isEmpty());
    }

    @Test
    void testAddItem_ProductNotFound() {
        CartItemRequest request = new CartItemRequest();
        request.setProductId("prod1");
        request.setQuantity(1);

        when(productClient.getProductById("prod1")).thenReturn(ApiResponse.error("Not found"));

        assertThrows(BadRequestException.class, () -> cartService.addItem(accountId, request));
    }

    @Test
    void testAddItem_SuccessNewItem() {
        CartItemRequest request = new CartItemRequest();
        request.setProductId("prod1");
        request.setQuantity(2);

        ProductDto productDto = new ProductDto();
        productDto.setId("prod1");
        productDto.setName("Test Product");
        productDto.setPrice(1000L);

        when(productClient.getProductById("prod1")).thenReturn(ApiResponse.ok(productDto));
        
        Cart emptyCart = Cart.builder().items(new ArrayList<>()).build();
        when(valueOperations.get("cart:" + accountId)).thenReturn(emptyCart);

        Cart cart = cartService.addItem(accountId, request);

        assertNotNull(cart);
        assertEquals(1, cart.getItems().size());
        assertEquals("prod1", cart.getItems().get(0).getProductId());
        assertEquals("Test Product", cart.getItems().get(0).getProductName());
        assertEquals(1000L, cart.getItems().get(0).getPrice());
        assertEquals(2, cart.getItems().get(0).getQuantity());

        verify(valueOperations, times(1)).set(eq("cart:" + accountId), eq(cart), anyLong(), any());
    }
}
