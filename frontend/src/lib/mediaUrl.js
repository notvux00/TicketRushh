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

// Served from the frontend bucket. Production CloudFront routes /media/* to
// the upload bucket, so bundled placeholders must not live under /media/.
export const DEFAULT_EVENT_IMAGE = "/images/fallback-event.svg";
