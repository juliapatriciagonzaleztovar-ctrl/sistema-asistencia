import { ref, deleteObject } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export async function uploadPhoto(
  file: File,
  collection: "children" | "teachers" | "practitioners",
  entityId: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collection", collection);
  formData.append("entityId", entityId);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }

  const data = await res.json();
  return data.url;
}

export async function deletePhoto(
  collection: "children" | "teachers" | "practitioners",
  entityId: string
): Promise<void> {
  const storage = getFirebaseStorage();
  const extensions = ["jpg", "jpeg", "png", "webp"];
  for (const ext of extensions) {
    try {
      const fileName = `${collection}/${entityId}.${ext}`;
      const storageRef = ref(storage, fileName);
      await deleteObject(storageRef);
      return;
    } catch {
      continue;
    }
  }
}

export async function resizeImage(file: File, maxWidth: number = 400, maxHeight: number = 400): Promise<File> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => resolve(file);
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onerror = () => resolve(file);
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              let w = img.width;
              let h = img.height;
              if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
              if (h > maxHeight) { w = Math.round((w * maxHeight) / h); h = maxHeight; }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (!ctx) { resolve(file); return; }
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              canvas.toBlob((blob) => {
                if (blob && blob.size > 100) {
                  resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg") || "photo.jpg", { type: "image/jpeg", lastModified: Date.now() }));
                } else {
                  resolve(file);
                }
              }, "image/jpeg", 0.8);
            } catch { resolve(file); }
          };
          img.src = e.target?.result as string;
        } catch { resolve(file); }
      };
      reader.readAsDataURL(file);
    } catch { resolve(file); }
  });
}
