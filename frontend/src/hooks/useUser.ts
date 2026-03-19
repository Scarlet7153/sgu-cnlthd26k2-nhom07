import { useState, useCallback } from "react";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";
import { useAuth } from "@/context/AuthContext";

interface AddressDetails {
  houseNumber?: string;
  street?: string;
  ward?: string;
  province?: string;
}

interface UpdateProfileData {
  fullName?: string;
  phone?: string;
  houseNumber?: string;
  street?: string;
  ward?: string;
  province?: string;
  addressDetails?: AddressDetails;
}

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  status: string;
  addressDetails?: AddressDetails;
  createdAt?: string;
}

interface UpdateProfileResult {
  profile: UserProfile | null;
  error: string | null;
}

export function useUser() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user?.id) return null;

    setLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get(`/users/me`);
      const profile = unwrapApiData<UserProfile>(response);
      return profile;
    } catch (err) {
      const message = getApiErrorMessage(err, "Lỗi khi lấy thông tin profile");
      setError(message);
      if (message.includes("Account not found")) {
        await signOut();
      }
      console.error("Get profile error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, signOut]);

  const updateProfile = useCallback(async (data: UpdateProfileData): Promise<UpdateProfileResult> => {
    if (!user?.id) return { profile: null, error: "User ID is missing" };

    setLoading(true);
    setError(null);
    try {
      const payload = {
        fullName: data.fullName,
        phone: data.phone,
        houseNumber: data.houseNumber ?? data.addressDetails?.houseNumber,
        street: data.street ?? data.addressDetails?.street,
        ward: data.ward ?? data.addressDetails?.ward,
        province: data.province ?? data.addressDetails?.province,
      };

      const response = await axiosClient.put(`/users/me`, payload);
      const updated = unwrapApiData<UserProfile>(response);
      return { profile: updated, error: null };
    } catch (err) {
      const message = getApiErrorMessage(err, "Lỗi khi cập nhật profile");
      setError(message);
      if (message.includes("Account not found")) {
        await signOut();
      }
      console.error("Update profile error:", err);
      return { profile: null, error: message };
    } finally {
      setLoading(false);
    }
  }, [user?.id, signOut]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      if (!user?.id) return false;

      setLoading(true);
      setError(null);
      try {
        await axiosClient.post(`/users/change-password`, {
          currentPassword,
          newPassword,
        });
        return true;
      } catch (err) {
        const message = getApiErrorMessage(err, "Lỗi khi đổi mật khẩu");
        setError(message);
        console.error("Change password error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return {
    loading,
    error,
    getProfile,
    updateProfile,
    changePassword,
  };
}
