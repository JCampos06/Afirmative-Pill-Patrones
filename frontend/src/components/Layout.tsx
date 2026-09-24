import { useQuery } from '@apollo/client/react';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { GRAPHQL_HTTP_URL, SUBSCRIPTIONS_ENABLED } from '../apollo/config';
import { useAuth } from '../auth/AuthContext';
import { MyCartQuery } from '../graphql/operations';
import { useDebounced } from '../hooks/useDebounced';
import { REVIEW_TABS } from '../lib/format';
import { ORDER_STATUS_DOT } from './badges';
import {
  CartIcon,
  ChevronDownIcon,
  ClipboardIcon,
  DatabaseIcon,
  GridIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  PillIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from './icons';

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPatient = user?.role === 'PATIENT';
  // Misma query que la página del carrito: comparten la entrada en caché,
  // así el contador se actualiza solo tras cada mutation del carrito.
  const { data } = useQuery(MyCartQuery, { skip: !isPatient });
  const itemCount = isPatient ? (data?.myCart?.itemCount ?? 0) : 0;

  // En móvil el menú es un panel deslizable: se cierra al navegar.
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  return (
    <div className="min-h-screen lg:pl-72">
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-canvas transition-transform duration-200 lg:translate-x-0 ${
          menuOpen ? 'translate-x-0 shadow-lift' : '-translate-x-full'
        }`}
      >
        <Sidebar itemCount={itemCount} onClose={() => setMenuOpen(false)} />
      </aside>

      <div className="flex min-h-screen flex-col">
        <Topbar itemCount={itemCount} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─── Menú lateral ─────────────────────────────────────────────────────

function Sidebar({ itemCount, onClose }: { itemCount: number; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const onCatalog = location.pathname === '/';
  const onPharmacy = location.pathname === '/farmacia';

  // Los sub-filtros del catálogo conservan la búsqueda en curso.
  function catalogLink(tipo: 'otc' | 'rx') {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (onCatalog && q) next.set('q', q);
    next.set('tipo', tipo);
    return `/?${next.toString()}`;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white shadow-brand">
            <PillIcon className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-slate-900">Afirmative Pill</span>
            <span className="block text-[11px] font-medium text-slate-500">Farmacia en línea</span>
          </span>
        </Link>
        <button type="button" className="icon-btn h-9 w-9 lg:hidden" onClick={onClose} aria-label="Cerrar menú">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-9 mb-3 px-3 text-xs font-medium text-slate-400">Menú</p>
      <nav className="space-y-1.5">
        <NavItem to="/" end icon={<GridIcon className="h-4 w-4" />} label="Catálogo" expandable>
          <SubItem to={catalogLink('otc')} dot="bg-emerald-500" label="Venta libre" active={onCatalog && params.get('tipo') === 'otc'} />
          <SubItem to={catalogLink('rx')} dot="bg-violet-500" label="Con fórmula médica" active={onCatalog && params.get('tipo') === 'rx'} />
        </NavItem>

        {user?.role === 'PATIENT' && (
          <>
            <NavItem
              to="/carrito"
              icon={<CartIcon className="h-4 w-4" />}
              label="Carrito"
              count={itemCount > 0 ? itemCount : undefined}
            />
            <NavItem to="/pedidos" icon={<PackageIcon className="h-4 w-4" />} label="Mis pedidos" />
          </>
        )}

        {user?.role === 'PHARMACIST' && (
          <NavItem to="/farmacia" icon={<ClipboardIcon className="h-4 w-4" />} label="Bandeja" expandable>
            {REVIEW_TABS.map(({ status, label }) => (
              <SubItem
                key={status}
                to={`/farmacia?estado=${status}`}
                dot={ORDER_STATUS_DOT[status]}
                label={label}
                active={onPharmacy && (params.get('estado') ?? 'PENDING_APPROVAL') === status}
              />
            ))}
          </NavItem>
        )}
      </nav>

      <p className="mt-8 mb-3 px-3 text-xs font-medium text-slate-400">Cuenta</p>
      <div className="space-y-1.5">
        {user ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-rose-600"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl text-rose-500">
              <LogOutIcon className="h-4 w-4" />
            </span>
            Cerrar sesión
          </button>
        ) : (
          <NavItem to="/ingresar" icon={<LogInIcon className="h-4 w-4" />} label="Ingresar" />
        )}
      </div>

      <div className="mt-auto pt-8">
        <div className="rounded-2xl bg-white p-4 text-xs shadow-soft">
          <p className="flex items-center gap-2 font-semibold text-slate-700">
            <DatabaseIcon className="h-4 w-4 text-brand-600" /> Canal GraphQL único
          </p>
          <code className="mt-1.5 block truncate text-[11px] text-slate-500" title={GRAPHQL_HTTP_URL}>
            {GRAPHQL_HTTP_URL}
          </code>
          <p className="mt-3 flex items-center gap-2 font-medium text-slate-600">
            <span className={`h-2 w-2 rounded-full ${SUBSCRIPTIONS_ENABLED ? 'animate-pulse bg-emerald-500' : 'bg-sky-500'}`} />
            {SUBSCRIPTIONS_ENABLED ? 'Tiempo real · Subscriptions' : 'Tiempo real · Polling'}
          </p>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  to,
  end,
  icon,
  label,
  count,
  expandable,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  expandable?: boolean;
  children?: ReactNode;
}) {
  return (
    <div>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
            isActive ? 'bg-brand-600 text-white shadow-brand' : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                isActive ? 'bg-white text-brand-600' : 'text-brand-600 group-hover:bg-brand-50'
              }`}
            >
              {icon}
            </span>
            <span className="flex-1">{label}</span>
            {count !== undefined && (
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${
                  isActive ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'
                }`}
              >
                {count}
              </span>
            )}
            {expandable && <ChevronDownIcon className={`h-4 w-4 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />}
          </>
        )}
      </NavLink>
      {children && <div className="mt-1 ml-7 space-y-0.5 border-l border-slate-200 py-1 pl-4">{children}</div>}
    </div>
  );
}

function SubItem({ to, dot, label, active }: { to: string; dot: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition ${
        active ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dot} ${active ? 'ring-4 ring-slate-200/70' : ''}`} />
      {label}
    </Link>
  );
}

// ─── Barra superior ───────────────────────────────────────────────────

const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function Topbar({ itemCount, onOpenMenu }: { itemCount: number; onOpenMenu: () => void }) {
  const { user } = useAuth();
  const today = longDate.format(new Date());
  const firstName = user?.fullName.split(' ')[0];
  const initials = user?.fullName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <button type="button" className="icon-btn lg:hidden" onClick={onOpenMenu} aria-label="Abrir menú">
          <MenuIcon className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-sm font-bold text-white ring-4 ring-white"
            title={user ? (user.role === 'PHARMACIST' ? 'Químico farmacéutico' : 'Paciente') : undefined}
          >
            {initials ?? <UserIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold text-slate-900">{user ? `Hola, ${firstName}` : '¡Bienvenido!'}</p>
            <p className="truncate text-xs text-slate-500 first-letter:uppercase">{today}</p>
          </div>
        </div>

        {/* En móvil el buscador baja a su propia fila (order-last + w-full). */}
        <SearchBox className="order-last w-full md:order-none md:ml-auto md:w-64 xl:w-80" />

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user?.role === 'PATIENT' && (
            <Link to="/carrito" className="icon-btn" aria-label={`Carrito con ${itemCount} unidades`}>
              <CartIcon className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-canvas">
                  {itemCount}
                </span>
              )}
            </Link>
          )}
          {!user && (
            <Link to="/ingresar" className="btn-primary">
              <LogInIcon className="h-4 w-4" /> Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Buscador global. En el catálogo filtra en vivo escribiendo `?q=` en la URL
 * (la página lee el filtro de ahí); en otras páginas, Enter lleva al catálogo.
 */
function SearchBox({ className = '' }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const onCatalog = location.pathname === '/';
  const urlQ = onCatalog ? (params.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQ);
  const debounced = useDebounced(value, 300);
  const lastSynced = useRef(urlQ);

  // URL → caja: al cambiar de página o si la URL cambia desde fuera
  // (atrás/adelante, menú lateral). Lo que la propia caja escribió se ignora
  // para no pisar lo que el usuario sigue tecleando.
  const syncFromUrl = useEffectEvent((force: boolean) => {
    if (!force && urlQ === lastSynced.current) return;
    lastSynced.current = urlQ;
    setValue(urlQ);
  });
  useEffect(() => syncFromUrl(true), [location.pathname]);
  useEffect(() => syncFromUrl(false), [urlQ]);

  // Caja → URL: solo reacciona a lo que el usuario escribe (valor con debounce).
  const pushQuery = useEffectEvent((q: string) => {
    const written = q.trim() ? q : '';
    if (!onCatalog || written === urlQ) return;
    lastSynced.current = written;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (written) next.set('q', written);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  });
  useEffect(() => pushQuery(debounced), [debounced]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (onCatalog) return;
    const q = value.trim();
    lastSynced.current = q;
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative flex items-center ${className}`}>
      <label htmlFor="global-search" className="sr-only">
        Buscar medicamentos
      </label>
      <SearchIcon className="pointer-events-none absolute left-4 h-4 w-4 text-slate-400" />
      <input
        id="global-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar medicamento, principio activo…"
        className="w-full rounded-full border border-white bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 shadow-soft placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
    </form>
  );
}
