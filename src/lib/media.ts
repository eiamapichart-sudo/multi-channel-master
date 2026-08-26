import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "post-media";

export type MediaItem = {
  /** storage path inside the post-media bucket, e.g. "<brandId>/<uuid>.jpg" */
  path: string;
  /** temporary signed url used for previewing */
  url: string;
  kind: "image" | "video";
};

export const isVideoPath = (path: string) =>
  /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(path.split("?")[0] ?? "");

export async function signMedia(paths: string[], expiresIn = 3600) {
  if (paths.length === 0) return [] as MediaItem[];
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, expiresIn);
  if (error) throw error;
  return paths.map((path) => ({
    path,
    url: data?.find((d) => d.path === path)?.signedUrl ?? "",
    kind: isVideoPath(path) ? ("video" as const) : ("image" as const),
  }));
}

export async function uploadMedia(brandId: string, files: File[]) {
  const uploaded: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${brandId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      ...(file.type ? { contentType: file.type } : {}),
      upsert: false,
    });
    if (error) throw error;
    uploaded.push(path);
  }
  return uploaded;
}

export async function removeMedia(path: string) {
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
