const configuredBase = (import.meta.env.VITE_MEDIA_BASE_URL || "").replace(/\/+$/, "");

/**
 * Build a public media URL.
 *
 * Production: MEDIA base is empty, so /media/... is served by CloudFront.
 * Local: VITE_MEDIA_BASE_URL points at the LocalStack bucket, e.g.
 * http://localhost:4566/ticketrush-media
 */
export function mediaUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${configuredBase}${normalized}`;
}

export const DEFAULT_QR_URL = mediaUrl("/media/qr/qr_for_all.png");
