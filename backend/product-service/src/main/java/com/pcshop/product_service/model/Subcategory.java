package com.pcshop.product_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subcategory {
    private String name;

    @Field("filter_query")
    private String filterQuery;
}
