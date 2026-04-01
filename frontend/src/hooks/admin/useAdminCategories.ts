import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

export interface AdminCategorySubcategory {
  name: string;
  filter_query?: string;
  filterQuery?: string;
}

export interface AdminCategory {
  _id?: { $oid?: string };
  id?: string;
  code: string;
  name: string;
  is_active?: boolean;
  isActive?: boolean;
  subcategory?: AdminCategorySubcategory[];
}

export interface CategoryRequest {
  code: string;
  name: string;
  is_active?: boolean;
  isActive?: boolean;
  subcategory?: AdminCategorySubcategory[];
}

const toCategoryRequestPayload = (data: CategoryRequest) => ({
  code: data.code,
  name: data.name,
  isActive: data.isActive ?? data.is_active,
  subcategory: (data.subcategory || []).map((sub) => ({
    name: sub.name,
    filterQuery: sub.filterQuery ?? sub.filter_query ?? "",
  })),
});

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      try {
        const res: any = await axiosClient.get("/categories/all");
        const data = unwrapApiData<AdminCategory[]>(res) || [];

        return data.map((cat: any) => ({
          ...cat,
          subcategory: Array.isArray(cat.subcategory)
            ? cat.subcategory.map((sub: any) => ({
                ...sub,
                filter_query: sub?.filter_query ?? sub?.filterQuery ?? "",
              }))
            : [],
        }));
      } catch (err) {
        console.error("Fetch categories error:", getApiErrorMessage(err));
        return [];
      }
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CategoryRequest) => {
      const res: any = await axiosClient.post("/categories", toCategoryRequestPayload(data));
      return unwrapApiData<AdminCategory>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-menu"] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryRequest }) => {
      const res: any = await axiosClient.put(`/categories/${id}`, toCategoryRequestPayload(data));
      return unwrapApiData<AdminCategory>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-menu"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-menu"] });
    },
  });
}
