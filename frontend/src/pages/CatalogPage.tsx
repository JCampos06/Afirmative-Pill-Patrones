import { NetworkStatus } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { CartIcon, ClipboardIcon, GridIcon, LayersIcon, LogInIcon, PillIcon, ShieldCheckIcon, SlidersIcon } from '../components/icons';
import { MedicationCard } from '../components/MedicationCard';
import { Alert, Banner, CardHeader, EmptyState, PageLoader, QueryInspector, Spinner, StatCard } from '../components/ui';
import type { MedicationFilter, MedicationSort } from '../gql/graphql';
import { CatalogQuery, CategoriesQuery, MyCartQuery } from '../graphql/operations';

const PAGE_SIZE = 12;

type RxFilter = 'ALL' | 'OTC' | 'RX';
type SortOption = 'NAME_ASC' | 'PRICE_ASC' | 'PRICE_DESC';

const SORTS: Record<SortOption, MedicationSort> = {
  NAME_ASC: { field: 'NAME', direction: 'ASC' },
  PRICE_ASC: { field: 'PRICE', direction: 'ASC' },
  PRICE_DESC: { field: 'PRICE', direction: 'DESC' },
};

/** `?tipo=otc|rx` en la URL (lo usan también los accesos del menú lateral). */
const RX_PARAM: Record<string, RxFilter> = { otc: 'OTC', rx: 'RX' };

export function CatalogPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // La búsqueda llega ya con debounce desde el buscador de la barra superior.
  const search = (params.get('q') ?? '').trim();
  const rx: RxFilter = RX_PARAM[params.get('tipo') ?? ''] ?? 'ALL';
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('NAME_ASC');

  function setRx(value: RxFilter) {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value === 'ALL') next.delete('tipo');
      else next.set('tipo', value.toLowerCase());
      return next;
    });
  }

  // Solo se envían los filtros activos → clave de caché estable por combinación.
  const filter = useMemo<MedicationFilter>(() => {
    const f: MedicationFilter = {};
    if (search) f.search = search;
    if (categoryId) f.categoryId = categoryId;
    if (rx !== 'ALL') f.requiresPrescription = rx === 'RX';
    return f;
  }, [search, categoryId, rx]);

  const { data, loading, error, fetchMore, networkStatus } = useQuery(CatalogQuery, {
    variables: { filter, sort: SORTS[sort], first: PAGE_SIZE },
    notifyOnNetworkStatusChange: true,
  });
  const { data: categoriesData } = useQuery(CategoriesQuery);
  // Entrada ya presente en caché (la usa el contador del layout).
  const { data: cartData } = useQuery(MyCartQuery, { skip: user?.role !== 'PATIENT' });

  const connection = data?.medications;
  const loadingMore = networkStatus === NetworkStatus.fetchMore;
  const categories = categoriesData?.categories;
  const catalogSize = categories?.reduce((n, c) => n + c.medicationCount, 0);

  function loadMore() {
    if (!connection?.pageInfo.endCursor) return;
    // relayStylePagination (typePolicies) concatena la página nueva en caché.
    void fetchMore({ variables: { after: connection.pageInfo.endCursor } });
  }

  return (
    <div className="space-y-6">
      <Banner
        icon={<ShieldCheckIcon className="h-5 w-5" />}
        title="Tu farmacia, sin filas."
        action={<BannerAction role={user?.role} />}
      >
        Busca por nombre comercial, principio activo o categoría. Los medicamentos{' '}
        <span className="font-semibold text-violet-600">℞ con fórmula</span> son validados por nuestro químico
        farmacéutico antes del despacho.
      </Banner>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Medicamentos en catálogo" value={catalogSize ?? '—'} icon={<PillIcon className="h-4 w-4" />} tone="brand" />
        <StatCard label="Categorías terapéuticas" value={categories?.length ?? '—'} icon={<LayersIcon className="h-4 w-4" />} tone="sky" />
        <StatCard
          label="Resultados del filtro"
          value={connection?.totalCount ?? '—'}
          icon={<SlidersIcon className="h-4 w-4" />}
          tone="violet"
        />
        {user?.role === 'PATIENT' ? (
          <StatCard label="Unidades en tu carrito" value={cartData?.myCart?.itemCount ?? 0} icon={<CartIcon className="h-4 w-4" />} tone="amber" />
        ) : (
          <StatCard
            label="Cargados en pantalla"
            value={connection ? `${connection.edges.length}` : '—'}
            icon={<GridIcon className="h-4 w-4" />}
            tone="amber"
          />
        )}
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <CardHeader
          icon={<GridIcon className="h-5 w-5" />}
          title={search ? `Resultados para “${search}”` : 'Medicamentos'}
          subtitle={
            loading && !loadingMore ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="h-3 w-3" /> Buscando…
              </span>
            ) : connection ? (
              `${connection.totalCount} medicamentos · vista condensada del read model`
            ) : (
              'Vista condensada del read model'
            )
          }
          actions={
            <>
              <select className="select-pill" value={rx} onChange={(e) => setRx(e.target.value as RxFilter)} aria-label="Tipo de venta">
                <option value="ALL">Todos</option>
                <option value="OTC">Venta libre</option>
                <option value="RX">Con fórmula médica</option>
              </select>
              <select className="select-pill" value={sort} onChange={(e) => setSort(e.target.value as SortOption)} aria-label="Ordenar">
                <option value="NAME_ASC">Nombre (A-Z)</option>
                <option value="PRICE_ASC">Precio: menor a mayor</option>
                <option value="PRICE_DESC">Precio: mayor a menor</option>
              </select>
            </>
          }
        />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryChip active={categoryId === null} onClick={() => setCategoryId(null)}>
            Todas
          </CategoryChip>
          {categories?.map((c) => (
            <CategoryChip key={c.id} active={c.id === categoryId} onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}>
              {c.name} <span className="opacity-60">{c.medicationCount}</span>
            </CategoryChip>
          ))}
        </div>

        {error && !data && <Alert tone="error" title="No se pudo cargar el catálogo">{error.message}</Alert>}

        {!connection && loading ? (
          <PageLoader label="Cargando catálogo…" />
        ) : connection && connection.edges.length === 0 ? (
          <EmptyState icon={<SlidersIcon className="h-7 w-7" />} title="Sin resultados">
            No encontramos medicamentos con esos filtros. Prueba con el principio activo o quita la categoría.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {connection?.edges.map(({ node }) => <MedicationCard key={node.id} medication={node} />)}
          </div>
        )}

        {connection?.pageInfo.hasNextPage && (
          <div className="flex justify-center pt-1">
            <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Spinner className="h-4 w-4" /> : null}
              Cargar más ({connection.edges.length} de {connection.totalCount})
            </button>
          </div>
        )}
      </section>

      <QueryInspector document={CatalogQuery} title="Operación de la vista condensada (sin over-fetching)" />
    </div>
  );
}

function BannerAction({ role }: { role?: string }) {
  if (role === 'PATIENT') {
    return (
      <Link to="/carrito" className="btn-primary">
        <CartIcon className="h-4 w-4" /> Ver carrito
      </Link>
    );
  }
  if (role === 'PHARMACIST') {
    return (
      <Link to="/farmacia" className="btn-primary">
        <ClipboardIcon className="h-4 w-4" /> Ir a la bandeja
      </Link>
    );
  }
  return (
    <Link to="/ingresar" className="btn-primary">
      <LogInIcon className="h-4 w-4" /> Ingresar
    </Link>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`badge shrink-0 px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white shadow-brand' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
