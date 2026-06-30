// =====================================================================
//  Traitement d'images côté client : redimensionnement + compression.
//  - fileToDataUrl : data-URL (mode démo, stockée dans le contenu localStorage).
//  - fileToBlob    : Blob compressé (mode Supabase, téléversé vers Storage).
// =====================================================================

export interface ImageOpts {
  maxDim?: number; // plus grande dimension cible (px)
  quality?: number; // 0..1 (JPEG)
}

interface Rendered {
  canvas: HTMLCanvasElement;
  type: 'image/png' | 'image/jpeg';
}

function render(file: File, opts: ImageOpts): Promise<Rendered> {
  const { maxDim = 1400 } = opts;
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
        // PNG conservé pour les petits logos à transparence, sinon JPEG compressé.
        const type = file.type === 'image/png' && file.size < 400_000 ? 'image/png' : 'image/jpeg';
        resolve({ canvas, type });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function fileToDataUrl(file: File, opts: ImageOpts = {}): Promise<string> {
  const { canvas, type } = await render(file, opts);
  return canvas.toDataURL(type, opts.quality ?? 0.82);
}

export async function fileToBlob(file: File, opts: ImageOpts = {}): Promise<Blob> {
  const { canvas, type } = await render(file, opts);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion image échouée.'))), type, opts.quality ?? 0.82),
  );
}

/** Lit n'importe quel fichier (vidéo, doc, image…) en data-URL brute (sans compression). */
export function fileToRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
