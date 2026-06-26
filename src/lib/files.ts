// =====================================================================
//  Conversion d'un fichier image en data-URL compressée.
//  - En mode démo local, l'image est stockée dans le contenu (localStorage),
//    donc on la redimensionne/compresse pour rester sous le quota (~5 Mo).
//  - En prod Supabase, on téléverserait plutôt vers un bucket Storage et on
//    stockerait l'URL publique (voir supabase/schema.sql).
// =====================================================================

export interface ImageOpts {
  maxDim?: number; // plus grande dimension cible (px)
  quality?: number; // 0..1 (JPEG)
}

export function fileToDataUrl(file: File, opts: ImageOpts = {}): Promise<string> {
  const { maxDim = 1400, quality = 0.82 } = opts;
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Fichier non image.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponible.'));
        ctx.drawImage(img, 0, 0, w, h);
        // PNG conservé pour les logos à transparence, sinon JPEG compressé.
        const isPng = file.type === 'image/png' && file.size < 400_000;
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
