"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { processServiceImage, type ServiceImages } from "@/lib/service-images";
import { ServiceThumbnail } from "./service-thumbnail";
export function ServiceImageUpload({
  name,
  category,
  value,
  onChange,
  disabled = false,
  onBusyChange,
}: {
  name: string;
  category: string;
  value: ServiceImages;
  onChange: (images: ServiceImages) => void | Promise<void>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef({ onChange, onBusyChange, disabled });
  latest.current = { onChange, onBusyChange, disabled };
  const request = useRef(0);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasImage = !!(value.imageUrl || value.thumbnailUrl);
  useEffect(
    () => () => {
      request.current++;
      latest.current.onBusyChange?.(false);
    },
    [],
  );
  async function upload(file: File) {
    if (latest.current.disabled) return;
    const token = ++request.current;
    setBusy(true);
    setError("");
    latest.current.onBusyChange?.(true);
    try {
      const result = await processServiceImage(file);
      if (token !== request.current || latest.current.disabled) return;
      await latest.current.onChange({
        imageUrl: result.imageUrl,
        thumbnailUrl: result.thumbnailUrl,
      });
    } catch (issue) {
      if (token === request.current)
        setError(
          issue instanceof Error ? issue.message : "Image upload failed.",
        );
    } finally {
      if (token === request.current) {
        setBusy(false);
        latest.current.onBusyChange?.(false);
      }
    }
  }
  async function remove() {
    setError("");
    try {
      await latest.current.onChange({ imageUrl: null, thumbnailUrl: null });
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "The image could not be removed.",
      );
    }
  }
  return (
    <div className="service-image-editor" aria-busy={busy}>
      <ServiceThumbnail
        service={{ name, category, ...value }}
        size={64}
        full
        decorative={false}
      />
      <div>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Upload image for ${name}`}
          disabled={disabled || busy}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <div className="image-editor-actions">
          <button
            type="button"
            className="link"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
            aria-label={`${hasImage ? "Replace" : "Upload"} image for ${name}`}
          >
            {hasImage ? <RefreshCw size={14} /> : <ImagePlus size={14} />}{" "}
            {busy ? "Processing…" : hasImage ? "Replace" : "Upload image"}
          </button>
          {hasImage && (
            <button
              type="button"
              className="danger-link"
              disabled={disabled || busy}
              onClick={() => void remove()}
              aria-label={`Remove image for ${name}`}
            >
              <Trash2 size={14} /> Remove image
            </button>
          )}
        </div>
        <small>
          {busy
            ? "Resizing image and creating thumbnail…"
            : "JPG, PNG or WebP · max 2 MB"}
        </small>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
