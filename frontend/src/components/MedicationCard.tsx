import { useState } from 'react';
import { Link } from 'react-router';
import type { MedicationCardFieldsFragment } from '../gql/graphql';
import { useCartActions } from '../hooks/useCartActions';
import { formatCOP } from '../lib/format';
import { AvailabilityBadge, RxBadge } from './badges';
import { PillIcon, PlusIcon } from './icons';
import { IconCircle, Spinner } from './ui';

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

export function MedicationCard({ medication }: { medication: MedicationCardFieldsFragment }) {
  const { addItem } = useCartActions();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const soldOut = medication.availability.status === 'OUT_OF_STOCK';

  async function handleAdd() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await addItem(medication.id, 1);
      if (!result) return;
      if (result.__typename === 'CartPayload') {
        setFeedback({ tone: 'ok', text: '✓ Agregado al carrito' });
        setTimeout(() => setFeedback(null), 1800);
      } else {
        setFeedback({ tone: 'error', text: result.message });
      }
    } catch {
      setFeedback({ tone: 'error', text: 'No se pudo agregar. Intenta de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <IconCircle tone={medication.requiresPrescription ? 'violet' : 'brand'}>
          <PillIcon className="h-5 w-5" />
        </IconCircle>
        <AvailabilityBadge status={medication.availability.status} />
      </div>

      <Link to={`/medicamentos/${medication.id}`} className="mt-3 flex-1">
        <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">{medication.name}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {medication.dosage} · {medication.presentation}
        </p>
      </Link>

      <div className="mt-3">
        <RxBadge required={medication.requiresPrescription} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Precio</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCOP(medication.price)}</p>
        </div>
        <button type="button" className="btn-primary px-3.5 py-2" disabled={busy || soldOut} onClick={handleAdd}>
          {busy ? <Spinner className="h-4 w-4 text-white" /> : soldOut ? null : <PlusIcon className="h-4 w-4" />}
          {busy ? 'Agregando' : soldOut ? 'Agotado' : 'Agregar'}
        </button>
      </div>
      {feedback && (
        <p className={`mt-2 text-xs font-medium ${feedback.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{feedback.text}</p>
      )}
    </article>
  );
}
