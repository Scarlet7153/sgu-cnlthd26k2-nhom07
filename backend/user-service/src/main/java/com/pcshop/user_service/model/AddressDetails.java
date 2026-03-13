package com.pcshop.user_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddressDetails {
    @Field("house_number")
    private String houseNumber;

    private String street;

    private String ward;

    private String province;
}
