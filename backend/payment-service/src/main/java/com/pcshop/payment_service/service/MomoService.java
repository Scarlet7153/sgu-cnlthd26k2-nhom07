package com.pcshop.payment_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcshop.payment_service.config.MomoProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MomoService {

    private final MomoProperties momoProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Create a MoMo payment URL.
     * Returns a Map with { payUrl, requestId, orderId, ... }
     */
    public Map<String, String> createPaymentUrl(String orderId, Long amount, String orderInfo) {
        try {
            String requestId = UUID.randomUUID().toString();
            String extraData = ""; // base64 encoded extra data

            // Build raw signature string per MoMo v2 spec
            String rawSignature = String.format(
                    "accessKey=%s&amount=%d&extraData=%s&ipnUrl=%s&orderId=%s&orderInfo=%s&partnerCode=%s&redirectUrl=%s&requestId=%s&requestType=%s",
                    momoProperties.getAccessKey(),
                    amount,
                    extraData,
                    momoProperties.getIpnUrl(),
                    orderId,
                    orderInfo,
                    momoProperties.getPartnerCode(),
                    momoProperties.getRedirectUrl(),
                    requestId,
                    momoProperties.getRequestType()
            );

            String signature = hmacSHA256(momoProperties.getSecretKey(), rawSignature);

            // Build request body
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("partnerCode", momoProperties.getPartnerCode());
            requestBody.put("partnerName", "PC Shop");
            requestBody.put("storeId", "PCShopStore");
            requestBody.put("requestId", requestId);
            requestBody.put("amount", amount);
            requestBody.put("orderId", orderId);
            requestBody.put("orderInfo", orderInfo);
            requestBody.put("redirectUrl", momoProperties.getRedirectUrl());
            requestBody.put("ipnUrl", momoProperties.getIpnUrl());
            requestBody.put("lang", "vi");
            requestBody.put("requestType", momoProperties.getRequestType());
            requestBody.put("autoCapture", true);
            requestBody.put("extraData", extraData);
            requestBody.put("signature", signature);

            String jsonBody = objectMapper.writeValueAsString(requestBody);
            log.info("MoMo create payment request: {}", jsonBody);

            // Send HTTP POST to MoMo API
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(momoProperties.getApiEndpoint()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            log.info("MoMo response: {}", httpResponse.body());

            JsonNode responseNode = objectMapper.readTree(httpResponse.body());

            Map<String, String> result = new HashMap<>();
            result.put("requestId", requestId);
            result.put("orderId", orderId);
            result.put("payUrl", responseNode.has("payUrl") ? responseNode.get("payUrl").asText() : null);
            result.put("resultCode", responseNode.has("resultCode") ? responseNode.get("resultCode").asText() : null);
            result.put("message", responseNode.has("message") ? responseNode.get("message").asText() : null);
            result.put("responseBody", httpResponse.body());

            return result;

        } catch (Exception e) {
            log.error("MoMo payment creation failed", e);
            throw new RuntimeException("Failed to create MoMo payment: " + e.getMessage(), e);
        }
    }

    /**
     * Verify MoMo IPN callback signature.
     */
    public boolean verifySignature(Map<String, Object> callbackData) {
        try {
            String rawSignature = String.format(
                    "accessKey=%s&amount=%s&extraData=%s&message=%s&orderId=%s&orderInfo=%s&orderType=%s&partnerCode=%s&payType=%s&requestId=%s&responseTime=%s&resultCode=%s&transId=%s",
                    momoProperties.getAccessKey(),
                    callbackData.getOrDefault("amount", ""),
                    callbackData.getOrDefault("extraData", ""),
                    callbackData.getOrDefault("message", ""),
                    callbackData.getOrDefault("orderId", ""),
                    callbackData.getOrDefault("orderInfo", ""),
                    callbackData.getOrDefault("orderType", ""),
                    momoProperties.getPartnerCode(),
                    callbackData.getOrDefault("payType", ""),
                    callbackData.getOrDefault("requestId", ""),
                    callbackData.getOrDefault("responseTime", ""),
                    callbackData.getOrDefault("resultCode", ""),
                    callbackData.getOrDefault("transId", "")
            );

            String expectedSignature = hmacSHA256(momoProperties.getSecretKey(), rawSignature);
            String receivedSignature = (String) callbackData.get("signature");

            boolean valid = expectedSignature.equals(receivedSignature);
            if (!valid) {
                log.warn("MoMo signature mismatch! Expected: {}, Received: {}", expectedSignature, receivedSignature);
            }
            return valid;

        } catch (Exception e) {
            log.error("MoMo signature verification failed", e);
            return false;
        }
    }

    private String hmacSHA256(String secretKey, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
