package com.pcshop.product_service.model;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    @JsonProperty("ramType")
    private Object ramType;

    // Field CPU
    @Field("has_igpu")
    @JsonProperty("hasIGpu")
    private Boolean hasIGpu;

    @Field("igpu_name")
    @JsonProperty("iGpuName")
    private String iGpuName;

    @Field("tdp_w")
    @JsonProperty("tdpW")
    private Integer tdpW; // Watt

    private Integer cores;
    private Integer threads;

    @Field("base_clock_ghz")
    @JsonProperty("baseClockGhz")
    private Float baseClockGhz;

    @Field("boost_clock_ghz")
    @JsonProperty("boostClockGhz")
    private Float boostClockGhz;

    // Field Mainboard
    private String chipset;

    @Field("ram_slots")
    @JsonProperty("ramSlots")
    private Integer ramSlots;

    @Field("m2_slots")
    @JsonProperty("m2Slots")
    private Integer m2Slots;

    @Field("sata_slots")
    @JsonProperty("sataSlots")
    private Integer sataSlots;

    @Field("pci_express_version")
    @JsonProperty("pciExpressVersion")
    private String pciExpressVersion;

    // Field GPU
    @Indexed
    @Field("vram_gb")
    @JsonProperty("vramGb")
    private Integer vramGb;

    @Field("vram_type")
    @JsonProperty("vramType")
    private String vramType;

    @Field("length_mm")
    @JsonProperty("lengthMM")
    private Integer lengthMM;

    @Field("recommended_psu_w")
    @JsonProperty("recommendedPSUW")
    private Integer recommendedPSUW;

    @Field("power_connectors")
    @JsonProperty("powerConnectors")
    private List<String> powerConnectors;

    @Field("pci_interface")
    @JsonProperty("pciInterface")
    private String pciInterface;

    // Field RAM
    private Integer modules;

    @Field("speed_mhz")
    @JsonProperty("speedMhz")
    private Integer speedMhz;

    // Field HardDisk
    private String type;

    @Field("interface")
    @JsonProperty("interface")
    private String interfacee;

    @Field("read_mbps")
    @JsonProperty("readMbps")
    private Integer readMbps;

    @Field("write_mbps")
    @JsonProperty("writeMbps")
    private Integer writeMbps;

    // Field PSU
    @Indexed
    @Field("wattage_w")
    @JsonProperty("wattageW")
    private Integer wattageW;

    private String efficiency;

    private String modularity;
    private List<String> connectors;

    @Field("connectors_count")
    @JsonProperty("connectorsCount")
    private Map<String, Integer> connectorsCount;

    @Field("size_mm")
    @JsonProperty("sizeMM")
    private List<Integer> sizeMM;

    // Field Case
    @Field("case_type")
    @JsonProperty("caseType")
    private String caseType;

    @Field("dimension_mm")
    @JsonProperty("dimensionMM")
    private List<Integer> dimensionMM;

    @Field("max_cpu_cooler_height_mm")
    @JsonProperty("maxCpuCoolerHeightMM")
    private Integer maxCpuCoolerHeightMM;

    @Field("radiator_support")
    @JsonProperty("radiatorSupport")
    private Map<String, Object> radiatorSupport;

    @Field("fan_support")
    @JsonProperty("fanSupport")
    private Map<String, Object> fanSupport;

    @Field("included_fans_count")
    @JsonProperty("includedFansCount")
    private Integer includedFansCount;

    @Field("drive_support")
    @JsonProperty("driveSupport")
    private Map<String, Object> driveSupport;

    @Field("pci_slots")
    @JsonProperty("pciSlots")
    private Integer pciSlots;

    @Field("side_panel_material")
    @JsonProperty("sidePanelMaterial")
    private String sidePanelMaterial;

    // Field Cooler
    @Indexed
    @Field("cooler_type")
    @JsonProperty("coolerType")
    private String coolerType;

    @Field("fan_sizes")
    @JsonProperty("fanSizes")
    private Map<String, Object> fanSizes;

    @Field("supported_sockets")
    @JsonProperty("supportedSockets")
    private List<String> supportedSockets;

    @Field("fan_rpm")
    @JsonProperty("fanRpm")
    private Map<String, Object> fanRpm;

    @Field("pump_rpm")
    @JsonProperty("pumpRpm")
    private Map<String, Object> pumpRpm;

    @Field("airflow_cfm")
    @JsonProperty("airflowCfm")
    private Map<String, Object> airflowCfm;

    @Field("noise_db")
    @JsonProperty("noiseDb")
    private Map<String, Object> noiseDb;

    @Field("radiator_mm")
    @JsonProperty("radiatorMM")
    private Integer radiatorMM;

    private Boolean rgb;
    private String material;

    @Field("weight_kg")
    @JsonProperty("weightKg")
    private Float weightKg;
}
