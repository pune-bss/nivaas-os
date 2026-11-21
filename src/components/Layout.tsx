import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  CalendarClock,
  Briefcase,
  BadgeIndianRupee,
  UserCog,
  CheckSquare,
  BarChart3,
  FolderLock,
  CreditCard,
  Settings,
  ShieldCheck,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { CommandPalette } from './CommandPalette';
import { AppNotification, AppRole } from '../types/crm';
import { subscribeTenantCollection, updateTenantDoc } from '../firebase/firestoreService';

interface NavItem {
  key: string;
  labelKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: AppRole[];
  requiresCompany?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'superAdmin',
    labelKey: 'superAdmin',
    path: '/app/super-admin',
    icon: ShieldCheck,
    allowedRoles: ['super_admin'],
  },
  {
    key: 'dashboard',
    labelKey: 'dashboard',
    path: '/app/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant', 'receptionist'],
    requiresCompany: true,
  },
  {
    key: 'leads',
    labelKey: 'leads',
    path: '/app/leads',
    icon: Users,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'receptionist'],
    requiresCompany: true,
  },
  {
    key: 'properties',
    labelKey: 'properties',
    path: '/app/properties',
    icon: Building2,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'receptionist'],
    requiresCompany: true,
  },
  {
    key: 'customers',
    labelKey: 'customers',
    path: '/app/customers',
    icon: UserCheck,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'siteVisits',
    labelKey: 'siteVisits',
    path: '/app/site-visits',
    icon: CalendarClock,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'receptionist'],
    requiresCompany: true,
  },
  {
    key: 'deals',
    labelKey: 'deals',
    path: '/app/deals',
    icon: Briefcase,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'commissions',
    labelKey: 'commissions',
    path: '/app/commissions',
    icon: BadgeIndianRupee,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'tasks',
    labelKey: 'tasks',
    path: '/app/tasks',
    icon: CheckSquare,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant', 'receptionist'],
    requiresCompany: true,
  },
  {
    key: 'team',
    labelKey: 'team',
    path: '/app/team',
    icon: UserCog,
    allowedRoles: ['company_admin', 'sales_manager'],
    requiresCompany: true,
  },
  {
    key: 'reports',
    labelKey: 'reports',
    path: '/app/reports',
    icon: BarChart3,
    allowedRoles: ['company_admin', 'sales_manager', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'documents',
    labelKey: 'documents',
    path: '/app/documents',
    icon: FolderLock,
    allowedRoles: ['company_admin', 'sales_manager', 'sales_executive', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'billing',
    labelKey: 'billing',
    path: '/app/billing',
    icon: CreditCard,
    allowedRoles: ['company_admin', 'accountant'],
    requiresCompany: true,
  },
  {
    key: 'settings',
    labelKey: 'settings',
    path: '/app/settings',
    icon: Settings,
    allowedRoles: ['super_admin', 'company_admin', 'sales_manager', 'sales_executive', 'accountant', 'receptionist'],
  },
];

export function Layout() {
  const {
    profile,
    company,
    activeCompanyId,
    activeRole,
    impersonatedCompany,
    exitImpersonation,
    logout,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Real-time notifications
  useEffect(() => {
    if (!activeCompanyId || !profile?.uid) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeTenantCollection<AppNotification>(
      activeCompanyId,
      'notifications',
      (items) => {
        setNotifications(items.filter((n) => n.recipientUid === profile.uid));
      },
      [],
      () => {}
    );
    return () => unsub();
  }, [activeCompanyId, profile?.uid]);

  const visibleNav = useMemo(() => {
    if (!activeRole) return [];
    return NAV_ITEMS.filter((item) => {
      if (item.requiresCompany && !activeCompanyId) return false;
      if (impersonatedCompany && item.key === 'superAdmin') return true;
      return item.allowedRoles.includes(activeRole);
    });
  }, [activeRole, activeCompanyId, impersonatedCompany]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const activeNav = visibleNav.find((n) => location.pathname.startsWith(n.path));
  const breadcrumbLabel = activeNav ? t(activeNav.labelKey) : 'Workspace';

  const markNotifRead = async (n: AppNotification) => {
    if (!activeCompanyId || n.read) return;
    await updateTenantDoc(activeCompanyId, 'notifications', n.id, { read: true });
    if (n.link) {
      navigate(n.link);
      setNotifOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Collapsible Sidebar */}
      <aside
        aria-label="Primary Navigation"
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 transition-all duration-200 shrink-0 ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              N
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-base tracking-tight text-white truncate">
                NivaasOS
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Tenant Context */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-slate-800/80 text-xs">
            <div className="text-slate-400 truncate">
              {company ? company.name : 'Platform Administration'}
            </div>
            <div className="text-teal-400 font-medium mt-0.5 capitalize truncate">
              {(activeRole || 'user').replace(/_/g, ' ')}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? t(item.labelKey) : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => logout(false)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('signOut')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {impersonatedCompany && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Super Admin Impersonation Active: Viewing <strong>{impersonatedCompany.name}</strong> ({impersonatedCompany.companyId}). All actions are audit-logged.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                exitImpersonation();
                navigate('/app/super-admin');
              }}
              className="px-3 py-1 rounded-md bg-slate-950 text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Top Bar */}
        <header className="h-16 sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Menu className="h-4 w-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">NivaasOS</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {breadcrumbLabel}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t('searchShortcut')}</span>
            </button>

            <select
              aria-label="Select Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'mr')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="en">EN</option>
              <option value="hi">हिं</option>
              <option value="mr">म</option>
            </select>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-teal-600 text-white text-[10px] font-semibold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        You are all caught up.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markNotifRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                            n.read ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {n.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {n.message}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-teal-700 text-white flex items-center justify-center text-xs font-bold">
                {(profile?.displayName || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className="text-xs leading-tight max-w-[130px]">
                <div className="font-semibold truncate">{profile?.displayName || 'User'}</div>
                <div className="text-slate-500 dark:text-slate-400 truncate">{profile?.email}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
