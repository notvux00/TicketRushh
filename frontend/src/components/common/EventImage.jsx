import { useState } from "react";
import { DEFAULT_EVENT_IMAGE } from "../../lib/mediaUrl";

/**
 * Event cover image with a guaranteed local fallback.
 *
 * Seed data can reference remote hosts that a strict CSP or an offline venue
 * network may block. When the primary source fails we swap in the bundled
 * placeholder instead of leaving a broken image icon.
 */
export default function EventImage({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  ...props
}) {
  const [failedSource, setFailedSource] = useState(null);
  const source = !src || failedSource === src ? DEFAULT_EVENT_IMAGE : src;

  return (
    <img
      {...props}
      src={source}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        if (src && failedSource !== src) setFailedSource(src);
      }}
    />
  );
}
