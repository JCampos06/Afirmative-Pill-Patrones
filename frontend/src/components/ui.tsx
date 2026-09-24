import { print, type DocumentNode } from 'graphql';
import type { ReactNode } from 'react';
import { CodeIcon } from './icons';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
      <Spinner /> <span>{label}</span>
    </div>
  );
}

export type Tone = 'brand' | 'dark' | 'violet' | 'amber' | 'sky' | 'emerald' | 'rose' | 'slate';

const CIRCLE_TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  dark: 'bg-slate-900 text-white',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-500',
};

/** Icono dentro de un círculo suave: el recurso visual base del diseño. */
export function IconCircle({ children, tone = 'brand', size = 'md' }: { children: ReactNode; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
  return <span className={`grid shrink-0 place-items-center rounded-full ${sizes[size]} ${CIRCLE_TONES[tone]}`}>{children}</span>;
}

/** Título de página con subtítulo y acciones a la derecha. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Encabezado de tarjeta: icono circular + título + subtítulo + acciones. */
export function CardHeader({
  icon,
  tone = 'brand',
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconCircle tone={tone}>{icon}</IconCircle>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Tarjeta KPI: etiqueta arriba, icono + valor grande abajo. */
export function StatCard({
  label,
  value,
  icon,
  tone = 'slate',
  hint,
  corner,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  corner?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {corner && <span className="text-slate-400">{corner}</span>}
      </div>
      <div className="flex items-center gap-3">
        <IconCircle tone={tone} size="sm">
          {icon}
        </IconCircle>
        <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      </div>
      {hint && <p className="-mt-2 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Aviso destacado tipo notificación (icono oscuro + mensaje + CTA). */
export function Banner({ icon, title, children, action }: { icon: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="card flex flex-wrap items-center gap-4 p-5">
      <IconCircle tone="dark" size="lg">
        {icon}
      </IconCircle>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        {children && <div className="mt-0.5 text-sm text-slate-500">{children}</div>}
      </div>
      {action}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-3xl text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {children && <div className="max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

type AlertTone = 'error' | 'warning' | 'info' | 'success';

const ALERT_STYLES: Record<AlertTone, string> = {
  error: 'border-rose-100 bg-rose-50 text-rose-800',
  warning: 'border-amber-100 bg-amber-50 text-amber-900',
  info: 'border-sky-100 bg-sky-50 text-sky-900',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-900',
};

export function Alert({ tone, title, children }: { tone: AlertTone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm ${ALERT_STYLES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

/**
 * Muestra el texto de la operación GraphQL que alimenta la vista: sirve para
 * evidenciar en la sustentación que se piden solo los campos necesarios.
 */
export function QueryInspector({ document, title = 'Ver operación GraphQL' }: { document: DocumentNode; title?: string }) {
  return (
    <details className="group card overflow-hidden text-xs">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-slate-500 select-none hover:text-brand-700">
        <CodeIcon className="h-4 w-4" /> {title}
      </summary>
      <pre className="max-h-80 overflow-auto bg-slate-900 p-4 font-mono leading-relaxed text-emerald-200">{print(document)}</pre>
    </details>
  );
}
