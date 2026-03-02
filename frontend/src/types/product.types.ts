export type CategoryType =
  | "cpu"
  | "mainboard"
  | "vga"
  | "ram"
  | "ssd"
  | "hdd"
  | "psu"
  | "case"
  | "cooler"
  | "monitor";

export interface BaseProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  brand: string;
  category: CategoryType;
  images: string[];
  stock: number;
  description: string;
  specs: Record<string, string>;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  bestSeller?: boolean;
}

export interface CpuProduct extends BaseProduct {
  category: "cpu";
  socket: string;
  cores: number;
  threads: number;
  tdp: number;
  baseClock: string;
  boostClock: string;
}

export interface MainboardProduct extends BaseProduct {
  category: "mainboard";
  socket: string;
  chipset: string;
  formFactor: string;
  ramSlots: number;
  maxRam: number;
}

export interface VgaProduct extends BaseProduct {
  category: "vga";
  vram: string;
  tdp: number;
  length: number;
}

export interface RamProduct extends BaseProduct {
  category: "ram";
  capacity: string;
  speed: string;
  type: string;
}

export interface StorageProduct extends BaseProduct {
  category: "ssd" | "hdd";
  capacity: string;
  interface: string;
  readSpeed?: string;
  writeSpeed?: string;
}

export interface PsuProduct extends BaseProduct {
  category: "psu";
  wattage: number;
  efficiency: string;
  modular: string;
}

export interface CaseProduct extends BaseProduct {
  category: "case";
  formFactor: string;
  maxGpuLength: number;
}

export interface CoolerProduct extends BaseProduct {
  category: "cooler";
  socket: string[];
  tdp: number;
  type: string;
}

export type Product =
  | CpuProduct
  | MainboardProduct
  | VgaProduct
  | RamProduct
  | StorageProduct
  | PsuProduct
  | CaseProduct
  | CoolerProduct
  | BaseProduct;

export interface SubCategory {
  name: string;
  to: string;
}

export interface Category {
  id: CategoryType;
  name: string;
  icon: string;
  description: string;
  productCount: number;
  subcategories?: SubCategory[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type SortOption = "price-asc" | "price-desc" | "name-asc" | "name-desc" | "rating";

export interface PcBuildSlot {
  category: CategoryType;
  label: string;
  required: boolean;
  product: Product | null;
}

export interface CompareItem {
  product: Product;
}
