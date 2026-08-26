import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Brand = {
  id: string;
  name: string;
  accent: string;
  timezone: string;
};

export const ALL_BRANDS = "all";

type BrandState = {
  brands: Brand[];
  brand: Brand | null;
  /** null = โหมดภาพรวมทุกแบรนด์ */
  brandId: string | null;
  isAll: boolean;
  setBrandId: (id: string | null) => void;
  brandName: (id: string | null | undefined) => string;
  loading: boolean;
  refresh: () => void;
};

const BrandContext = createContext<BrandState>({
  brands: [],
  brand: null,
  brandId: null,
  isAll: true,
  setBrandId: () => {},
  brandName: () => "",
  loading: true,
  refresh: () => {},
});

const STORAGE_KEY = "sp.brandId";

export function BrandProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [brandId, setBrandIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, accent, timezone")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Brand[];
    },
  });

  useEffect(() => {
    if (ready || brands.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setBrandIdState(stored && stored !== ALL_BRANDS ? (brands.find((b) => b.id === stored)?.id ?? null) : null);
    setReady(true);
  }, [brands, ready]);

  const setBrandId = (id: string | null) => {
    setBrandIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id ?? ALL_BRANDS);
  };

  const value = useMemo<BrandState>(
    () => ({
      brands,
      brandId,
      isAll: brandId === null,
      brand: brands.find((b) => b.id === brandId) ?? null,
      setBrandId,
      brandName: (id) => brands.find((b) => b.id === id)?.name ?? "",
      loading: isLoading,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
    }),
    [brands, brandId, isLoading, queryClient],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
