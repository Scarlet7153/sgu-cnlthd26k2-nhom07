# PC Builder Database Schema

This document defines the fields available for each product category in the database. Use these fields for compatibility checks and filtering instead of relying solely on product names.

## General Fields (All Categories)
- `_id`: ObjectId
- `categoryId`: ObjectId (normalized to common slots)
- `name`: String
- `model`: String
- `price`: long
- `specs_raw`: Object
- `description_html`: String
- `embedding_vector`: Array[Float]

## CPU
- `socket`: String (e.g., "AM4", "1700")
- `ram_type`: Array[String] (e.g., ["DDR4", "DDR5"])
- `has_igpu`: Boolean
- `igpu_name`: String
- `tdp_w`: Int32
- `cores`: Int32
- `threads`: Int32
- `base_clock_ghz`: Float
- `boost_clock_ghz`: Float

## Mainboard
- `chipset`: String (e.g., "B660", "B550")
- `socket`: String (e.g., "AM4", "1700")
- `form_factor`: String (e.g., "ATX")
- `ram_type`: Array[String] (e.g., ["DDR4"])
- `ram_slots`: Int32
- `m2_slots`: Int32
- `sata_slots`: Int32
- `pci_express_version`: String

## GPU
- `vram_gb`: Int32
- `vram_type`: String
- `length_mm`: Int32
- `recommended_psu_w`: Int32
- `power_connectors`: Array[String]
- `pci_interface`: String

## RAM
- `ram_type`: String (e.g., "DDR4", "DDR5")
- `capacity_gb`: Int32
- `modules`: Int32
- `speed_mhz`: Int32

## HardDisk (SSD/HDD)
- `type`: String (e.g., "SSD", "HDD")
- `capacity_gb`: Int32
- `interface`: String (e.g., "NVMe", "SATA")
- `form_factor`: String (e.g., "M.2", "2.5")
- `read_mbps`: Int32
- `write_mbps`: Int32

## PSU
- `wattage_w`: Int32
- `efficiency`: String
- `form_factor`: String
- `modularity`: String
- `connectors`: Array[String]
- `connectors_count`: Object
- `size_mm`: Array[Int]

## Case
- `case_type`: String
- `dimension_mm`: Array[Int32]
- `max_cpu_cooler_height_mm`: Int32
- `radiator_support`: Object
- `fan_support`: Object
- `included_fans_count`: Int32
- `drive_support`: Object
- `pci_slots`: Int32
- `color`: String
- `side_panel_material`: String

## Cooler
- `cooler_type`: String
- `fan_sizes`: Object
- `supported_sockets`: Array[String]
- `fan_rpm`: Object
- `pump_rpm`: Object
- `airflow_cfm`: Object
- `noise_db`: Object
- `radiator_mm`: Int32
- `rgb`: Boolean
- `material`: String
- `color`: String
- `weight_kg`: Float
