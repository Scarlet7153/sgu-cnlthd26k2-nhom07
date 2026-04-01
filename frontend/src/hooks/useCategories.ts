import { useQuery } from "@tanstack/react-query";
import axiosClient, { unwrapApiData } from "@/lib/axiosClient";
import { Category, CategoryType } from "@/types/product.types";

type BackendSubcategory = {
  name?: string | null;
  filter_query?: string | null;
  filterQuery?: string | null;
};

type BackendCategory = {
  id?: string;
  _id?: string;
  code?: string;
  name?: string;
  subcategory?: BackendSubcategory[];
};

const codeToCategoryId = (code: string | null | undefined): CategoryType | null => {
  const normalized = (code || "").trim().toUpperCase();
  const map: Record<string, CategoryType> = {
    CPU: "cpu",
    GPU: "vga",
    VGA: "vga",
    MAINBOARD: "mainboard",
    RAM: "ram",
    HARDDISK: "harddisk",
    HDD: "harddisk",
    SSD: "harddisk",
    PSU: "psu",
    CASE: "case",
    COOLER: "cooler",
  };

  if (map[normalized]) return map[normalized];

  // Fallback for newly created categories not in the predefined map.
  const dynamicId = normalized.toLowerCase().replace(/\s+/g, "-");
  return dynamicId || null;
};

const categoryMeta: Record<string, { icon: string; description: string }> = {
  cpu: { icon: "Cpu", description: "" },
  mainboard: { icon: "CircuitBoard", description: "" },
  vga: { icon: "Monitor", description: "" },
  ram: { icon: "MemoryStick", description: "" },
  harddisk: { icon: "HardDrive", description: "" },
  ssd: { icon: "HardDrive", description: "" },
  hdd: { icon: "HardDrive", description: "" },
  psu: { icon: "Zap", description: "" },
  case: { icon: "Box", description: "" },
  cooler: { icon: "Fan", description: "" },
  monitor: { icon: "Monitor", description: "" },
};

const toSubcategoryLink = (filterQuery: string | null | undefined, categoryId: CategoryType): string => {
  const raw = (filterQuery || "").trim();
  if (!raw) return `/products?category=${categoryId}`;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  // Support DSL-like filters from backend, e.g. "type:DDR4 OR type:DDR5"
  if (!raw.includes("=") && raw.includes(":")) {
    const typeMatches = Array.from(raw.matchAll(/type\s*:\s*([^\s]+(?:\s[^\s]+)?)/gi));
    const typeValue = typeMatches.length > 0 ? String(typeMatches[0][1]).trim() : "";
    if (typeValue) {
      const dslParams = new URLSearchParams();
      dslParams.set("category", categoryId);
      dslParams.set("q", typeValue);
      return `/products?${dslParams.toString()}`;
    }
  }

  const normalized = raw.startsWith("?") ? raw.slice(1) : raw;
  const params = new URLSearchParams(normalized);

  if (!params.get("category")) {
    params.set("category", categoryId);
  }

  // Map backend filter params to product-list search params.
  if (!params.get("search") && !params.get("q")) {
    const filterKeys = ["type", "efficiency", "certification", "standard"];
    const filterValue = filterKeys
      .map((key) => params.get(key))
      .find((val) => typeof val === "string" && val.trim().length > 0);

    if (filterValue) {
      params.set("q", filterValue);
    }
  }

  params.delete("type");
  params.delete("efficiency");
  params.delete("certification");
  params.delete("standard");

  return `/products?${params.toString()}`;
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories-menu"],
    queryFn: async () => {
      const raw = await axiosClient.get("/categories");
      const data = unwrapApiData<BackendCategory[]>(raw) || [];

      const transformed: Category[] = data
        .map((c) => {
          const categoryId = codeToCategoryId(c.code);
          if (!categoryId) return null;

          const meta = categoryMeta[categoryId];

          return {
            id: categoryId,
            name: c.name || categoryId,
            icon: meta?.icon || "Package",
            description: meta?.description || "",
            productCount: 0,
            subcategories: (c.subcategory || [])
              .filter((sub) => !!sub?.name)
              .map((sub) => ({
                name: String(sub.name),
                to: toSubcategoryLink(sub.filter_query || sub.filterQuery, categoryId),
              })),
          } as Category;
        })
        .filter((c): c is Category => c !== null);

      return transformed;
    },
    staleTime: 1000 * 60 * 10,
  });
};
