import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ — ใช้ชื่อที่แสดงเวลาอนุมัติโพสต์ */
export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; display_name: string | null } | null;
    },
  });
}

export function useSaveDisplayName() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const name = displayName.trim();
      if (!name) throw new Error("กรุณาใส่ชื่อของคุณ");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, display_name: name });
      if (error) throw error;
      return name;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-names"] });
    },
  });
}

/** ชื่อที่แสดงของเพื่อนร่วมแบรนด์ (เช่น คนที่อนุมัติโพสต์) */
export function useTeamNames(userIds: (string | null)[]) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort();
  return useQuery({
    queryKey: ["profile-names", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) if (row.display_name) map[row.id] = row.display_name;
      return map;
    },
  });
}
