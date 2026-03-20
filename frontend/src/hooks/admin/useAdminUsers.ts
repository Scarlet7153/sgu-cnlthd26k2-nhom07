import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  status: string;
  addressDetails?: {
    houseNumber?: string;
    street?: string;
    ward?: string;
    province?: string;
  };
  createdAt?: string;
}

export interface UpdateUserStatusRequest {
  status: string;
}

export function useAdminUsers({
  page = 0,
  size = 20,
}: {
  page?: number;
  size?: number;
} = {}) {
  return useQuery({
    queryKey: ["admin-users", { page, size }],
    queryFn: async () => {
      try {
        const res: any = await axiosClient.get(`/users?page=${page}&size=${size}`);
        const data = unwrapApiData(res) || {};
        return {
          content: data?.content || data?.data || [],
          totalElements: data?.totalElements || 0,
          totalPages: data?.totalPages || 1,
          number: data?.number || 0,
        };
      } catch (err) {
        console.error("Fetch users error:", getApiErrorMessage(err));
        return { content: [], totalElements: 0, totalPages: 1, number: 0 };
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res: any = await axiosClient.put(`/users/${id}/status`, { status });
      return unwrapApiData<AdminUser>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
