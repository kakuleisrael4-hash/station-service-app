import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

const DEMOS: { role: Role; label: string; email: string; color: string }[] = [
  { role: 'admin', label: 'Admin', email: 'admin@kkc.cd', color: 'bg-energy-500/15 text-energy-300 hover:bg-energy-500/25' },
  { role: 'pompiste', label: 'Pompiste', email: 'jean@kkc.cd', color: 'bg-fuel-500/15 text-fuel-300 hover:bg-fuel-500/25' },
  { role: 'viewer', label: 'Gérant', email: 'audit@kkc.cd', color: 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25' },
];

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, signInDemo, isMock } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function quick(role: Role) {
    setBusy(true);
    setError(null);
    try {
      await signInDemo(role);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Authentification de la Station">
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-energy-500/10 px-3 py-2 text-xs text-energy-300">
        <ShieldCheck className="h-4 w-4" /> Accès sécurisé — espace réservé au personnel.
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Adresse e-mail</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@kkc.cd" required autoFocus />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Se connecter
        </button>
      </form>

      {isMock && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 text-center text-xs text-slate-400">Connexion rapide (démo) — mot de passe&nbsp;: <span className="font-mono text-slate-300">1234</span></p>
          <div className="grid grid-cols-3 gap-2">
            {DEMOS.map((d) => (
              <button key={d.role} onClick={() => quick(d.role)} disabled={busy} className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${d.color}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
