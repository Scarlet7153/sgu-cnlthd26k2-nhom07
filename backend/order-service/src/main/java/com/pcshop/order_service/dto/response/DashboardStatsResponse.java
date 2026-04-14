package com.pcshop.order_service.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DashboardStatsResponse {

    // Overview
    private long totalOrders;
    private long totalRevenue;
    private long totalUsers;
    private long totalProducts;

    // Orders by status
    private Map<String, Long> ordersByStatus;

    // Revenue by status (only non-cancelled)
    private Map<String, Long> revenueByStatus;

    // Payment method breakdown
    private Map<String, Long> ordersByPaymentMethod;

    // Recent orders summary (last 7 days)
    private List<DailyStats> dailyRevenue;

    // Top products by quantity sold
    private List<TopProduct> topProducts;

    // Order status percentages
    private Map<String, Double> orderStatusPercentages;

    // Average order value
    private long averageOrderValue;

    // Cancel rate
    private double cancelRate;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DailyStats {
        private String date;
        private long revenue;
        private long orderCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TopProduct {
        private String productId;
        private String productName;
        private long totalQuantity;
        private long totalRevenue;
    }
}
