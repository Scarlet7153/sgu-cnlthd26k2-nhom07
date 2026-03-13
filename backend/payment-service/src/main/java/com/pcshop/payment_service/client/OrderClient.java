package com.pcshop.payment_service.client;

import com.pcshop.payment_service.dto.response.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "order-service", path = "/api/orders")
public interface OrderClient {

    @PutMapping("/{id}/payment-status")
    ApiResponse<Void> updatePaymentStatus(
            @RequestHeader("X-User-Id") String adminId,
            @PathVariable("id") String orderId,
            @RequestBody UpdateOrderPaymentStatusRequest request);
}
