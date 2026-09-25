import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AvailabilityBadge, RxBadge } from '../components/badges';
import { DomainErrorAlert, type DomainErrorLike } from '../components/DomainErrorAlert';
import { CartIcon, ChevronRightIcon, MinusIcon, PillIcon, PlusIcon } from '../components/icons';
import { Alert, EmptyState, PageLoader, QueryInspector } from '../components/ui';
import { MedicationDetailQuery } from '../graphql/operations';
import { useCartActions } from '../hooks/useCartActions';
import { errorText, formatCOP, timeAgo } from '../lib/format';

const MAX_UNITS = 10;

export function MedicationDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery(MedicationDetailQuery, { variables: { id } });
  const { addItem, adding } = useCartActions();
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<DomainErrorLike | 'ok' | null>(null);

  if (loading && !data) return <PageLoader label="Cargando ficha técnica…" />;
  if (error && !data) return <Alert tone="error" title="No se pudo cargar la ficha">{errorText(error)}</Alert>;

  const m = data?.medication;
  if (!m) {
    return (
      <EmptyState icon={<PillIcon className="h-7 w-7" />} title="Medicamento no encontrado">
        <Link className="font-semibold text-brand-700 underline" to="/">
          Volver al catálogo
        </Link>
      </EmptyState>
    );
  }

  const soldOut = m.availability.status === 'OUT_OF_STOCK';
  const maxQty = Math.max(1, Math.min(MAX_UNITS, m.availability.unitsAvailable));

  async function handleAdd() {
    setResult(null);
    const res = await addItem(m!.id, quantity);
    if (!res) return;
    setResult(res.__typename === 'CartPayload' ? 'ok' : (res as DomainErrorLike));
  }

  const specs: [string, string][] = [
    ['Principio activo', m.activeIngredient],
    ['Concentración', m.dosage],
    ['Presentación', m.presentation],
    ['Laboratorio', m.laboratory.name],
    ['Categoría terapéutica', m.category.name],
    ['Código (SKU)', m.sku],
  ];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500" aria-label="Ruta">
        <Link to="/" className="hover:text-brand-700">
          Catálogo
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300" />
        <span>{m.category.name}</span>
        <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300" />
        <span className="font-medium text-slate-800">{m.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <span
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                m.requiresPrescription ? 'bg-violet-50 text-violet-600' : 'bg-brand-50 text-brand-600'
              }`}
            >
              <PillIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{m.name}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {m.laboratory.name} · {m.presentation}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RxBadge required={m.requiresPrescription} />
                <AvailabilityBadge status={m.availability.status} />
              </div>
            </div>
          </div>

          <h2 className="mt-7 text-sm font-semibold text-slate-900">Indicaciones</h2>
          <p className="mt-2 leading-relaxed text-slate-600">{m.description}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {specs.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-medium text-slate-400">{label}</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>

          {m.requiresPrescription && (
            <div className="mt-6">
              <Alert tone="warning" title="Requiere prescripción médica">
                Para confirmar el pedido deberás adjuntar los datos de tu fórmula médica (médico, registro, fecha). Un
                químico farmacéutico la validará antes de aprobar el despacho.
              </Alert>
            </div>
          )}
        </article>

        <aside className="card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-28">
          <div>
            <p className="text-xs font-medium text-slate-400">Precio unitario</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{formatCOP(m.price)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-700">{m.availability.unitsAvailable} unidades disponibles</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Disponibilidad actualizada {timeAgo(m.availability.syncedAt)} · se confirma al pagar
            </p>
          </div>

          <div>
            <label htmlFor="qty" className="label">
              Cantidad
            </label>
            <div className="flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Disminuir"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <input
                id="qty"
                className="w-12 bg-transparent text-center font-semibold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))}
              />
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                aria-label="Aumentar"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button type="button" className="btn-primary w-full py-3" disabled={adding || soldOut} onClick={handleAdd}>
            {!soldOut && <CartIcon className="h-4 w-4" />}
            {soldOut ? 'Agotado' : adding ? 'Agregando…' : 'Agregar al carrito'}
          </button>

          {result === 'ok' && (
            <Alert tone="success">
              Agregado al carrito.{' '}
              <Link to="/carrito" className="font-semibold underline">
                Ir al carrito →
              </Link>
            </Alert>
          )}
          {result && result !== 'ok' && <DomainErrorAlert error={result} />}
        </aside>
      </div>

      {import.meta.env.DEV && <QueryInspector document={MedicationDetailQuery} title="Operación de la ficha detallada" />}
    </div>
  );
}
