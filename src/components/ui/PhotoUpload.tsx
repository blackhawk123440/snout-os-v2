'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, X, Upload, Loader2 } from 'lucide-react';

interface PhotoUploadProps {
  /** Current photo URL (null if no photo) */
  currentUrl: string | null;
  /** Called with the new URL after successful upload, or null to remove */
  onPhotoChange: (url: string | null) => void;
  /** Upload endpoint URL */
  uploadUrl: string;
  /** Extra form data fields to send with upload (e.g., { petId: "abc" }) */
  extraFields?: Record<string, string>;
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Shape: "circle" or "rounded" */
  shape?: 'circle' | 'rounded';
  /** Size in pixels */
  size?: number;
  /** Placeholder when no photo */
  placeholder?: React.ReactNode;
  disabled?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

export function PhotoUpload({
  currentUrl,
  onPhotoChange,
  uploadUrl,
  extraFields,
  maxSize = 5 * 1024 * 1024,
  shape = 'rounded',
  size = 96,
  placeholder,
  disabled,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (file.size > maxSize) {
      setError(`File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images allowed');
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set('file', file);
      if (extraFields) {
        for (const [key, value] of Object.entries(extraFields)) {
          formData.set(key, value);
        }
      }

      const res = await fetch(uploadUrl, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onPhotoChange(data.url);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [uploadUrl, extraFields, maxSize, onPhotoChange]);

  const handleRemove = useCallback(() => {
    onPhotoChange(null);
    setPreview(null);
    setError(null);
  }, [onPhotoChange]);

  const displayUrl = preview || currentUrl;
  const borderRadius = shape === 'circle' ? '50%' : '16px';

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className="relative group"
        style={{ width: size, height: size }}
      >
        {/* Photo or placeholder */}
        <div
          className="w-full h-full overflow-hidden bg-surface-secondary border border-border-default flex items-center justify-center"
          style={{ borderRadius }}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Photo"
              className="w-full h-full object-cover"
              style={{ borderRadius }}
            />
          ) : (
            placeholder || <Camera className="w-6 h-6 text-text-disabled" />
          )}

          {/* Upload overlay */}
          {uploading && (
            <div
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
              style={{ borderRadius }}
            >
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Remove button */}
        {displayUrl && !uploading && !disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-primary border border-border-default shadow-sm hover:bg-status-danger-bg transition-colors"
          >
            <X className="w-3 h-3 text-text-secondary" />
          </button>
        )}

        {/* Upload trigger (click anywhere on the photo area) */}
        {!disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 flex items-center justify-center cursor-pointer"
            style={{ borderRadius }}
            disabled={uploading}
          >
            <Upload className="w-5 h-5 text-white" />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-status-danger-text max-w-[200px] text-center">{error}</p>
      )}
    </div>
  );
}
