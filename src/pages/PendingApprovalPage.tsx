import React from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PendingApprovalPage() {
  const { profile, company, logout, refreshProfile } = useAuth();
  const isSuspended = profile?.status === 'suspended' || company?.status === 'suspended';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          {isSuspended ? (
            <ShieldAlert className="h-7 w-7 text-rose-600" />
          ) : (
            <Clock className="h-7 w-7 text-amber-600" />
          )}
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {isSuspended ? 'Account or Organization Suspended' : 'Company Pending Super Admin Approval'}
          </h1>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {isSuspended
            ? 'Access for your organization has been temporarily suspended by the platform administrator. Please contact support to restore billing or compliance status.'
            : `Thank you for registering ${company?.name || 'your company'}. Your RERA/GST profile is currently in the Super Admin verification queue. Once approved, your full CRM workspace will unlock automatically.`}
        </p>

        {company && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-xs space-y-1.5 mb-6">
            <div><span className="text-slate-500">Company ID:</span> <span className="font-mono">{company.companyId}</span></div>
            <div><span className="text-slate-500">City / State:</span> {company.city}, {company.state}</div>
            <div><span className="text-slate-500">GSTIN:</span> <span className="font-mono">{company.gstNumber || 'Not provided'}</span></div>
            <div><span className="text-slate-500">RERA:</span> <span className="font-mono">{company.reraNumber || 'Not provided'}</span></div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500"
          >
            <RefreshCw className="h-4 w-4" />
            Check Approval Status
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
