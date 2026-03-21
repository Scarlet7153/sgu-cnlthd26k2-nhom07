package com.pcshop.product_service.model;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.pcshop.product_service.config.ObjectIdSerializer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "products")
public class Product {
    @Id
    private String id;

    @Indexed
    @Field("categoryId")
    @JsonSerialize(using = ObjectIdSerializer.class)
    private ObjectId categoryId; // ref → categories._id

    @TextIndexed
    private String name;

    private String model;

    private String url;

    private Long price; // VNĐ integer

    private String image; // URL ảnh đại diện

    private String socket; // e.g. AM4, LGA1700

    @Field("ram_type")
    @JsonProperty("ramType")
    private List<String> ramType; // e.g. [DDR4, DDR5]

    @Field("has_igpu")
    @JsonProperty("hasIgpu")
    private Boolean hasIgpu;

    @Field("igpu_name")
    @JsonProperty("igpuName")
    private String igpuName;

    @Field("tdp_w")
    @JsonProperty("tdpW")
    private Integer tdpW; // Watt

    private Integer cores;

    private Integer threads;

    @Field("base_clock_ghz")
    @JsonProperty("baseClockGhz")
    private Double baseClockGhz;

    @Field("boost_clock_ghz")
    @JsonProperty("boostClockGhz")
    private Double boostClockGhz;

    @Field("specs_raw")
    @JsonProperty("specsRaw")
    private Map<String, Object> specsRaw; // dynamic specs from data source

    @Field("description_html")
    @JsonProperty("descriptionHtml")
    private String descriptionHtml;
}
