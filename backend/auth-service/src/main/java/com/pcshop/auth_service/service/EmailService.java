package com.pcshop.auth_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {
    
    private final JavaMailSender mailSender;

    public void sendOtpEmail(String email, String otp) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("noreply@pcshop.com");
            message.setTo(email);
            message.setSubject("PCShop - Mã xác thực OTP");
            message.setText(buildOtpEmailBody(otp));

            mailSender.send(message);
            log.info("OTP email sent to: {}", email);
        } catch (Exception e) {
            log.error("Failed to send OTP email to: {}", email, e);
            throw new RuntimeException("Failed to send OTP email", e);
        }
    }

    private String buildOtpEmailBody(String otp) {
        return String.format(
                "Mã xác thực của bạn là: %s\n\n" +
                "Mã này sẽ hết hạn sau 15 phút.\n" +
                "Vui lòng không chia sẻ mã này với bất kỳ ai.\n\n" +
                "Nếu bạn không yêu cầu xác thực này, vui lòng bỏ qua email này.\n\n" +
                "---\n" +
                "PCShop Team",
                otp
        );
    }
}
