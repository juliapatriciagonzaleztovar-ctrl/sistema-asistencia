import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export async function uploadPhoto(
  file: File,
  collection: "children" | "teachers" | "practitioners",
  entityId: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, `${collection}/${entityId}.jpg`);

  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: "image/jpeg" });

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      null,
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
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

export function resizeImage(file: File, maxWidth: number = 400, maxHeight: number = 400): Promise<File> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => resolve(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(file);
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
            if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(file); return; }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
              } else {
                resolve(file);
              }
            }, "image/jpeg", 0.85);
          } catch { resolve(file); }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch { resolve(file); }
  });
}
