import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, CreditCard, FileText, Users, Building2, X } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { DEFAULT_PLANS } from '../firebase/seedClientData';
import { PlanId, SubscriptionPlan } from '../types/crm';
import { formatINR } from '../utils/india';
import { generateGstInvoicePdf } from '../utils/export';
import { writeAuditEvent } from '../firebase/firestoreService';

export function BillingPage() {
  const { activeCompanyId, company, profile } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[]>(
    DEFAULT_PLANS.map((p) => ({
      planId: p.planId,
      name: p.name,
      priceMonthlyInr: p.priceMonthlyInr,
      priceAnnualInr: p.priceAnnualInr,
      userLimit: p.userLimit,
      propertyLimit: p.propertyLimit,
      features: [...p.features],
    }))
  );
  const [annualBilling, setAnnualBilling] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [propertyCount, setPropertyCount] = useState(0);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'platform/subscriptionPlans/items'))
      .then((snap) => {
        if (!snap.empty) {
          const loaded = snap.docs.map((d) => d.data() as SubscriptionPlan);
          const order: PlanId[] = ['free', 'starter', 'pro', 'enterprise'];
          loaded.sort((a, b) => order.indexOf(a.planId) - order.indexOf(b.planId));
          setPlans(loaded);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeCompanyId) return;
    getDocs(query(collection(db, 'users'), where('companyId', '==', activeCompanyId)))
      .then((snap) => setTeamCount(snap.docs.filter((d) => !d.data().isDeleted).length))
      .catch(() => {});
    getDocs(
      query(collection(db, `companies/${activeCompanyId}/properties`), where('companyId', '==', activeCompanyId))
    )
      .then((snap) => setPropertyCount(snap.docs.filter((d) => !d.data().isDeleted).length))
      .catch(() => {});
  }, [activeCompanyId]);

  const currentPlan = plans.find((p) => p.planId === (company?.planId || 'free')) || plans[0];
  const userPct = company?.userLimit ? Math.min(100, Math.round((teamCount / company.userLimit) * 100)) : 0;
  const propPct = company?.propertyLimit
    ? Math.min(100, Math.round((propertyCount / company.propertyLimit) * 100))
    : 0;

  const isSuperAdmin = profile?.role === 'super_admin';

  const handleCheckoutConfirm = async () => {
    if (!checkoutPlan || !company) return;
    setProcessing(true);
    try {
      const baseAmountInr = annualBilling ? checkoutPlan.priceAnnualInr : checkoutPlan.priceMonthlyInr;
      const invoiceNo = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

      if (isSuperAdmin) {
        await updateDoc(doc(db, 'companies', company.companyId), {
          planId: checkoutPlan.planId,
          userLimit: checkoutPlan.userLimit,
          propertyLimit: checkoutPlan.propertyLimit,
          updatedAt: serverTimestamp(),
        });
        showToast(`Plan updated to ${checkoutPlan.name} with updated seat & property quotas.`, 'success');
      } else {
        await writeAuditEvent({
          companyId: company.companyId,
          eventType: 'export',
          targetPath: `companies/${company.companyId}/billing`,
          details: `Requested subscription upgrade to ${checkoutPlan.name} (${annualBilling ? 'Annual' : 'Monthly'}) - Invoice ${invoiceNo}`,
        });
        showToast(
          `Order reference ${invoiceNo} generated. Download GST Tax Invoice; Super Admin / Razorpay webhook will activate quotas.`,
          'info'
        );
      }

      if (baseAmountInr > 0) {
        generateGstInvoicePdf({
          companyName: company.name,
          gstNumber: company.gstNumber,
          planName: `${checkoutPlan.name} (${annualBilling ? 'Annual' : 'Monthly'})`,
          baseAmountInr,
          invoiceNo,
          dateStr: new Date().toLocaleDateString('en-IN'),
        });
      }
      setCheckoutPlan(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to process plan request.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const currentBaseAmount = annualBilling ? currentPlan.priceAnnualInr : currentPlan.priceMonthlyInr;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Subscription & GST Billing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage workspace user/property quotas, INR Razorpay checkout structure & SAC 998314 GST tax invoices.
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-xs">
          <button
            type="button"
            onClick={() => setAnnualBilling(false)}
            className={`px-3 py-1.5 rounded-md font-medium ${
              !annualBilling ? 'bg-slate-900 dark:bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnualBilling(true)}
            className={`px-3 py-1.5 rounded-md font-medium ${
              annualBilling ? 'bg-slate-900 dark:bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Annual (Save 20%)
          </button>
        </div>
      </div>

      {/* Current Plan & Usage Quotas */}
      {company && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Active Subscription Tier</span>
              <CreditCard className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
              {currentPlan.name}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              GSTIN: <span className="font-mono">{company.gstNumber || 'Unregistered'}</span>
            </div>
            {currentBaseAmount > 0 && (
              <button
                type="button"
                onClick={() =>
                  generateGstInvoicePdf({
                    companyName: company.name,
                    gstNumber: company.gstNumber,
                    planName: currentPlan.name,
                    baseAmountInr: currentBaseAmount,
                    invoiceNo: `INV-${new Date().getFullYear()}-001`,
                    dateStr: new Date().toLocaleDateString('en-IN'),
                  })
                }
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                Download Current GST Invoice (18%)
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Team Seat Quota</span>
              <Users className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 font-display text-xl font-bold tabular-nums">
              {teamCount} / {company.userLimit} Users
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-teal-600 rounded-full" style={{ width: `${userPct}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">{userPct}% utilized</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Property Inventory Quota</span>
              <Building2 className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 font-display text-xl font-bold tabular-nums">
              {propertyCount} / {company.propertyLimit} Listings
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${propPct}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">{propPct}% utilized</div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = company?.planId === plan.planId;
          const price = annualBilling ? plan.priceAnnualInr : plan.priceMonthlyInr;
          return (
            <div
              key={plan.planId}
              className={`rounded-xl border p-5 flex flex-col justify-between bg-white dark:bg-slate-900 ${
                isCurrent
                  ? 'border-teal-600 ring-1 ring-teal-600'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    {plan.name}
                  </h2>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold text-teal-600 uppercase">Current</span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {formatINR(price)}
                  </span>
                  <span className="text-xs text-slate-500">
                    /{annualBilling ? 'year' : 'month'} + GST
                  </span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isCurrent}
                onClick={() => setCheckoutPlan(plan)}
                className={`mt-5 w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 dark:bg-teal-600 text-white hover:opacity-90'
                }`}
              >
                {isCurrent ? 'Active Plan' : 'Select Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Razorpay Checkout & GST Modal */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Razorpay INR Order Summary</h2>
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const base = annualBilling ? checkoutPlan.priceAnnualInr : checkoutPlan.priceMonthlyInr;
              const cgst = Math.round(base * 0.09);
              const sgst = Math.round(base * 0.09);
              const total = base + cgst + sgst;
              return (
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Tier</span>
                      <span className="font-semibold">
                        {checkoutPlan.name} ({annualBilling ? 'Annual' : 'Monthly'})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Taxable Value (SAC 998314)</span>
                      <span className="tabular-nums">{formatINR(base)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CGST (9%) + SGST (9%)</span>
                      <span className="tabular-nums">{formatINR(cgst + sgst)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-sm">
                      <span>Total Payable</span>
                      <span className="tabular-nums text-teal-600">{formatINR(total)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isSuperAdmin
                      ? 'As Super Admin, confirming will immediately update this tenant’s Firestore plan and quotas and generate a GST invoice.'
                      : 'Confirming generates a GST proforma invoice PDF and logs an upgrade request for Razorpay webhook / Super Admin activation.'}
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={handleCheckoutConfirm}
                      className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-500 disabled:opacity-50"
                    >
                      {processing ? 'Processing...' : isSuperAdmin ? 'Activate Plan & Invoice' : 'Confirm & Download GST Invoice'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
