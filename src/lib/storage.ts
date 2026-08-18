export function resizeToBase64(file: File, maxWidth: number = 400, maxHeight: number = 400, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
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
              if (!ctx) { reject(new Error("No se pudo crear canvas")); return; }
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              const dataUrl = canvas.toDataURL("image/jpeg", quality);
              resolve(dataUrl);
            } catch { reject(new Error("Error al procesar imagen")); }
          };
          img.src = e.target?.result as string;
        } catch { reject(new Error("Error al cargar imagen")); }
      };
      reader.readAsDataURL(file);
    } catch { reject(new Error("Error al leer archivo")); }
  });
}
