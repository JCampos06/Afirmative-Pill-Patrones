import { Link, Route, Routes } from 'react-router';
import { CompassIcon } from './components/icons';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { EmptyState } from './components/ui';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { MedicationDetailPage } from './pages/MedicationDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { PharmacyPage } from './pages/PharmacyPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="medicamentos/:id" element={<MedicationDetailPage />} />
        <Route path="ingresar" element={<LoginPage />} />
        <Route
          path="carrito"
          element={
            <RequireAuth role="PATIENT">
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="pedidos"
          element={
            <RequireAuth role="PATIENT">
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="pedidos/:id"
          element={
            <RequireAuth>
              <OrderTrackingPage />
            </RequireAuth>
          }
        />
        <Route
          path="farmacia"
          element={
            <RequireAuth role="PHARMACIST">
              <PharmacyPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState icon={<CompassIcon className="h-7 w-7" />} title="Página no encontrada">
              <Link className="font-semibold text-brand-700 underline" to="/">
                Volver al catálogo
              </Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
