import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Spinner } from './components/Spinner';
import { AuthProvider } from './features/auth/AuthProvider';
import { RequireAdmin } from './features/auth/RequireAdmin';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequestServicePage } from './pages/RequestServicePage';
import { ServicesPage } from './pages/ServicesPage';

// Admin screens are code-split so customers never download them.
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const RequestsPage = lazy(() => import('./pages/admin/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const RequestDetailPage = lazy(() => import('./pages/admin/RequestDetailPage').then((m) => ({ default: m.RequestDetailPage })));
const EscalationsPage = lazy(() => import('./pages/admin/EscalationsPage').then((m) => ({ default: m.EscalationsPage })));
const KnowledgePage = lazy(() => import('./pages/admin/KnowledgePage').then((m) => ({ default: m.KnowledgePage })));
const AuditPage = lazy(() => import('./pages/admin/AuditPage').then((m) => ({ default: m.AuditPage })));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="fullpage-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="request-service" element={<RequestServicePage />} />
              <Route path="about" element={<AboutPage />} />
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Every other /admin route requires an authenticated administrator. */}
            <Route path="/admin" element={<RequireAdmin />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="requests/:id" element={<RequestDetailPage />} />
                <Route path="escalations" element={<EscalationsPage />} />
                <Route path="knowledge" element={<KnowledgePage />} />
                <Route path="audit" element={<AuditPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
