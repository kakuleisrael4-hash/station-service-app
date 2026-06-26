import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X, ImageIcon, Loader2 } from 'lucide-react';
import { useData } from '@/context/DataContext';

interface Props {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  /** ratio CSS pour la zone d'aperçu, ex "16/9", "1/1". */
  aspect?: string;
  rounded?: 'xl' | 'full';
}

/** Sélecteur d'image avec glisser-déposer + aperçu (Image Preview). */
export default function ImageDropzone({ value, onChange, label, aspect = '16/9', rounded = 'xl' }: Props) {
  const { uploadImage } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file?: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image invalide.');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        style={{ aspectRatio: aspect }}
        className={`group relative grid w-full cursor-pointer place-items-center overflow-hidden border-2 border-dashed transition ${
          rounded === 'full' ? 'rounded-full' : 'rounded-xl'
        } ${over ? 'border-energy-400 bg-energy-500/10' : 'border-white/15 bg-night-900/60 hover:border-white/30'}`}
      >
        {value ? (
          <>
            <img src={value} alt="aperçu" className="h-full w-full object-cover" />
            <div className="absolute inset-0 grid place-items-center bg-night-950/0 opacity-0 transition group-hover:bg-night-950/50 group-hover:opacity-100">
              <span className="chip bg-white/10 text-white"><UploadCloud className="h-3.5 w-3.5" /> Remplacer</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-night-950/70 text-rose-300 hover:bg-rose-500 hover:text-white"
              aria-label="Retirer l'image"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-slate-400">
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-energy-400" /> : <ImageIcon className="h-6 w-6" />}
            <p className="text-sm font-medium">Glissez une image ou cliquez</p>
            <p className="text-xs text-slate-500">JPG / PNG — redimensionnée automatiquement</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {err && <p className="mt-1 text-xs text-rose-400">{err}</p>}
    </div>
  );
}
