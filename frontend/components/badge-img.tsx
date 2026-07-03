"use client";

import { useState } from "react";

interface BadgeImgProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function BadgeImg({ src, alt, className }: BadgeImgProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
