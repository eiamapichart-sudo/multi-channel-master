import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Brand = {
  id: string;
  name: string;
  accent: string;
  timezone: string;
};

type BrandState = {
  brands: Brand[];
  brand: Brand | null;
  brandId: string | null;
  setBrandId: (id: string) => void;
  loading: boolean;
  refresh: () => void;
};

const BrandContext = createContext<BrandState>({
  brands: [],
  brand: null,
  brandId: null,
  setBrandId: () => {},
  loading: true,
  refresh: () => {},
});

const STORAGE_KEY = "sp.brandId";

export function BrandProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [brandId, setBrandIdState] = useState<string | null>(null);

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
    if (brandId || brands.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const next = brands.find((b) => b.id === stored)?.id ?? brands[0]!.id;
    setBrandIdState(next);
  }, [brands, brandId]);

  const setBrandId = (id: string) => {
    setBrandIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<BrandState>(
    () => ({
      brands,
      brandId,
      brand: brands.find((b) => b.id === brandId) ?? null,
      setBrandId,
      loading: isLoading,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
    }),
    [brands, brandId, isLoading, queryClient],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
