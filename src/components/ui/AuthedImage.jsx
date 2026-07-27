/**
 * src/components/ui/AuthedImage.jsx
 *
 * Renders an image served by an authenticated backend endpoint (e.g.
 * /api/v1/documents/{id}/download). A plain <img src="..."> can't send an
 * Authorization header, so the browser's request gets rejected — this
 * fetches the image with the bearer token instead and displays it via a
 * local blob URL.
 */

import { useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';

export default function AuthedImage({ src, alt, style, fallback = null }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!src) { setBlobUrl(null); return; }
    let cancelled = false;
    let objectUrl = null;
    const token = localStorage.getItem('token');

    fetch(`${API_BASE}${src}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject())
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setBlobUrl(null); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!blobUrl) return fallback;
  return <img src={blobUrl} alt={alt} style={style} />;
}
