package com.pcshop.payment_service.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "momo")
public class MomoProperties {
    private String partnerCode;
    private String accessKey;
    private String secretKey;
    private String apiEndpoint;
    private String redirectUrl;
    private String ipnUrl;
    private String requestType;
}
