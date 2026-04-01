package com.pcshop.product_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "products")
@CompoundIndex(name = "specs_brand_idx", def = "{'specs_raw.Thương hiệu': 1}") 
public class Product {
    // Field chung
    @Id
    private String id;

    // @Indexed
    // @Field("categoryId")
    // @JsonSerialize(using = ObjectIdSerializer.class)
    // private ObjectId categoryId;

    @Field(targetType = FieldType.OBJECT_ID)
    private String categoryId;

    @TextIndexed
    private String name;

    @Indexed
    private String model;

    @Indexed
    private Long price;

    private String url;
    private String image;

    @Field("specs_raw")
    private Map<String, String> specsRaw;

    @Field("description_html")
    private String descriptionHtml;

    @Field("embedding_text")
    private String embeddingText;

    @Field("embedding_vector")
    private List<Double> embeddingVector;

    // Field chung giữa các linh kiện
    // CPU, Mainboard
    @Indexed
    private String socket;

    // Mainboard, PSU, HardDisk
    @Indexed
    @Field("form_factor")
    private String formFactor;

    // RAM, HardDisk
    @Indexed
    @Field("capacity_gb")
    private Integer capacityGb;

    // Case, Cooler
    private String color;

    // CPU/Main dùng mảng ["DDR5", "DDR4"], RAM dùng chuỗi "DDR5" => Object
    @Indexed
    @Field("ram_type")
    private Object ramType;

    // Field CPU
    @Field("has_igpu")
    private Boolean hasIGpu;

    @Field("igpu_name")
    private String iGpuName;

    @Field("tdp_w")
    private Integer tdpW;

    private Integer cores;
    private Integer threads;

    @Field("base_clock_ghz")
    private Float baseClockGhz;

    @Field("boost_clock_ghz")
    private Float boostClockGhz;

    // Field Mainboard
    private String chipset;

    @Field("ram_slots")
    private Integer ramSlots;

    @Field("m2_slots")
    private Integer m2Slots;

    @Field("sata_slots")
    private Integer sataSlots;

    @Field("pci_express_version")
    private String pciExpressVersion;

    // Field GPU
    @Indexed
    @Field("vram_gb")
    private Integer vramGb;

    @Field("vram_type")
    private String vramType;

    @Field("length_mm")
    private Integer lengthMM;

    @Field("recommended_psu_w")
    private Integer recommendedPSUW;

    @Field("power_connectors")
    private List<String> powerConnectors;

    @Field("pci_interface")
    private String pciInterface;

    // Field RAM
    private Integer modules;

    @Field("speed_mhz")
    private Integer speedMhz;

    // Field HardDisk
    private String type;

    @Field("interface")
    private String interfacee;

    @Field("read_mbps")
    private Integer readMbps;

    @Field("write_mbps")
    private Integer writeMbps;

    // Field PSU
    @Indexed
    @Field("wattage_w")
    private Integer wattageW;

    private String efficiency;

    private String modularity;
    private List<String> connectors;

    @Field("connectors_count")
    private Map<String, Integer> connectorsCount;

    @Field("size_mm")
    private List<Integer> sizeMM;

    // Field Case
    @Field("case_type")
    private String caseType;

    @Field("dimension_mm")
    private List<Integer> dimensionMM;

    @Field("max_cpu_cooler_height_mm")
    private Integer maxCpuCoolerHeightMM;

    @Field("radiator_support")
    private Map<String, Object> radiatorSupport;

    @Field("fan_support")
    private Map<String, Object> fanSupport;

    @Field("included_fans_count")
    private Integer includedFansCount;

    @Field("drive_support")
    private Map<String, Object> driveSupport;

    @Field("pci_slots")
    private Integer pciSlots;

    @Field("side_panel_material")
    private String sidePanelMaterial;

    // Field Cooler
    @Indexed
    @Field("cooler_type")
    private String coolerType;

    @Field("fan_sizes")
    private Map<String, Object> fanSizes;

    @Field("supported_sockets")
    private List<String> supportedSockets;

    @Field("fan_rpm")
    private Map<String, Object> fanRpm;

    @Field("pump_rpm")
    private Map<String, Object> pumpRpm;

    @Field("airflow_cfm")
    private Map<String, Object> airflowCfm;

    @Field("noise_db")
    private Map<String, Object> noiseDb;

    @Field("radiator_mm")
    private Integer radiatorMM;

    private Boolean rgb;
    private String material;

    @Field("weight_kg")
    private Float weightKg;
}
