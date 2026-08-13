"use client";

import { useRef, useState } from "react";
import { PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { uploadPhoto, resizeImage } from "@/lib/storage";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  currentPhoto: string | null;
  onPhotoUploaded: (url: string) => void;
  onPhotoRemoved: () => void;
  collection: "children" | "teachers" | "practitioners";
  entityId: string;
  size?: "sm" | "md" | "lg";
}

export function PhotoUpload({ currentPhoto, onPhotoUploaded, onPhotoRemoved, collection, entityId, size = "md" }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentPhoto);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizes = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imagenes");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }

    setUploading(true);
    try {
      const resized = await resizeImage(file, 400, 400);
      const url = await uploadPhoto(resized, collection, entityId);
      setPreview(url);
      onPhotoUploaded(url);
      toast.success("Foto subida");
    } catch (err) {
      toast.error("Error al subir foto");
      console.error(err);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setPreview(null);
    onPhotoRemoved();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-800 hover:border-primary dark:hover:border-primary transition-all cursor-pointer group",
          sizes[size]
        )}
        disabled={uploading}
      >
        {preview ? (
          <>
            <img src={preview} alt="Foto" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold">Cambiar</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <PhotoIcon className={cn("text-gray-400", size === "sm" ? "w-6 h-6" : size === "md" ? "w-8 h-8" : "w-10 h-10")} />
            <span className={cn("font-medium", size === "sm" ? "text-[9px]" : "text-[11px]")}>{uploading ? "Subiendo..." : "Foto"}</span>
          </div>
        )}
      </button>
      {preview && (
        <button type="button" onClick={handleRemove} className="text-red-400 hover:text-red-500 transition-colors" aria-label="Eliminar foto">
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  );
}

export function AvatarFallback({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  const sizes = {
    sm: "w-16 h-16 text-lg",
    md: "w-24 h-24 text-2xl",
    lg: "w-32 h-32 text-3xl",
  };
  return (
    <div className={cn("rounded-2xl gradient-primary flex items-center justify-center text-white font-bold shadow-md", sizes[size], className)}>
      {initials}
    </div>
  );
}
