"use client";
import { memo, useState } from "react";
import {
  Compass,
  Footprints,
  Mountain,
  TentTree,
  Waves,
  Wind,
} from "lucide-react";
import type { Service } from "@/lib/model";
import { categoryLabel } from "@/lib/service-catalog";
import { safeServiceImage } from "@/lib/service-images";
type Props = {
  service: Pick<Service, "name" | "category" | "imageUrl" | "thumbnailUrl">;
  size?: number;
  decorative?: boolean;
  full?: boolean;
  loading?: "lazy" | "eager";
};
export const ServiceThumbnail = memo(function ServiceThumbnail({
  service,
  size = 64,
  decorative = true,
  full = false,
  loading = "lazy",
}: Props) {
  const source = safeServiceImage(
    full
      ? service.imageUrl || service.thumbnailUrl
      : service.thumbnailUrl || service.imageUrl,
  );
  return (
    <Thumbnail
      key={`${source || "none"}:${size}`}
      source={source}
      name={service.name}
      category={service.category}
      size={size}
      decorative={decorative}
      loading={loading}
    />
  );
});
function Thumbnail({
  source,
  name,
  category,
  size,
  decorative,
  loading,
}: {
  source?: string;
  name: string;
  category: string;
  size: number;
  decorative: boolean;
  loading: "lazy" | "eager";
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = categoryLabel(category);
  const Icon =
    label === "Water"
      ? Waves
      : label === "Air"
        ? Wind
        : label === "Trek"
          ? Mountain
          : label === "Land"
            ? Footprints
            : label === "Outdoors"
              ? TentTree
              : Compass;
  const tint =
    label === "Water"
      ? "water"
      : label === "Air"
        ? "air"
        : label === "Trek"
          ? "trek"
          : "default";
  return (
    <span
      className={`service-thumbnail service-thumbnail--${tint}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(12, Math.round(size / 4)),
      }}
      data-image-state={
        !source || failed ? "fallback" : loaded ? "loaded" : "loading"
      }
    >
      {source && !failed ? (
        <>
          {!loaded && (
            <span
              className="service-image-skeleton skeleton"
              aria-hidden="true"
            />
          )}
          <img
            src={source}
            alt={decorative ? "" : name}
            width={size}
            height={size}
            loading={loading}
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin={/^https?:/i.test(source) ? "anonymous" : undefined}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </>
      ) : (
        <span
          className="service-image-fallback"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : name}
          aria-hidden={decorative || undefined}
        >
          <Icon size={size >= 64 ? 26 : 18} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
