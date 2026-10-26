import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Offers, { OfferFormPage } from "./pages/Offers";
import Categories, { CategoryFormPage } from "./pages/catalog/Categories";
import Products from "./pages/catalog/Products";
import ProductForm from "./pages/catalog/ProductForm";
import Brands, { BrandFormPage } from "./pages/catalog/Brands";
import Reviews from "./pages/catalog/Reviews";
import Orders from "./pages/orders/Orders";
import OrderDetail from "./pages/orders/OrderDetail";
import Returns, { ReturnPage } from "./pages/orders/Returns";
import Payments from "./pages/payments/Payments";
import Inventory from "./pages/inventory/Inventory";
import Delivery, { SlotFormPage, ZoneFormPage } from "./pages/delivery/Delivery";
import Support, { TicketPage } from "./pages/support/Support";
import Maintenance, { AssetDetailPage, AssetFormPage, JobFormPage } from "./pages/maintenance/Maintenance";
import Customers, { CustomerPage } from "./pages/customers/Customers";
import Users, { DeliveryBoys, NewUserPage } from "./pages/users/Users";
import DeliveryAreas, { DeliveryAreaFormPage } from "./pages/delivery/DeliveryAreas";
import Banners, { BannerFormPage } from "./pages/marketing/Banners";
import Notifications, { TemplateFormPage } from "./pages/marketing/Notifications";
import Referrals from "./pages/marketing/Referrals";
import LandingSections from "./pages/marketing/LandingSections";
import Reports from "./pages/reports/Reports";
import Stores, { StoreFormPage } from "./pages/settings/Stores";
import General from "./pages/settings/General";
import AuditLog from "./pages/settings/AuditLog";

// A route can require a permission. Without it the user is sent to the
// dashboard rather than shown an error — the nav already hides what they
// cannot reach, so landing here means a stale link or a changed role.
function Guard({ permission, children }) {
  const { session, loading, can } = useAuth();

  if (loading) return <Loading label="Checking your session" />;
  if (!session) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <Navigate to="/" replace />;

  return children;
}

function Shell() {
  const { session, loading } = useAuth();

  if (loading) return <Loading label="Loading" />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />

      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />

        <Route
          path="catalog/categories"
          element={<Guard permission="catalog.view"><Categories /></Guard>}
        />
        <Route
          path="catalog/products"
          element={<Guard permission="catalog.view"><Products /></Guard>}
        />
        <Route
          path="catalog/products/:id"
          element={<Guard permission="catalog.view"><ProductForm /></Guard>}
        />
        <Route path="catalog/brands" element={<Guard permission="catalog.view"><Brands /></Guard>} />
        <Route path="catalog/reviews" element={<Guard permission="catalog.view"><Reviews /></Guard>} />

        <Route path="orders" element={<Guard permission="orders.view"><Orders /></Guard>} />
        <Route path="orders/:id" element={<Guard permission="orders.view"><OrderDetail /></Guard>} />
        <Route path="returns" element={<Guard permission="orders.view"><Returns /></Guard>} />
        <Route path="payments" element={<Guard permission="orders.view"><Payments /></Guard>} />

        <Route path="inventory" element={<Guard permission="inventory.view"><Inventory /></Guard>} />
        <Route path="delivery" element={<Guard permission="delivery.view"><Delivery /></Guard>} />
        <Route path="delivery-areas" element={<Guard permission="settings.manage"><DeliveryAreas /></Guard>} />
        <Route path="delivery-areas/:id" element={<Guard permission="settings.manage"><DeliveryAreaFormPage /></Guard>} />
        <Route path="support" element={<Guard permission="customers.view"><Support /></Guard>} />
        <Route path="maintenance" element={<Guard permission="settings.manage"><Maintenance /></Guard>} />

        <Route path="customers" element={<Guard permission="customers.view"><Customers /></Guard>} />
        <Route path="users" element={<Guard permission="users.manage"><Users /></Guard>} />
        <Route path="delivery-boys" element={<Guard permission="users.manage"><DeliveryBoys /></Guard>} />
        <Route path="users/new" element={<Guard permission="users.manage"><NewUserPage /></Guard>} />
        <Route path="delivery-boys/new" element={<Guard permission="users.manage"><NewUserPage fixedRole="delivery_partner" /></Guard>} />

        <Route
          path="marketing/offers"
          element={<Guard permission="marketing.view"><Offers /></Guard>}
        />
        <Route
          path="marketing/banners"
          element={<Guard permission="marketing.view"><Banners /></Guard>}
        />
        <Route
          path="marketing/notifications"
          element={<Guard permission="marketing.view"><Notifications /></Guard>}
        />
        <Route path="landing-page" element={<Navigate to="/landing-page/sections" replace />} />
        <Route path="landing-page/sections" element={<Guard permission="marketing.view"><LandingSections /></Guard>} />
        <Route path="marketing/referrals" element={<Guard permission="marketing.view"><Referrals /></Guard>} />

        <Route path="reports" element={<Guard permission="reports.view"><Reports /></Guard>} />

        <Route path="settings/stores" element={<Guard permission="settings.manage"><Stores /></Guard>} />
        <Route path="settings/general" element={<Guard permission="settings.manage"><General /></Guard>} />
        <Route path="settings/audit" element={<Guard permission="reports.view"><AuditLog /></Guard>} />

        {/* Add / edit / detail pages — each form on its own URL, guarded by
            the permission its save needs ("new" is matched as the id). */}
        <Route path="catalog/categories/new" element={<Guard permission="catalog.manage"><CategoryFormPage /></Guard>} />
        <Route path="catalog/brands/:id" element={<Guard permission="catalog.manage"><BrandFormPage /></Guard>} />
        <Route path="returns/:id" element={<Guard permission="orders.view"><ReturnPage /></Guard>} />
        <Route path="delivery/zones/:id" element={<Guard permission="settings.manage"><ZoneFormPage /></Guard>} />
        <Route path="delivery/slots/:id" element={<Guard permission="settings.manage"><SlotFormPage /></Guard>} />
        <Route path="support/:id" element={<Guard permission="customers.view"><TicketPage /></Guard>} />
        <Route path="maintenance/assets/new" element={<Guard permission="settings.manage"><AssetFormPage /></Guard>} />
        <Route path="maintenance/assets/:id" element={<Guard permission="settings.manage"><AssetDetailPage /></Guard>} />
        <Route path="maintenance/jobs/new" element={<Guard permission="settings.manage"><JobFormPage /></Guard>} />
        <Route path="customers/:id" element={<Guard permission="customers.view"><CustomerPage /></Guard>} />
        <Route path="marketing/offers/:id" element={<Guard permission="marketing.manage"><OfferFormPage /></Guard>} />
        <Route path="marketing/banners/:id" element={<Guard permission="marketing.manage"><BannerFormPage /></Guard>} />
        <Route
          path="marketing/notifications/templates/:id"
          element={<Guard permission="marketing.manage"><TemplateFormPage /></Guard>}
        />
        <Route path="settings/stores/:id" element={<Guard permission="settings.manage"><StoreFormPage /></Guard>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
