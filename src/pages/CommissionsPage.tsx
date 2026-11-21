import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileDown, Download, CheckCircle2, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
} from '../firebase/firestoreService';
import { Commission, CommissionStatus, Deal, UserProfile } from '../types/crm';
import { formatINR } from '../utils/india';
import { exportToCsv, exportToExcel, generateCommissionStatementPdf } from '../utils/export';

export function CommissionsPage() {
  const { activeCompanyId, activeRole, profile, company } = useAuth();
  const { showToast } = useToast();

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  // Form
  const [dealId, setDealId] = useState('');
  const [agentUid, setAgentUid] = useState('');
  const [ruleType, setRuleType] = useState<'percentage' | 'fixed'>('percentage');
  const [ratePercent, setRatePercent] = useState('2');
  const [fixedAmount, setFixedAmount] = useState('150000');
  const [splitPercent, setSplitPercent] = useState('100');
  const [tdsPercent, setTdsPercent] = useState('5');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const u1 = subscribeTenantCollection<Commission>(
      activeCompanyId,
      'commissions',
      (items) => {
        const scoped =
          activeRole === 'sales_executive' && profile?.uid
            ? items.filter((c) => c.agentUid === profile.uid)
            : items;
        setCommissions(scoped);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    const u2 = subscribeTenantCollection<Deal>(activeCompanyId, 'deals', (items) => {
      setDeals(items);
      if (items.length > 0 && !dealId) setDealId(items[0].id);
    }, [], () => {});
    getDocs(query(collection(db, 'users'), where('companyId', '==', activeCompanyId)))
      .then((snap) => {
        const members = snap.docs.map((d) => d.data() as UserProfile).filter((m) => !m.isDeleted);
        setTeam(members);
        if (members.length > 0 && !agentUid) setAgentUid(profile?.uid || members[0].uid);
      })
      .catch(() => {});
    return () => {
      u1();
      u2();
    };
  }, [activeCompanyId, activeRole, profile?.uid]);

  const filtered = useMemo(
    () => commissions.filter((c) => statusFilter === 'all' || c.status === statusFilter),
    [commissions, statusFilter]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => {
        acc.gross += Number(c.grossAmountInr || 0);
        acc.tds += Number(c.tdsAmountInr || 0);
        acc.net += Number(c.netPayableInr || 0);
        return acc;
      },
      { gross: 0, tds: 0, net: 0 }
    );
  }, [filtered]);

  const canApproveOrPay =
    activeRole === 'company_admin' || activeRole === 'accountant' || activeRole === 'super_admin';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const deal = deals.find((d) => d.id === dealId);
    const agent = team.find((m) => m.uid === agentUid);
    if (!deal) {
      showToast('Select a valid deal first.', 'error');
      return;
    }

    const split = Math.min(100, Math.max(1, Number(splitPercent || 100)));
    const baseGross =
      ruleType === 'percentage'
        ? Math.round((deal.dealValueInr * Number(ratePercent || 2)) / 100)
        : Number(fixedAmount || 0);
    const grossAmountInr = Math.round((baseGross * split) / 100);
    const tdsPct = Number(tdsPercent || 5);
    const tdsAmountInr = Math.round((grossAmountInr * tdsPct) / 100);
    const netPayableInr = grossAmountInr - tdsAmountInr;

    await createTenantDoc(activeCompanyId, 'commissions', {
      dealId: deal.id,
      dealTitle: deal.title,
      agentUid: agent?.uid || profile?.uid || 'agent',
      agentName: agent?.displayName || profile?.displayName || 'Advisor',
      ruleType,
      ratePercent: ruleType === 'percentage' ? Number(ratePercent) : 0,
      grossAmountInr,
      tdsPercent: tdsPct,
      tdsAmountInr,
      netPayableInr,
      splitPercent: split,
      status: 'pending',
    });
    showToast('Commission entry created with TDS calculation.', 'success');
    setShowAdd(false);
  };

  const handleStatusChange = async (c: Commission, nextStatus: CommissionStatus) => {
    if (!activeCompanyId) return;
    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'paid') {
      updates.paidAt = new Date().toISOString().slice(0, 10);
      updates.payoutReference = `UTR${Date.now().toString().slice(-8)}`;
    }
    await updateTenantDoc(activeCompanyId, 'commissions', c.id, updates);
    showToast(`Commission marked ${nextStatus}.`, 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Commissions, Splits & Section 194H TDS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Percentage or fixed brokerage rules · Multi-agent splits · Accountant payout workflow
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'nivaasos-commissions.csv',
                filtered.map((c) => ({
                  Deal: c.dealTitle || c.dealId,
                  Agent: c.agentName || c.agentUid,
                  GrossINR: c.grossAmountInr,
                  TDS_INR: c.tdsAmountInr || 0,
                  NetPayableINR: c.netPayableInr,
                  Status: c.status,
                  UTR: c.payoutReference || '',
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportToExcel(
                'nivaasos-commissions.xlsx',
                'Commissions',
                filtered.map((c) => ({ Deal: c.dealTitle || '', Agent: c.agentName || '', NetINR: c.netPayableInr, Status: c.status }))
              )
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            Excel
          </button>
          {canApproveOrPay && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
            >
              <Plus className="h-4 w-4" />
              Add Commission Split
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">Gross Brokerage</div>
          <div className="font-mono tabular-nums text-xl font-bold mt-1">{formatINR(totals.gross)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">TDS Deducted (u/s 194H)</div>
          <div className="font-mono tabular-nums text-xl font-bold text-amber-600 mt-1">{formatINR(totals.tds)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">Net Payable</div>
          <div className="font-mono tabular-nums text-xl font-bold text-emerald-600 mt-1">{formatINR(totals.net)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-1">
          {(['all', 'pending', 'approved', 'paid'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                statusFilter === s ? 'bg-slate-900 text-white dark:bg-teal-600' : 'text-slate-500'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Deal · Agent</th>
                <th className="px-4 py-3 font-semibold">Rule / Split</th>
                <th className="px-4 py-3 font-semibold">Gross</th>
                <th className="px-4 py-3 font-semibold">TDS</th>
                <th className="px-4 py-3 font-semibold">Net Payable</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading commissions...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No commission records found.</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.dealTitle || c.dealId}</div>
                      <div className="text-[11px] text-slate-500">{c.agentName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {c.ruleType === 'percentage' ? `${c.ratePercent}%` : 'Fixed'} · {c.splitPercent || 100}% split
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatINR(c.grossAmountInr)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-amber-600">-{formatINR(c.tdsAmountInr)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white">{formatINR(c.netPayableInr)}</td>
                    <td className="px-4 py-3">
                      {canApproveOrPay ? (
                        <select
                          value={c.status}
                          onChange={(e) => handleStatusChange(c, e.target.value as CommissionStatus)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs capitalize"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="paid">Paid</option>
                        </select>
                      ) : (
                        <span className="capitalize font-medium">{c.status}</span>
                      )}
                      {c.payoutReference && (
                        <div className="font-mono text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {c.payoutReference}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          generateCommissionStatementPdf({
                            companyName: company?.name || 'NivaasOS Tenant',
                            gstNumber: company?.gstNumber,
                            agentName: c.agentName || 'Advisor',
                            dealTitle: c.dealTitle || c.dealId,
                            grossInr: c.grossAmountInr,
                            tdsPercent: c.tdsPercent || 5,
                            tdsInr: c.tdsAmountInr || 0,
                            netInr: c.netPayableInr,
                            status: c.status,
                            payoutRef: c.payoutReference,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <FileDown className="h-3.5 w-3.5 text-teal-600" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleCreate} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Add Commission Rule / Split</h2>
              <button type="button" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deal *</label>
              <select required value={dealId} onChange={(e) => setDealId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                <option value="">Select deal...</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.title} ({formatINR(d.dealValueInr)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Agent *</label>
              <select required value={agentUid} onChange={(e) => setAgentUid(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                {team.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Rule Type</label>
                <select value={ruleType} onChange={(e) => setRuleType(e.target.value as 'percentage' | 'fixed')} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (INR)</option>
                </select>
              </div>
              {ruleType === 'percentage' ? (
                <div>
                  <label className="block text-xs font-medium mb-1">Brokerage %</label>
                  <input type="number" step="0.1" value={ratePercent} onChange={(e) => setRatePercent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1">Fixed Amount (INR)</label>
                  <input type="number" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Agent Split %</label>
                <input type="number" min={1} max={100} value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">TDS % (Sec 194H)</label>
                <input type="number" min={0} max={30} value={tdsPercent} onChange={(e) => setTdsPercent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Save Commission</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
