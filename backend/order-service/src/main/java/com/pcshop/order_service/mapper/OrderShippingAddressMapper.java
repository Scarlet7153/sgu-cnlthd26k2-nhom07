package com.pcshop.order_service.mapper;

import com.pcshop.order_service.dto.request.ShippingAddressRequest;
import com.pcshop.order_service.model.ShippingAddress;
import org.springframework.stereotype.Component;
import java.util.Optional;

/**
 * Mapper for ShippingAddress in Order Service - centralize DTO to entity conversion.
 */

@Component
public class OrderShippingAddressMapper {
    
    public ShippingAddress toEntity(ShippingAddressRequest dto) {
        if (dto == null) {
            return null;
        }
        
        ShippingAddress address = new ShippingAddress();
        address.setFullName(dto.getFullName());
        address.setPhone(dto.getPhone());
        address.setEmail(dto.getEmail());
        address.setAddress(dto.getAddress());
        return address;
    }
}
