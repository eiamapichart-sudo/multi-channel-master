import { useEffect, useState } from "react";
import { isVideoPath, signMedia } from "@/lib/media";

export type ClipInfo = {
  /** ความยาวคลิปเป็นวินาที — null = ยังอ่านไม่ได้ */
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** ลิงก์ชั่วคราวของคลิป ใช้ทำตัวอย่างรูปปก */
  url: string | null;
};

const EMPTY: ClipInfo = { durationSec: null, width: null, height: null, url: null };

/**
 * อ่านความยาวและขนาดภาพของคลิปแรกในโพสต์ จากในเบราว์เซอร์
 *
 * ใช้เตือนผู้ใช้ก่อนโพสต์ เช่น คลิปยาวเกิน 3 นาทีจะไม่ได้เป็น Shorts
 * ไม่ต้องส่งอะไรขึ้นเซิร์ฟเวอร์ อาศัย metadata ที่เบราว์เซอร์โหลดอยู่แล้ว
 */
export function useClipInfo(mediaPaths: string[]): ClipInfo {
  const videoPath = mediaPaths.find((p) => isVideoPath(p)) ?? null;
  const [info, setInfo] = useState<ClipInfo>(EMPTY);

  useEffect(() => {
    let alive = true;
    setInfo(EMPTY);
    if (!videoPath || typeof document === "undefined") return;

    let video: HTMLVideoElement | null = null;

    signMedia([videoPath])
      .then((items) => {
        const url = items[0]?.url;
        if (!alive || !url) return;

        video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = url;

        video.onloadedmetadata = () => {
          if (!alive || !video) return;
          setInfo({
            durationSec: Number.isFinite(video.duration) ? video.duration : null,
            width: video.videoWidth || null,
            height: video.videoHeight || null,
            url,
          });
        };
        video.onerror = () => {
          if (alive) setInfo({ ...EMPTY, url });
        };
      })
      .catch(() => {
        if (alive) setInfo(EMPTY);
      });

    return () => {
      alive = false;
      if (video) {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
      }
    };
  }, [videoPath]);

  return info;
}
