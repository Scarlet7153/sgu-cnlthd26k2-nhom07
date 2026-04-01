import { useEffect, useState } from 'react';
import axiosClient, { unwrapApiData } from '@/lib/axiosClient';

/**
 * Hook to fetch and cache brand list from backend.
 * Brands are fetched from mongodb distinct("specs_raw.Thương hiệu")
 */
export const useBrands = () => {
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage cache first
    const cachedBrands = localStorage.getItem('brands_cache');
    if (cachedBrands) {
      try {
        setBrands(JSON.parse(cachedBrands));
        setLoading(false);
        return;
      } catch (e) {
        console.warn('Failed to parse cached brands', e);
      }
    }

    // Fetch from backend
    const fetchBrands = async () => {
      try {
        const response = await axiosClient.get('/products/brands');
        const brandList = unwrapApiData<string[]>(response) || [];
        
        // Filter out null, undefined, or empty values
        const cleanedBrands = brandList
          .filter((b: string) => b && b.trim())
          .sort();
        
        setBrands(cleanedBrands);
        
        // Cache for 24 hours
        localStorage.setItem('brands_cache', JSON.stringify(cleanedBrands));
        localStorage.setItem('brands_cache_time', Date.now().toString());
      } catch (err) {
        console.error('Failed to fetch brands:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch brands');
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  return { brands, loading, error };
};
