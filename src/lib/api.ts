import { supabase } from "@/integrations/supabase/client";

/** เรียก API route ของแอปพร้อมแนบ token ผู้ใช้ให้อัตโนมัติ */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new Error(payload?.error ?? `คำขอไม่สำเร็จ (${res.status})`);
  return payload as T;
}
