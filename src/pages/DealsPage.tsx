import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Calculator, Download, X, CheckCircle2, Circle } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
} from '../firebase/firestoreService';
import { Customer, DEAL_STAGES, Deal, DealStage, PaymentMilestone, Property, UserProfile } from '../types/crm';
import { estimateStampDutyAndReg, formatINR, formatINRCompact, INDIAN_STATES } from '../utils/india';
import { exportToCsv, exportToExcel } from '../utils/export';

export function DealsPage() {
  const { activeCompanyId, activeRole, profile } = useAuth();
  const { showToast } = useToast();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Stamp duty estimator widget
  const [estAmount, setEstAmount] = useState(25000000);
  const [estState, setEstState] = useState('Maharashtra');
  const [estGender, setEstGender] = useState<'male' | 'female'>('male');
  const dutyEst = useMemo(() => estimateStampDutyAndReg(estAmount, estState, estGender), [estAmount, estState, estGender]);

  // Add deal form
  const [title, setTitle] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [agentUid, setAgentUid] = useState('');
  const [dealValueInr, setDealValueInr] = useState('25000000');
  const [tokenAmountInr, setTokenAmountInr] = useState('500000');
  const [bookingAmountInr, setBookingAmountInr] = useState('2500000');
  const [dealState, setDealState] = useState('Maharashtra');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const u1 = subscribeTenantCollection<Deal>(
      activeCompanyId,
      'deals',
      (items) => {
        const scoped =
          activeRole === 'sales_executive' && profile?.uid
            ? items.filter((d) => d.agentUid === profile.uid)
            : items;
        setDeals(scoped);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    const u2 = subscribeTenantCollection<Property>(activeCompanyId, 'properties', (items) => {
      setProperties(items);
      if (items.length > 0 && !propertyId) setPropertyId(items[0].id);
    }, [], () => {});
    const u3 = subscribeTenantCollection<Customer>(activeCompanyId, 'customers', (items) => {
      setCustomers(items);
      if (items.length > 0 && !customerId) setCustomerId(items[0].id);
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
      u3();
    };
  }, [activeCompanyId, activeRole, profile?.uid]);

  const filtered = useMemo(
    () => deals.filter((d) => stageFilter === 'all' || d.stage === stageFilter),
    [deals, stageFilter]
  );

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const prop = properties.find((p) => p.id === propertyId);
    const cust = customers.find((c) => c.id === customerId);
    const agent = team.find((m) => m.uid === agentUid);
    if (!prop) {
      showToast('Create or select a property first.', 'error');
      return;
    }

    const val = Number(dealValueInr || 0);
    const tok = Number(tokenAmountInr || 0);
    const book = Number(bookingAmountInr || 0);
    const est = estimateStampDutyAndReg(val, dealState, 'male');
    const today = new Date().toISOString().slice(0, 10);

    const milestones: PaymentMilestone[] = [
      { label: 'Token Receipt', amountInr: tok, dueDate: today, paid: tok > 0 },
      { label: '10% Allotment / Booking', amountInr: book, dueDate: today, paid: false },
      { label: 'Agreement & Stamp Duty', amountInr: est.totalChargesInr, dueDate: today, paid: false },
    ];

    await createTenantDoc(activeCompanyId, 'deals', {
      title: title.trim() || `${prop.title} — ${cust?.fullName || 'Buyer'}`,
      propertyId: prop.id,
      propertyTitle: prop.title,
      customerId: cust?.id || '',
      customerName: cust?.fullName || 'Walk-in Buyer',
      agentUid: agent?.uid || profile?.uid || 'agent',
      agentName: agent?.displayName || profile?.displayName || 'Advisor',
      stage: 'Token',
      dealValueInr: val,
      tokenAmountInr: tok,
      bookingAmountInr: book,
      state: dealState,
      stampDutyInr: est.stampDutyInr,
      registrationFeeInr: est.registrationFeeInr,
      paymentMilestones: milestones,
    });
    showToast('Deal created with milestone schedule and stamp duty estimate.', 'success');
    setShowAdd(false);
    setTitle('');
  };

  const handleStageUpdate = async (deal: Deal, nextStage: DealStage) => {
    if (!activeCompanyId || deal.stage === nextStage) return;
    await updateTenantDoc(activeCompanyId, 'deals', deal.id, { stage: nextStage });
    if (nextStage === 'Closed Won') {
      const gross = Math.round(deal.dealValueInr * 0.02);
      const tds = Math.round(gross * 0.05);
      await createTenantDoc(activeCompanyId, 'commissions', {
        dealId: deal.id,
        dealTitle: deal.title,
        agentUid: deal.agentUid,
        agentName: deal.agentName || 'Advisor',
        ruleType: 'percentage',
        ratePercent: 2,
        grossAmountInr: gross,
        tdsPercent: 5,
        tdsAmountInr: tds,
        netPayableInr: gross - tds,
        splitPercent: 100,
        status: 'pending',
      }).catch(() => {});
      showToast('Deal Closed Won! Commission record generated (2% brokerage, 5% TDS).', 'success');
    } else {
      showToast(`Deal moved to ${nextStage}.`, 'info');
    }
  };

  const toggleMilestone = async (deal: Deal, idx: number) => {
    if (!activeCompanyId || !deal.paymentMilestones) return;
    const next = deal.paymentMilestones.map((m, i) => (i === idx ? { ...m, paid: !m.paid } : m));
    await updateTenantDoc(activeCompanyId, 'deals', deal.id, { paymentMilestones: next });
    setSelectedDeal({ ...deal, paymentMilestones: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Deals, Agreements & Stamp Duty</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Token to RERA registration tracking · State stamp duty estimator · Payment milestones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'nivaasos-deals.csv',
                filtered.map((d) => ({
                  Title: d.title,
                  Customer: d.customerName || '',
                  Stage: d.stage,
                  DealValueINR: d.dealValueInr,
                  StampDutyINR: d.stampDutyInr || 0,
                  RegistrationINR: d.registrationFeeInr || 0,
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
                'nivaasos-deals.xlsx',
                'Deals',
                filtered.map((d) => ({ Title: d.title, Stage: d.stage, DealValueINR: d.dealValueInr, State: d.state || '' }))
              )
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Indian State Stamp Duty & Registration Estimator */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4 text-teal-600" />
          <h2 className="font-display text-sm font-bold">State-wise Stamp Duty & Registration Estimator</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Agreement Value (INR)</label>
            <input
              type="number"
              value={estAmount}
              onChange={(e) => setEstAmount(Number(e.target.value || 0))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">State</label>
            <select
              value={estState}
              onChange={(e) => setEstState(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Buyer Category</label>
            <select
              value={estGender}
              onChange={(e) => setEstGender(e.target.value as 'male' | 'female')}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              <option value="male">Standard / Joint Male</option>
              <option value="female">Female Buyer Rebate</option>
            </select>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Stamp Duty:</span>
              <span className="font-mono font-semibold">{formatINR(dutyEst.stampDutyInr)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Registration:</span>
              <span className="font-mono font-semibold">{formatINR(dutyEst.registrationFeeInr)}</span>
            </div>
            <div className="flex justify-between mt-1 pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
              <span>Total Govt Charges:</span>
              <span className="font-mono text-teal-600">{formatINR(dutyEst.totalChargesInr)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deals Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${stageFilter === 'all' ? 'bg-slate-900 text-white dark:bg-teal-600' : 'text-slate-500'}`}
            >
              All ({deals.length})
            </button>
            {DEAL_STAGES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStageFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-medium ${stageFilter === st ? 'bg-slate-900 text-white dark:bg-teal-600' : 'text-slate-500'}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Deal / Unit</th>
                <th className="px-4 py-3 font-semibold">Buyer · Advisor</th>
                <th className="px-4 py-3 font-semibold">Deal Value</th>
                <th className="px-4 py-3 font-semibold">Token / Booking</th>
                <th className="px-4 py-3 font-semibold">Stamp Duty</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 text-right font-semibold">Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading deals...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No deals recorded yet.</td></tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{d.title}</div>
                      <div className="text-[11px] text-slate-500">{d.propertyTitle}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{d.customerName || '—'}</div>
                      <div className="text-[11px] text-slate-500">{d.agentName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums font-semibold">
                      {formatINRCompact(d.dealValueInr)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px]">
                      <div>Tok: {formatINRCompact(d.tokenAmountInr)}</div>
                      <div>Book: {formatINRCompact(d.bookingAmountInr)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px]">
                      {formatINRCompact((d.stampDutyInr || 0) + (d.registrationFeeInr || 0))} ({d.state || 'MH'})
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={d.stage}
                        onChange={(e) => handleStageUpdate(d, e.target.value as DealStage)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                      >
                        {DEAL_STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedDeal(d)}
                        className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Milestones
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Deal Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleCreateDeal} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Create Property Deal</h2>
              <button type="button" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deal Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 1402 Booking" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Property *</label>
              <select required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                <option value="">Select property...</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title} ({formatINRCompact(p.priceInr)})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Customer</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="">Walk-in Buyer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Agent</label>
                <select value={agentUid} onChange={(e) => setAgentUid(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  {team.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Deal Value (INR)</label>
                <input type="number" required value={dealValueInr} onChange={(e) => setDealValueInr(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Token (INR)</label>
                <input type="number" value={tokenAmountInr} onChange={(e) => setTokenAmountInr(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Booking (INR)</label>
                <input type="number" value={bookingAmountInr} onChange={(e) => setBookingAmountInr(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Registration State</label>
              <select value={dealState} onChange={(e) => setDealState(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Create Deal</button>
            </div>
          </form>
        </div>
      )}

      {/* Milestones Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setSelectedDeal(null)}>
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{selectedDeal.title} — Payment Schedule</h2>
              <button type="button" onClick={() => setSelectedDeal(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2.5 text-xs">
              {(selectedDeal.paymentMilestones || []).map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleMilestone(selectedDeal, idx)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    {m.paid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-400" />}
                    <div>
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-[11px] text-slate-500">Due: {m.dueDate}</div>
                    </div>
                  </div>
                  <div className="font-mono font-semibold">{formatINR(m.amountInr)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
