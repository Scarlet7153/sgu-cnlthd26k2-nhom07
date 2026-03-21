package com.pcshop.user_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "accounts")
public class Account {
    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String password; // bcrypt hashed

    private String name;

    @Field("fullname")
    private String fullName;

    @Field("fullName")
    private String fullNameCamel;

    @Indexed(unique = true)
    private String email;

    @Field("address_details")
    private AddressDetails addressDetails;

    @Indexed(unique = true, sparse = true)
    private String phone;

    @Builder.Default
    private String role = "USER"; // USER | ADMIN

    @Builder.Default
    private String status = "active"; // active | inactive | banned

    @CreatedDate
    @Field("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Field("updated_at")
    private Instant updatedAt;
}
