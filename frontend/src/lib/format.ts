import type { AvailabilityStatus, OrderStatus, PrescriptionStatus } from '../gql/graphql';

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const formatCOP = (value: number) => cop.format(value);

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/** Texto de un error de red o GraphQL: el detalle técnico solo se muestra en desarrollo. */
export function errorText(error: { message: string }): string {
  return import.meta.env.DEV ? error.message : 'Revisa tu conexión e inténtalo de nuevo en unos segundos.';
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  DISPATCHED: 'Despachado',
  CANCELLED: 'Cancelado',
};

/** Pestañas de la bandeja del farmacéutico (página y menú lateral). */
export const REVIEW_TABS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING_APPROVAL', label: 'Por revisar' },
  { status: 'APPROVED', label: 'Por despachar' },
  { status: 'DISPATCHED', label: 'Despachados' },
  { status: 'CANCELLED', label: 'Cancelados' },
];

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  IN_STOCK: 'Disponible',
  LOW_STOCK: 'Pocas unidades',
  OUT_OF_STOCK: 'Agotado',
};

export const PRESCRIPTION_STATUS_LABEL: Record<PrescriptionStatus, string> = {
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export const ACTOR_LABEL: Record<string, string> = {
  SYSTEM: 'Sistema',
  PATIENT: 'Paciente',
  PHARMACIST: 'Químico farmacéutico',
};
