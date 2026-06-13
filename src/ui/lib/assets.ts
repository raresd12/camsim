/** Object-URL helpers for exam assets and recordings stored in Dexie. */
import { useEffect, useState } from "react";
import { db, assetKey } from "../../db/db";

/** Resolve an exam asset (audio/image path from exam.json) to an object URL. */
export function useAssetUrl(examId: string, path: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    void db.assets.get(assetKey(examId, path)).then((asset) => {
      if (revoked || !asset) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setUrl(objectUrl);
    });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [examId, path]);

  return url;
}

export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}
