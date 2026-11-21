import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Check, Shield, FileCheck2, IndianRupee } from 'lucide-react';
import { DEFAULT_PLANS } from '../firebase/seedClientData';
import { formatINR } from '../utils/india';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { firebaseUser, profile } = useAuth();
  const [annual, setAnnual] = useState(true);
  const [heroImgError, setHeroImgError] = useState(false);

  const primaryCtaHref = firebaseUser
    ? profile?.role === 'super_admin'
      ? '/app/super-admin'
      : '/app/dashboard'
    : '/auth';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            NivaasOS
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#modules" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Platform
            </a>
            <a href="#india-stack" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              India Compliance
            </a>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#security" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Security
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to={primaryCtaHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-teal-500 transition-colors whitespace-nowrap shrink-0"
            >
              {firebaseUser ? 'Open Workspace' : 'Sign In / Register'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="text-xs font-medium text-teal-700 dark:text-teal-400 tracking-wide mb-3">
              Multi-Tenant Real Estate CRM · Built for India
            </div>
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-white text-balance mb-5">
              Turn portal inquiries into registered bookings without spreadsheet leaks.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mb-8">
              Capture 99acres, MagicBricks, and WhatsApp leads into a live Kanban pipeline, manage RERA tower inventory in Lakhs and Crores, calculate state stamp duty, and settle agent commissions with 194H TDS.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/auth?mode=register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 transition-colors whitespace-nowrap"
              >
                Register Your Agency or Builder Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors whitespace-nowrap"
              >
                Employee / Admin Login
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] lg:min-h-[440px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 relative">
              {!heroImgError ? (
                <img
                  src="/src/assets/images/hero_indian_skyline_1795006021041.jpg"
                  alt="Modern luxury residential towers in Mumbai at golden hour"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white">
                  <Building2 className="h-12 w-12 text-teal-400 mb-3" />
                  <p className="font-display font-semibold text-lg">NivaasOS Tower & Inventory Suite</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <div className="text-xs text-teal-300 font-medium">
                  Mumbai · Pune · Bengaluru · NCR · Hyderabad
                </div>
                <div className="text-sm font-semibold mt-1">
                  Real-time tower inventory, site visit scheduling & RERA-ready deal desks
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Quantitative Strip */}
        <div className="mt-14 pt-10 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
              &lt; 2 sec
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Duplicate +91 phone detection on portal import
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
              12 States
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Built-in stamp duty & registration estimators
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
              6 RBAC Roles
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enforced server-side via Firestore security rules
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
              DPDP Ready
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Masked Aadhaar KYC, consent logs & JSON data export
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Grid */}
      <section id="modules" className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              End-to-end execution from inquiry to commission payout
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mt-3 text-sm sm:text-base">
              Every team—receptionists, field executives, sales managers, and accountants—operates inside one isolated company workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-2">
                01. Lead Pipeline & WhatsApp Velocity
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-3">
                8-stage real-time Kanban with 99acres & MagicBricks source tracking
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                Score incoming buyers by budget and BHK preference, assign automatically via round-robin or manually by micro-market, trigger one-click WhatsApp brochures in English, Hindi, or Marathi, and bulk import CSV sheets with instant +91 deduplication.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div><span className="font-semibold block text-slate-900 dark:text-white">Kanban Sync</span>Live Firestore listeners</div>
                <div><span className="font-semibold block text-slate-900 dark:text-white">Call & Note Logs</span>Full activity timeline</div>
                <div><span className="font-semibold block text-slate-900 dark:text-white">CSV / Excel</span>Bulk import & export</div>
                <div><span className="font-semibold block text-slate-900 dark:text-white">One-Click WA</span>Pre-filled templates</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-2">
                  02. Builder Inventory & RERA
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-3">
                  Tower grids, floor plans & ₹ Lakh/Cr pricing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Track residential, commercial, villa, and plotted developments across towers with instant sq ft to sq m conversion, Vastu facing tags, and RERA registration IDs.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                Available · On Hold · Booked · Sold
              </div>
            </div>

            <div id="india-stack" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <FileCheck2 className="h-5 w-5 text-teal-600 mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
                03. Deals & Stamp Duty Engine
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Track token, booking, agreement, and registration milestones alongside male/female state stamp duty estimates and GST-ready tax invoices.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <IndianRupee className="h-5 w-5 text-teal-600 mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
                04. Commissions & 194H TDS
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Configure percentage or fixed brokerage splits, route payouts through Accountant approval, deduct 5% TDS, and export PDF statements.
              </p>
            </div>

            <div id="security" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <Shield className="h-5 w-5 text-teal-600 mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
                05. Zero-Trust Tenant Isolation & DPDP
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Invite-only employee onboarding, optional TOTP 2FA, masked Aadhaar KYC storage, immutable audit logs, and one-click DPDP data export.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent INR Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Transparent INR pricing for every brokerage size
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm sm:text-base">
              All paid plans include GST-compliant tax invoices (SAC 998314) and enforced seat/property quotas.
            </p>
          </div>
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 self-start">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !annual ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                annual ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Annual (Save 20%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {DEFAULT_PLANS.map((plan) => {
            const displayPrice = annual
              ? Math.round(plan.priceAnnualInr / 12)
              : plan.priceMonthlyInr;
            const highlighted = plan.planId === 'pro';
            return (
              <div
                key={plan.planId}
                className={`rounded-2xl border p-6 flex flex-col justify-between ${
                  highlighted
                    ? 'border-teal-600 bg-slate-900 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div>
                  <div className={`text-sm font-semibold ${highlighted ? 'text-teal-400' : 'text-teal-700 dark:text-teal-400'}`}>
                    {plan.name}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono tabular-nums text-3xl font-bold">
                      {displayPrice === 0 ? '₹0' : formatINR(displayPrice)}
                    </span>
                    <span className={`text-xs ${highlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                      / month {displayPrice > 0 ? '+ GST' : ''}
                    </span>
                  </div>
                  <div className={`text-xs mt-2 pb-4 border-b ${highlighted ? 'border-slate-800 text-slate-300' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                    Up to {plan.userLimit} users · {plan.propertyLimit} properties
                  </div>
                  <ul className="mt-4 space-y-2.5 text-xs">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className={`h-4 w-4 shrink-0 ${highlighted ? 'text-teal-400' : 'text-teal-600'}`} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/auth?mode=register&plan=${plan.planId}`}
                  className={`mt-8 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    highlighted
                      ? 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                      : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  Start with {plan.name}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>NivaasOS Technologies Pvt Ltd · Mumbai & Bengaluru, India</div>
          <div className="flex items-center gap-6">
            <span>RERA & GST Ready</span>
            <span>DPDP Act 2023 Compliant</span>
            <Link to="/auth" className="hover:text-slate-900 dark:hover:text-white">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
