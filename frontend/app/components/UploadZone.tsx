"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { clsx } from "clsx";

interface Props {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: Record<string, string[]>;
  label?: string;
}

export default function UploadZone({
  onFiles,
  multiple = false,
  accept = { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
  label = "Drop image here or click to browse",
}: Props) {
  const onDrop = useCallback((accepted: File[]) => onFiles(accepted), [onFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept,
    maxSize: 20 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-brand-500 bg-brand-500/10"
          : "border-gray-700 hover:border-gray-500 bg-gray-800/50"
      )}
    >
      <input {...getInputProps()} />
      <div className="text-4xl mb-3">{isDragActive ? "📂" : "📸"}</div>
      <p className="text-gray-300 font-medium">{label}</p>
      <p className="text-gray-500 text-sm mt-1">JPG, PNG, WebP · max 20 MB</p>
    </div>
  );
}
