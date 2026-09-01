import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "post-media";

/**
 * เพดานขนาดไฟล์ต่อ 1 ไฟล์ที่แอปนี้ยอมให้อัปเข้าคลัง
 *
 * ต้องตั้งให้ตรงกับ file_size_limit ของ bucket ฝั่ง storage ด้วย
 * ไม่งั้นฝั่งเบราว์เซอร์ปล่อยผ่าน แต่ storage ตีกลับ 413 อยู่ดี
 */
export const MEDIA_MAX_BYTES = 500 * 1024 * 1024;

/**
 * เพดานของแต่ละช่องทางปลายทาง — ใช้เตือนผู้ใช้ตั้งแต่ตอนเลือกไฟล์
 *
 * ตัวเลขจริงบังคับใช้ที่ฝั่งเซิร์ฟเวอร์อีกชั้น (tiktok.server.ts / youtube.server.ts)
 * ตรงนี้มีไว้บอกล่วงหน้าเฉยๆ จะได้ไม่ต้องรอจนโพสต์ล้มเหลวถึงจะรู้
 *
 * Facebook ไม่อยู่ในลิสต์เพราะเราส่งแค่ลิงก์ให้ Facebook ไปดึงไฟล์เอง ไม่มีเพดานฝั่งเรา
 */
export const CHANNEL_VIDEO_LIMITS: { key: string; label: string; maxBytes: number }[] = [
  { key: "tiktok", label: "TikTok", maxBytes: 500 * 1024 * 1024 },
  { key: "youtube", label: "YouTube", maxBytes: 500 * 1024 * 1024 },
];

export type MediaItem = {
  /** storage path inside the post-media bucket, e.g. "<brandId>/<uuid>.jpg" */
  path: string;
  /** temporary signed url used for previewing */
  url: string;
  kind: "image" | "video";
};

export const isVideoPath = (path: string) =>
  /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(path.split("?")[0] ?? "");

/** 157286400 → "150MB" — ใช้ในข้อความเตือน ให้อ่านง่ายกว่าเลขไบต์ */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

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

export type UploadProgress = {
  /** ลำดับไฟล์ที่กำลังอัป เริ่มที่ 1 */
  index: number;
  total: number;
  fileName: string;
  /** 0–100 */
  percent: number;
};

/** ดึงข้อความจริงจาก body ที่ storage ตอบกลับมา ไม่งั้นได้แค่ "อัปโหลดไม่สำเร็จ" ลอยๆ */
function readStorageError(status: number, raw: string, fileName: string): string {
  let message = "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const r = parsed as Record<string, unknown>;
      message = String(r["message"] ?? r["error"] ?? "");
    }
  } catch {
    message = raw.slice(0, 200);
  }

  if (status === 413 || /exceeded the maximum allowed size|payload too large/i.test(message)) {
    return `${fileName} ใหญ่เกินเพดานของคลังไฟล์ — ต้องไปขยาย file_size_limit ของ bucket ก่อน`;
  }
  if (status === 401 || status === 403) {
    return `ไม่มีสิทธิ์อัปไฟล์ ลองออกจากระบบแล้วเข้าใหม่อีกครั้ง`;
  }
  if (status === 409) {
    return `ชื่อไฟล์ซ้ำในคลัง ลองอัปใหม่อีกครั้ง`;
  }
  return message ? `อัป ${fileName} ไม่สำเร็จ — ${message}` : `อัป ${fileName} ไม่สำเร็จ (HTTP ${status})`;
}

/**
 * อัปไฟล์เดียวด้วย XMLHttpRequest
 *
 * ใช้ XHR แทน supabase.storage.upload() เพราะต้องการ event ความคืบหน้า
 * ไฟล์ใหญ่ๆ ถ้าไม่มีตัวเลขบอก ผู้ใช้จะแยกไม่ออกว่ากำลังอัปอยู่หรือค้างไปแล้ว
 */
function putObject(
  baseUrl: string,
  apiKey: string,
  accessToken: string,
  path: string,
  file: File,
  onPercent: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/storage/v1/object/${MEDIA_BUCKET}/${path}`, true);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "false");
    if (file.type) xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=3600");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onPercent(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onPercent(100);
        resolve();
        return;
      }
      reject(new Error(readStorageError(xhr.status, xhr.responseText ?? "", file.name)));
    };
    xhr.onerror = () =>
      reject(new Error(`อัป ${file.name} ไม่สำเร็จ — เน็ตหลุดระหว่างอัป ลองใหม่อีกครั้ง`));
    xhr.ontimeout = () =>
      reject(new Error(`อัป ${file.name} นานเกินไป — ลองใหม่ หรือย่อไฟล์ให้เล็กลง`));
    xhr.onabort = () => reject(new Error("ยกเลิกการอัปโหลดแล้ว"));

    xhr.send(file);
  });
}

export async function uploadMedia(
  brandId: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
) {
  // เช็คขนาดให้ครบทุกไฟล์ก่อน จะได้ไม่อัปไปครึ่งทางแล้วค่อยพบว่าไฟล์ที่ 3 ใหญ่เกิน
  for (const file of files) {
    if (file.size === 0) throw new Error(`${file.name} เป็นไฟล์ว่าง เลือกไฟล์ใหม่`);
    if (file.size > MEDIA_MAX_BYTES) {
      throw new Error(
        `${file.name} ใหญ่เกินไป (${formatBytes(file.size)}) — รับไม่เกิน ${formatBytes(MEDIA_MAX_BYTES)} ต่อไฟล์`,
      );
    }
  }

  const baseUrl = String(
    import.meta.env["VITE_SUPABASE_URL"] ?? "",
  ).replace(/\/+$/, "");
  const apiKey = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "");
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? "";

  const uploaded: string[] = [];
  for (const [i, file] of files.entries()) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${brandId}/${crypto.randomUUID()}.${ext}`;

    onProgress?.({ index: i + 1, total: files.length, fileName: file.name, percent: 0 });

    if (baseUrl && apiKey && accessToken) {
      await putObject(baseUrl, apiKey, accessToken, path, file, (percent) =>
        onProgress?.({ index: i + 1, total: files.length, fileName: file.name, percent }),
      );
    } else {
      // ไม่มีค่าที่ต้องใช้ทำ XHR เอง (เช่นตอน SSR) — ถอยไปใช้ตัวอัปของ supabase-js
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
        ...(file.type ? { contentType: file.type } : {}),
        upsert: false,
      });
      if (error) throw error;
      onProgress?.({ index: i + 1, total: files.length, fileName: file.name, percent: 100 });
    }

    uploaded.push(path);
  }
  return uploaded;
}

export async function removeMedia(path: string) {
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
