import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export async function uploadPhoto(
  file: File,
  collection: "children" | "teachers" | "practitioners",
  entityId: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const fileExtension = file.name.split(".").pop() || "jpg";
  const fileName = `${collection}/${entityId}.${fileExtension}`;
  const storageRef = ref(storage, fileName);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
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
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: "image/jpeg" });
              resolve(resizedFile);
            } else {
              resolve(file);
            }
          }, "image/jpeg", 0.85);
        } else {
          resolve(file);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
