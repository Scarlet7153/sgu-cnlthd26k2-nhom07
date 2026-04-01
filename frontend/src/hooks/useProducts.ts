import { useQuery } from '@tanstack/react-query';
import axiosClient, { unwrapApiData } from '@/lib/axiosClient';
import { Product } from '@/types/product.types';

type BackendCategory = {
  id?: string;
  _id?: string | { $oid?: string };
  code?: string;
};

type CategoryMappings = {
  idToCode: Record<string, string>;
  codeToId: Record<string, string>;
};

let cachedCategoryMappings: CategoryMappings | null = null;

const normalizeCategoryCode = (input: string | null | undefined): string => {
  const raw = (input || '').trim().toLowerCase();
  if (!raw) return '';

  const aliases: Record<string, string> = {
    cpu: 'cpu',
    processor: 'cpu',
    mainboard: 'mainboard',
    motherboard: 'mainboard',
    mb: 'mainboard',
    vga: 'vga',
    gpu: 'vga',
    ram: 'ram',
    ssd: 'harddisk',
    hdd: 'harddisk',
    harddisk: 'harddisk',
    psu: 'psu',
    power: 'psu',
    case: 'case',
    cooler: 'cooler',
    cooling: 'cooler',
  };

  return aliases[raw] || raw;
};

const buildCategoryMappings = (categories: BackendCategory[]): CategoryMappings => {
  const idToCode: Record<string, string> = {};
  const codeToId: Record<string, string> = {};

  for (const c of categories) {
    const id = extractCategoryId(c);
    if (!id || !c?.code) continue;
    const normalizedCode = normalizeCategoryCode(c.code);
    idToCode[id] = normalizedCode;
    codeToId[normalizedCode] = id;
  }

  return { idToCode, codeToId };
};

const extractCategoryId = (category: BackendCategory | null | undefined): string | null => {
  if (!category) return null;

  const rawId = category.id ?? category._id;
  if (!rawId) return null;
  if (typeof rawId === 'string') return rawId;
  if (typeof rawId === 'object' && typeof rawId.$oid === 'string') return rawId.$oid;

  return null;
};

const extractEntityId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.$oid ?? obj.id ?? obj._id;
    if (typeof nested === 'string' || typeof nested === 'number') return String(nested);
  }
  return null;
};

const getCategoryMappings = async (): Promise<CategoryMappings> => {
  if (cachedCategoryMappings) return cachedCategoryMappings;

  const raw = await axiosClient.get('/categories');
  const categories = unwrapApiData<BackendCategory[]>(raw) || [];
  cachedCategoryMappings = buildCategoryMappings(categories);
  return cachedCategoryMappings;
};

const resolveCategoryIdByCode = async (categoryCode: string): Promise<string | undefined> => {
  if (!categoryCode) return undefined;

  const normalizedCode = normalizeCategoryCode(categoryCode);
  const mappings = await getCategoryMappings();
  if (mappings.codeToId[normalizedCode]) {
    return mappings.codeToId[normalizedCode];
  }

  // Fallback: query directly by uppercase code (backend stores uppercase codes like CPU, VGA)
  const raw = await axiosClient.get(`/categories/code/${encodeURIComponent(normalizedCode.toUpperCase())}`);
  const category = unwrapApiData<BackendCategory>(raw);
  const id = extractCategoryId(category) || undefined;

  if (id) {
    mappings.codeToId[normalizedCode] = id;
    mappings.idToCode[id] = normalizedCode;
  }

  return id;
};

const resolveProductImage = (backendProduct: any): string => {
  const candidates = [
    backendProduct?.image,
    backendProduct?.imageUrl,
    backendProduct?.thumbnail,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      return c.trim();
    }
  }

  return "https://placehold.co/400x400/png?text=No+Image";
};

const normalizeLooseKey = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

const getSpecsRaw = (backendProduct: any): Record<string, any> => {
  const specs = backendProduct?.specsRaw ?? backendProduct?.specs_raw ?? backendProduct?.specs;
  return specs && typeof specs === 'object' ? specs : {};
};

const pickStringValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const inferBrandFromName = (name: unknown): string | null => {
  if (typeof name !== 'string') return null;
  const knownBrands = [
    'AMD', 'Intel', 'ASUS', 'MSI', 'GIGABYTE', 'ASRock', 'Corsair', 'Kingston',
    'Samsung', 'Western Digital', 'WD', 'Seagate', 'Crucial', 'Adata', 'TeamGroup',
    'Cooler Master', 'NZXT', 'DeepCool', 'Thermaltake', 'Noctua', 'Antec',
    'Lian Li', 'Logitech', 'Razer', 'BenQ', 'Acer', 'Dell', 'LG', 'ViewSonic',
    'Palit', 'PNY', 'ZOTAC', 'GALAX', 'Inno3D', 'Colorful', 'Sapphire',
    'PowerColor', 'XFX', 'Gainward', 'Leadtek', 'AORUS', 'Xigmatek',
  ];

  const lowered = name.toLowerCase();
  for (const brand of knownBrands) {
    if (lowered.includes(brand.toLowerCase())) return brand;
  }

  const stopwords = new Set([
    'card', 'man', 'hinh', 'vga', 'cpu', 'bo', 'vi', 'xu', 'ly',
    'mainboard', 'motherboard', 'ram', 'o', 'cung', 'nguon', 'tan',
    'nhiet', 'vo', 'case', 'gaming', 'series', 'geforce', 'radeon'
  ]);

  const tokens = name
    .replace(/[()\[\],]/g, ' ')
    .split(/[\s/\-]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const rawToken of tokens) {
    const normalized = normalizeLooseKey(rawToken);
    if (!normalized || stopwords.has(normalized)) continue;
    if (/^\d+$/.test(normalized)) continue;
    if (normalized.length < 2) continue;

    // Keep common brand casing for better display in cards/filters.
    const upper = rawToken.toUpperCase();
    if (['AMD', 'INTEL', 'MSI', 'PNY', 'WD', 'XFX', 'LG'].includes(upper)) return upper;
    return rawToken.charAt(0).toUpperCase() + rawToken.slice(1).toLowerCase();
  }

  return null;
};

const resolveProductBrand = (backendProduct: any): string => {
  const directBrand = pickStringValue(backendProduct?.brand);
  if (directBrand) return directBrand;

  const specs = getSpecsRaw(backendProduct);
  const isBrandLikeKey = (normalizedKey: string): boolean => {
    if (!normalizedKey) return false;
    if (normalizedKey.includes('brand')) return true;
    if (normalizedKey === 'thuonghieu') return true;
    if (normalizedKey === 'thnghiau') return true;
    if (normalizedKey.includes('thuong') && normalizedKey.includes('hieu')) return true;
    if (normalizedKey.includes('thng') && normalizedKey.includes('hiau')) return true;
    if (normalizedKey.includes('hang') && normalizedKey.includes('sanxuat')) return true;
    return false;
  };

  // Accept localized keys like "Thương hiệu" and mojibake variants by canonicalizing keys.
  for (const [rawKey, rawValue] of Object.entries(specs)) {
    if (typeof rawKey !== 'string') continue;
    const normalizedKey = normalizeLooseKey(rawKey);
    if (!isBrandLikeKey(normalizedKey)) continue;

    const value = pickStringValue(rawValue);
    if (value) return value;
  }

  const nameInferredBrand = inferBrandFromName(backendProduct?.name);
  if (nameInferredBrand) return nameInferredBrand;

  return 'Unknown';
};

// Transformer function to adapt Backend entity to Frontend type
const mapBackendToFrontendProduct = (
  backendProduct: any,
  idToCode: Record<string, string>,
  categoryCodeHint?: string
): Product => {
  const rawCategoryId =
    extractEntityId(backendProduct.categoryID) ||
    extractEntityId(backendProduct.categoryId) ||
    extractEntityId(backendProduct.category);
  const normalizedCategory =
    normalizeCategoryCode(categoryCodeHint) ||
    (rawCategoryId ? idToCode[rawCategoryId] : '') ||
    normalizeCategoryCode(rawCategoryId || '') ||
    'cpu';

  return {
    ...backendProduct,
    id: backendProduct.id,
    name: backendProduct.name,
    price: backendProduct.price || 0,
    originalPrice: backendProduct.price ? backendProduct.price * 1.1 : undefined, // fake original price
    brand: resolveProductBrand(backendProduct),
    category: normalizedCategory,
    images: [resolveProductImage(backendProduct)],
    stock: backendProduct.stock || 10,
    description: backendProduct.description || "Máy tính / Phụ kiện chính hãng chất lượng cao",
    specs: getSpecsRaw(backendProduct),
    rating: backendProduct.rating || 5,
    reviewCount: backendProduct.reviewCount || 10,
    featured: true, 
    bestSeller: true,
  } as Product;
};

export const useProducts = ({
  page = 0,
  size = 20,
  categoryId,
  keyword,
  minPrice,
  maxPrice,
  fetchAll = false,
  enabled = true,
}: {
  page?: number;
  size?: number;
  categoryId?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  fetchAll?: boolean;
  enabled?: boolean;
} = {}) => {
  return useQuery({
    queryKey: ['products', { page, size, categoryId, keyword, minPrice, maxPrice, fetchAll }],
    queryFn: async () => {
      let mappings: CategoryMappings | null = null;
      const ensureMappings = async (): Promise<CategoryMappings> => {
        if (mappings) return mappings;
        mappings = await getCategoryMappings();
        return mappings;
      };

      let idToCode: Record<string, string> = {};
      
      let endpoint = `/products?page=${page}&size=${size}`;
      let categoryCodeHint: string | undefined;
      let resolvedCategoryId: string | undefined;
      
      if (keyword) {
        if (categoryId) {
          const m = await ensureMappings();
          resolvedCategoryId =
            (await resolveCategoryIdByCode(categoryId)) ||
            m.codeToId[normalizeCategoryCode(categoryId)];
        }

        endpoint = `/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}${resolvedCategoryId ? `&categoryId=${encodeURIComponent(resolvedCategoryId)}` : ""}`;
      } else if (categoryId && (minPrice !== undefined || maxPrice !== undefined)) {
        const m = await ensureMappings();
        resolvedCategoryId =
          (await resolveCategoryIdByCode(categoryId)) ||
          m.codeToId[normalizeCategoryCode(categoryId)];
        endpoint = `/products/filter?categoryId=${resolvedCategoryId || categoryId}&minPrice=${minPrice || 0}&maxPrice=${maxPrice || 999999999}&page=${page}&size=${size}`;
      } else if (categoryId) {
        categoryCodeHint = normalizeCategoryCode(categoryId);
        // Let backend resolve uppercase category code directly to avoid extra round trips.
        endpoint = `/products/category/${encodeURIComponent(categoryCodeHint.toUpperCase())}?page=${page}&size=${size}`;
      }

      if (!categoryCodeHint) {
        const m = await ensureMappings();
        idToCode = m.idToCode || {};
      }

      const res: any = await axiosClient.get(endpoint);
      const pageData: any = unwrapApiData(res);

      // For PC Builder and similar screens that need full inventory, fetch all pages.
      if (fetchAll && !keyword && !categoryId && minPrice === undefined && maxPrice === undefined) {
        const totalPages = Number(pageData?.totalPages || 0);
        const mergedContent = [...(pageData?.content || [])];

        for (let nextPage = 1; nextPage < totalPages; nextPage++) {
          const pageRes: any = await axiosClient.get(`/products?page=${nextPage}&size=${size}`);
          const nextData: any = unwrapApiData(pageRes);
          if (Array.isArray(nextData?.content)) {
            mergedContent.push(...nextData.content);
          }
        }

        return {
          content: mergedContent.map((p: any) => mapBackendToFrontendProduct(p, idToCode, categoryCodeHint)),
          totalElements: mergedContent.length,
          totalPages: totalPages || 1,
          number: 0,
        };
      }
      
      return {
        content: (pageData?.content || []).map((p: any) => mapBackendToFrontendProduct(p, idToCode, categoryCodeHint)),
        totalElements: pageData?.totalElements || 0,
        totalPages: pageData?.totalPages || 0,
        number: pageData?.number || 0,
      };
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 15, // Cache 15 minutes to reduce repeated category requests
  });
};

export const useProductDetail = (id: string | undefined) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;
      const mappings = await getCategoryMappings();
      const res: any = await axiosClient.get(`/products/${id}`);
      return mapBackendToFrontendProduct(unwrapApiData(res), mappings.idToCode);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};
