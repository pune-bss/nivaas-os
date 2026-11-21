import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './components/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { testConnection } from './firebase/config';
import { AppRole } from './types/crm';

import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { CustomersPage } from './pages/CustomersPage';
import { SiteVisitsPage } from './pages/SiteVisitsPage';
import { DealsPage } from './pages/DealsPage';
import { CommissionsPage } from './pages/CommissionsPage';
import { TasksPage } from './pages/TasksPage';
import { TeamPage } from './pages/TeamPage';
import { ReportsPage } from './pages/ReportsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { BillingPage } from './pages/BillingPage';
import { SettingsPage } from './pages/SettingsPage';

function WorkspaceLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm">
      Initializing NivaasOS secure workspace...
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const {
    firebaseUser,
    profile,
    company,
    loading,
    needsOnboarding,
    needsEmailVerification,
    needs2FA,
  } = useAuth();

  if (loading) return <WorkspaceLoadingScreen />;

  if (!firebaseUser || needsEmailVerification || needsOnboarding || needs2FA || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (
    profile.role !== 'super_admin' &&
    (profile.status === 'pending_approval' ||
      profile.status === 'suspended' ||
      company?.status === 'pending_approval' ||
      company?.status === 'suspended')
  ) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

function RoleGuard({
  allowedRoles,
  requiresCompany = true,
  children,
}: {
  allowedRoles: AppRole[];
  requiresCompany?: boolean;
  children: React.ReactNode;
}) {
  const { activeRole, activeCompanyId } = useAuth();

  if (!activeRole) return <Navigate to="/auth" replace />;

  if (requiresCompany && !activeCompanyId) {
    return <Navigate to={activeRole === 'super_admin' ? '/app/super-admin' : '/app/dashboard'} replace />;
  }

  if (!allowedRoles.includes(activeRole)) {
    return <Navigate to={activeRole === 'super_admin' ? '/app/super-admin' : '/app/dashboard'} replace />;
  }

  return <>{children}</>;
}

function AppDefaultRedirect() {
  const { activeRole, activeCompanyId } = useAuth();
  if (activeRole === 'super_admin' && !activeCompanyId) {
    return <Navigate to="/app/super-admin" replace />;
  }
  return <Navigate to="/app/dashboard" replace />;
}

export default function App() {
  useEffect(() => {
    testConnection().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/pending-approval" element={<PendingApprovalPage />} />

                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AppDefaultRedirect />} />
                    <Route
                      path="super-admin"
                      element={
                        <RoleGuard allowedRoles={['super_admin']} requiresCompany={false}>
                          <SuperAdminPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="dashboard"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                            'receptionist',
                          ]}
                        >
                          <DashboardPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="leads"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'receptionist',
                          ]}
                        >
                          <LeadsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="properties"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'receptionist',
                          ]}
                        >
                          <PropertiesPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="customers"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                          ]}
                        >
                          <CustomersPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="site-visits"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'receptionist',
                          ]}
                        >
                          <SiteVisitsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="deals"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                          ]}
                        >
                          <DealsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="commissions"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                          ]}
                        >
                          <CommissionsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="tasks"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                            'receptionist',
                          ]}
                        >
                          <TasksPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="team"
                      element={
                        <RoleGuard allowedRoles={['company_admin', 'sales_manager']}>
                          <TeamPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="reports"
                      element={
                        <RoleGuard allowedRoles={['company_admin', 'sales_manager', 'accountant']}>
                          <ReportsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="documents"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                          ]}
                        >
                          <DocumentsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="billing"
                      element={
                        <RoleGuard allowedRoles={['company_admin', 'accountant']}>
                          <BillingPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <RoleGuard
                          allowedRoles={[
                            'super_admin',
                            'company_admin',
                            'sales_manager',
                            'sales_executive',
                            'accountant',
                            'receptionist',
                          ]}
                          requiresCompany={false}
                        >
                          <SettingsPage />
                        </RoleGuard>
                      }
                    />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
