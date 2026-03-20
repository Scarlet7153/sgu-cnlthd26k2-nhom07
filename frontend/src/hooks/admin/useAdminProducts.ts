import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

export interface AdminProduct {
  id: string;
  name: string;
  categoryId?: string;
  categoryID?: string;
  category?: any;
  price: number;
  image?: string;
  imageUrl?: string;
  brand?: string;
  stock?: number;
  description?: string;
  socket?: string;
  ramType?: string[];
  hasIgpu?: boolean;
  tdpW?: number;
  cores?: number;
  threads?: number;
  baseClockGhz?: number;
  boostClockGhz?: number;
  specsRaw?: Record<string, any>;
  isActive?: boolean;
  createdAt?: string;
}

export interface ProductRequest {
  categoryId: string;
  name: string;
  model?: string;
  url?: string;
  price: number;
  image?: string;
  socket?: string;
  ramType?: string[];
  hasIgpu?: boolean;
  igpuName?: string;
  tdpW?: number;
  cores?: number;
  threads?: number;
  baseClockGhz?: number;
  boostClockGhz?: number;
  specsRaw?: Record<string, any>;
}

interface ProductsResponse {
  content?: AdminProduct[];
  data?: AdminProduct[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

export function useAdminProducts({
  page = 0,
  size = 20,
  keyword,
  categoryId,
}: {
  page?: number;
  size?: number;
  keyword?: string;
  categoryId?: string;
} = {}) {
  return useQuery({
    queryKey: ["admin-products", { page, size, keyword, categoryId }],
    queryFn: async () => {
      try {
        let endpoint = `/products?page=${page}&size=${size}`;
        if (keyword) {
          endpoint = `/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`;
          if (categoryId) {
            endpoint += `&categoryId=${categoryId}`;
          }
        } else if (categoryId) {
          endpoint = `/products/category/${encodeURIComponent(categoryId.toUpperCase())}?page=${page}&size=${size}`;
        }

        const res: any = await axiosClient.get(endpoint);
        const data = unwrapApiData<ProductsResponse>(res);
        return {
          content: data?.content || data?.data || [],
          totalElements: data?.totalElements || 0,
          totalPages: data?.totalPages || 1,
          number: data?.number || 0,
        };
      } catch (err) {
        console.error("Fetch products error:", getApiErrorMessage(err));
        return { content: [], totalElements: 0, totalPages: 1, number: 0 };
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProductRequest) => {
      const res: any = await axiosClient.post("/products", data);
      return unwrapApiData<AdminProduct>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductRequest }) => {
      const res: any = await axiosClient.put(`/products/${id}`, data);
      return unwrapApiData<AdminProduct>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });
}
