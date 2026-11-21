import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, X, Building2, Users, FileCheck2, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listTenantDocs } from '../firebase/firestoreService';
import { Lead, Property, Deal, Customer } from '../types/crm';
import { formatINRCompact } from '../utils/india';

interface SearchEntry {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  category: 'Page' | 'Lead' | 'Property' | 'Deal' | 'Customer';
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeCompanyId, activeRole } = useAuth();
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setQueryText('');
    const staticRoutes: SearchEntry[] = [
      { id: 'nav-dash', title: 'Dashboard', subtitle: 'KPIs, conversion funnel & daily follow-ups', route: '/app/dashboard', category: 'Page' },
      { id: 'nav-leads', title: 'Leads Pipeline', subtitle: 'Kanban board, 99acres/MagicBricks, WhatsApp', route: '/app/leads', category: 'Page' },
      { id: 'nav-props', title: 'Properties & Projects', subtitle: 'Inventory grid, RERA IDs, builder towers', route: '/app/properties', category: 'Page' },
      { id: 'nav-cust', title: 'Customers & KYC', subtitle: 'Buyers, sellers & masked Aadhaar KYC', route: '/app/customers', category: 'Page' },
      { id: 'nav-visits', title: 'Site Visits Calendar', subtitle: 'Day/week/month schedule & feedback', route: '/app/site-visits', category: 'Page' },
      { id: 'nav-deals', title: 'Deals & Stamp Duty', subtitle: 'Bookings, milestones & state stamp duty', route: '/app/deals', category: 'Page' },
      { id: 'nav-comm', title: 'Commissions & TDS', subtitle: 'Brokerage splits, 194H TDS & PDF statements', route: '/app/commissions', category: 'Page' },
      { id: 'nav-tasks', title: 'Tasks & Follow-ups', subtitle: 'Overdue alerts & daily reminders', route: '/app/tasks', category: 'Page' },
      { id: 'nav-reports', title: 'Analytics & Reports', subtitle: 'Date filters, charts & PDF/Excel exports', route: '/app/reports', category: 'Page' },
      { id: 'nav-settings', title: 'Settings & DPDP Compliance', subtitle: 'Company profile, 2FA, audit logs & data export', route: '/app/settings', category: 'Page' },
    ];
    if (activeRole === 'super_admin') {
      staticRoutes.unshift({
        id: 'nav-super',
        title: 'Platform Super Admin',
        subtitle: 'Approve companies, plans, impersonation & logs',
        route: '/app/super-admin',
        category: 'Page',
      });
    }

    if (!activeCompanyId) {
      setEntries(staticRoutes);
      return;
    }

    let cancelled = false;
    Promise.all([
      listTenantDocs<Lead>(activeCompanyId, 'leads').catch(() => []),
      listTenantDocs<Property>(activeCompanyId, 'properties').catch(() => []),
      listTenantDocs<Deal>(activeCompanyId, 'deals').catch(() => []),
      listTenantDocs<Customer>(activeCompanyId, 'customers').catch(() => []),
    ]).then(([leads, props, deals, customers]) => {
      if (cancelled) return;
      const dynamic: SearchEntry[] = [
        ...leads.slice(0, 25).map((l) => ({
          id: `lead-${l.id}`,
          title: l.fullName,
          subtitle: `${l.phone} · ${l.stage} · ${l.preferredLocation || 'India'}`,
          route: '/app/leads',
          category: 'Lead' as const,
        })),
        ...props.slice(0, 25).map((p) => ({
          id: `prop-${p.id}`,
          title: p.title,
          subtitle: `${p.city || ''} · ${formatINRCompact(p.priceInr)} · ${p.status}`,
          route: '/app/properties',
          category: 'Property' as const,
        })),
        ...deals.slice(0, 20).map((d) => ({
          id: `deal-${d.id}`,
          title: d.title,
          subtitle: `${d.stage} · ${formatINRCompact(d.dealValueInr)}`,
          route: '/app/deals',
          category: 'Deal' as const,
        })),
        ...customers.slice(0, 20).map((c) => ({
          id: `cust-${c.id}`,
          title: c.fullName,
          subtitle: `${c.customerType} · ${c.phone} · KYC ${c.kycStatus}`,
          route: '/app/customers',
          category: 'Customer' as const,
        })),
      ];
      setEntries([...staticRoutes, ...dynamic]);
    });

    return () => {
      cancelled = true;
    };
  }, [open, activeCompanyId, activeRole]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return entries.slice(0, 10);
    return entries
      .filter((e) => e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      .slice(0, 12);
  }, [entries, queryText]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-xs pt-20 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global CRM Search"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search leads, properties, deals, customers, or jump to module..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching records found.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.route);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    {item.category === 'Property' ? (
                      <Building2 className="h-4 w-4" />
                    ) : item.category === 'Lead' || item.category === 'Customer' ? (
                      <Users className="h-4 w-4" />
                    ) : item.category === 'Deal' ? (
                      <FileCheck2 className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.category} · {item.subtitle}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
