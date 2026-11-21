import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  query,
  limit,
} from 'firebase/firestore';
import {
  CheckCircle2,
  PauseCircle,
  Trash2,
  Eye,
  Database,
  Plus,
  Search,
  Building2,
  ShieldAlert,
} from 'lucide-react';
import { db, auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { AuditLog, BusinessType, Company, PlanId } from '../types/crm';
import { DEFAULT_PLANS, seedDemoEcosystem } from '../firebase/seedClientData';
import { formatINR, INDIAN_STATES } from '../utils/india';
import { writeAuditEvent } from '../firebase/firestoreService';

export function SuperAdminPage() {
  const { profile, impersonateCompany } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_approval' | 'active' | 'suspended'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create company form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<BusinessType>('agency');
  const [newEmail, setNewEmail] = useState('');
  const [newCity, setNewCity] = useState('Mumbai');
  const [newState, setNewState] = useState('Maharashtra');
  const [newPlan, setNewPlan] = useState<PlanId>('starter');

  useEffect(() => {
    if (profile?.role !== 'super_admin') return;
    const unsubCompanies = onSnapshot(
      collection(db, 'companies'),
      (snap) => {
        const list: Company[] = [];
        snap.forEach((d) => {
          const data = d.data() as Company;
          if (!data.isDeleted) list.push(data);
        });
        setCompanies(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const qLogs = query(
      collection(db, 'platform/auditLogs/items'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        const logs: AuditLog[] = [];
        snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as AuditLog));
        setAuditLogs(logs);
      },
      () => {}
    );

    return () => {
      unsubCompanies();
      unsubLogs();
    };
  }, [profile?.role]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.companyId.toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.ownerEmail || '').toLowerCase().includes(q)
      );
    });
  }, [companies, statusFilter, search]);

  const totalMrrInr = useMemo(() => {
    return companies
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => {
        const plan = DEFAULT_PLANS.find((p) => p.planId === c.planId);
        return sum + (plan?.priceMonthlyInr || 0);
      }, 0);
  }, [companies]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedDemoEcosystem();
      showToast(`Seeded ${res.companiesCreated} Indian real estate companies & ${res.recordsCreated} records.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Seed failed.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleApprove = async (comp: Company) => {
    const plan = DEFAULT_PLANS.find((p) => p.planId === comp.planId) || DEFAULT_PLANS[1];
    try {
      await updateDoc(doc(db, 'companies', comp.companyId), {
        status: 'active',
        userLimit: plan.userLimit,
        propertyLimit: plan.propertyLimit,
        updatedAt: serverTimestamp(),
      });
      if (comp.ownerUid && !comp.ownerUid.startsWith('demo_')) {
        await updateDoc(doc(db, 'users', comp.ownerUid), {
          status: 'active',
          role: 'company_admin',
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      await writeAuditEvent({
        companyId: comp.companyId,
        eventType: 'company_approval',
        targetPath: `companies/${comp.companyId}`,
        details: `Approved ${comp.name}`,
      });
      showToast(`${comp.name} approved and activated.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Approval failed.', 'error');
    }
  };

  const handleSuspendToggle = async (comp: Company) => {
    const nextStatus = comp.status === 'suspended' ? 'active' : 'suspended';
    await updateDoc(doc(db, 'companies', comp.companyId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    await writeAuditEvent({
      companyId: comp.companyId,
      eventType: 'company_approval',
      targetPath: `companies/${comp.companyId}`,
      details: `Set ${comp.name} status to ${nextStatus}`,
    });
    showToast(`${comp.name} is now ${nextStatus}.`, 'info');
  };

  const handlePlanChange = async (comp: Company, planId: PlanId) => {
    const plan = DEFAULT_PLANS.find((p) => p.planId === planId) || DEFAULT_PLANS[0];
    await updateDoc(doc(db, 'companies', comp.companyId), {
      planId,
      userLimit: plan.userLimit,
      propertyLimit: plan.propertyLimit,
      updatedAt: serverTimestamp(),
    });
    await writeAuditEvent({
      companyId: comp.companyId,
      eventType: 'role_change',
      targetPath: `companies/${comp.companyId}`,
      details: `Updated ${comp.name} subscription to ${plan.name}`,
    });
    showToast(`Plan updated to ${plan.name}.`, 'success');
  };

  const handleSoftDelete = async (comp: Company) => {
    await updateDoc(doc(db, 'companies', comp.companyId), {
      isDeleted: true,
      status: 'suspended',
      updatedAt: serverTimestamp(),
    });
    await writeAuditEvent({
      companyId: comp.companyId,
      eventType: 'soft_delete',
      targetPath: `companies/${comp.companyId}`,
      details: `Soft-deleted company ${comp.name}`,
    });
    showToast(`${comp.name} removed.`, 'info');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const plan = DEFAULT_PLANS.find((p) => p.planId === newPlan) || DEFAULT_PLANS[1];
    const companyId = `${newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32)}_${Date.now().toString(36)}`;
    await setDoc(doc(db, 'companies', companyId), {
      companyId,
      name: newName.trim(),
      businessType: newType,
      ownerUid: uid,
      ownerEmail: newEmail.trim(),
      city: newCity.trim(),
      state: newState,
      status: 'active',
      planId: newPlan,
      userLimit: plan.userLimit,
      propertyLimit: plan.propertyLimit,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    setShowCreateModal(false);
    setNewName('');
    setNewEmail('');
    showToast(`Company ${newName} created and activated.`, 'success');
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
        <ShieldAlert className="h-8 w-8 text-rose-600 mx-auto mb-2" />
        <p className="text-sm font-medium">Super Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Platform Super Admin Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage real estate tenant onboarding, subscription quotas, impersonation, and audit logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Database className="h-4 w-4 text-teal-600" />
            {seeding ? 'Seeding Demo Data...' : 'Seed Demo Ecosystem'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            Register Company
          </button>
        </div>
      </div>

      {/* Platform KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Total Tenant Companies</div>
          <div className="font-mono tabular-nums text-2xl font-bold mt-1">{companies.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Pending Approvals</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-amber-600 mt-1">
            {companies.filter((c) => c.status === 'pending_approval').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Active Tenants</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-emerald-600 mt-1">
            {companies.filter((c) => c.status === 'active').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Platform Monthly MRR</div>
          <div className="font-mono tabular-nums text-2xl font-bold mt-1">{formatINR(totalMrrInr)}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, ID, city, or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(['all', 'pending_approval', 'active', 'suspended'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Type · Location</th>
                <th className="px-4 py-3 font-semibold">GST / RERA</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Subscription Plan</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading companies...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    <Building2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No companies match your filter. Click <strong>Seed Demo Ecosystem</strong> above to load sample Indian real estate tenants.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((c) => (
                  <tr key={c.companyId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{c.companyId} · {c.ownerEmail}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {c.businessType} · {c.city || '—'}, {c.state || ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div>GST: {c.gstNumber || '—'}</div>
                      <div>RERA: {c.reraNumber || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium capitalize ${
                          c.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : c.status === 'pending_approval'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Plan for ${c.name}`}
                        value={c.planId}
                        onChange={(e) => handlePlanChange(c, e.target.value as PlanId)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        {DEFAULT_PLANS.map((p) => (
                          <option key={p.planId} value={p.planId}>
                            {p.name} ({p.userLimit}u / {p.propertyLimit}p)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {c.status !== 'active' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(c)}
                            title="Approve company"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await impersonateCompany(c);
                            navigate('/app/dashboard');
                          }}
                          title="Impersonate Company Admin (audited)"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Enter
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSuspendToggle(c)}
                          title={c.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSoftDelete(c)}
                          title="Soft delete company"
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Audit Logs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="font-display text-base font-bold mb-3">Platform Audit Trail (Latest 40 Events)</h2>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No audit events logged yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {log.eventType.replace('_', ' ')}
                  </span>
                  <span className="text-slate-400 mx-2">·</span>
                  <span className="text-slate-600 dark:text-slate-300">{log.details}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {log.actorEmail || log.actorUid}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Company Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleCreateCompany}
            className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold">Register Active Company</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Business Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as BusinessType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="agency">Agency</option>
                  <option value="broker">Broker</option>
                  <option value="builder">Builder</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Plan</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as PlanId)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {DEFAULT_PLANS.map((p) => (
                    <option key={p.planId} value={p.planId}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Admin Email *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">City</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">State</label>
                <select
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
              >
                Create Company
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
