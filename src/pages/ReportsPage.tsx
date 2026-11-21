import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
  Building2,
  CalendarClock,
  BadgeIndianRupee,
} from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { subscribeTenantCollection, writeAuditEvent } from '../firebase/firestoreService';
import {
  Commission,
  Deal,
  Lead,
  LEAD_SOURCES,
  Property,
  SiteVisit,
  UserProfile,
} from '../types/crm';
import { formatINR, formatINRCompact } from '../utils/india';
import { exportReportPdf, exportToCsv, exportToExcel } from '../utils/export';

type DateRangeKey = '7d' | '30d' | '90d' | 'all';
type ReportTab = 'overview' | 'sources' | 'agents' | 'inventory' | 'commissions';

const CHART_COLORS = ['#0d9488', '#0284c7', '#d97706', '#6366f1', '#e11d48', '#16a34a', '#9333ea', '#475569'];

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function ReportsPage() {
  const { activeCompanyId, company } = useAuth();
  const { showToast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRangeKey>('all');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const u1 = subscribeTenantCollection<Lead>(activeCompanyId, 'leads', (items) => {
      setLeads(items);
      setLoading(false);
    }, [], () => setLoading(false));
    const u2 = subscribeTenantCollection<Property>(activeCompanyId, 'properties', setProperties, [], () => {});
    const u3 = subscribeTenantCollection<SiteVisit>(activeCompanyId, 'siteVisits', setVisits, [], () => {});
    const u4 = subscribeTenantCollection<Deal>(activeCompanyId, 'deals', setDeals, [], () => {});
    const u5 = subscribeTenantCollection<Commission>(activeCompanyId, 'commissions', setCommissions, [], () => {});

    getDocs(query(collection(db, 'users'), where('companyId', '==', activeCompanyId)))
      .then((snap) => {
        setTeam(snap.docs.map((d) => d.data() as UserProfile).filter((u) => !u.isDeleted));
      })
      .catch(() => {});

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [activeCompanyId]);

  const cutoffMs = useMemo(() => {
    if (dateRange === 'all') return 0;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [dateRange]);

  const filteredLeads = useMemo(
    () => (cutoffMs ? leads.filter((l) => toMillis(l.createdAt) >= cutoffMs) : leads),
    [leads, cutoffMs]
  );
  const filteredVisits = useMemo(
    () =>
      cutoffMs
        ? visits.filter((v) => Math.max(toMillis(v.scheduledAt), toMillis(v.createdAt)) >= cutoffMs)
        : visits,
    [visits, cutoffMs]
  );
  const filteredDeals = useMemo(
    () => (cutoffMs ? deals.filter((d) => toMillis(d.createdAt) >= cutoffMs) : deals),
    [deals, cutoffMs]
  );
  const filteredCommissions = useMemo(
    () => (cutoffMs ? commissions.filter((c) => toMillis(c.createdAt) >= cutoffMs) : commissions),
    [commissions, cutoffMs]
  );

  // KPI Metrics
  const kpis = useMemo(() => {
    const closedDeals = filteredDeals.filter((d) => d.stage === 'Closed Won');
    const activeDeals = filteredDeals.filter((d) => d.stage !== 'Cancelled');
    const closedRevenueInr = closedDeals.reduce((sum, d) => sum + Number(d.dealValueInr || 0), 0);
    const pipelineValueInr = activeDeals.reduce((sum, d) => sum + Number(d.dealValueInr || 0), 0);
    const completedVisits = filteredVisits.filter((v) => v.status === 'completed').length;
    const bookedLeads = filteredLeads.filter((l) => l.stage === 'Booked').length;
    const leadToBookRate = filteredLeads.length > 0 ? ((bookedLeads / filteredLeads.length) * 100).toFixed(1) : '0.0';
    const visitToBookRate = completedVisits > 0 ? ((closedDeals.length / completedVisits) * 100).toFixed(1) : '0.0';
    const pendingCommInr = filteredCommissions
      .filter((c) => c.status !== 'paid')
      .reduce((sum, c) => sum + Number(c.netPayableInr || 0), 0);
    const paidCommInr = filteredCommissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.netPayableInr || 0), 0);

    return {
      closedRevenueInr,
      pipelineValueInr,
      leadToBookRate,
      visitToBookRate,
      completedVisits,
      closedDealsCount: closedDeals.length,
      pendingCommInr,
      paidCommInr,
    };
  }, [filteredDeals, filteredVisits, filteredLeads, filteredCommissions]);

  // Lead Source Breakdown
  const sourceStats = useMemo(() => {
    return LEAD_SOURCES.map((source) => {
      const items = filteredLeads.filter((l) => l.source === source);
      const booked = items.filter((l) => l.stage === 'Booked').length;
      const siteVisits = items.filter(
        (l) => l.stage === 'Site Visit Scheduled' || l.stage === 'Site Visit Done' || l.stage === 'Negotiation' || l.stage === 'Booked'
      ).length;
      const avgScore =
        items.length > 0 ? Math.round(items.reduce((s, l) => s + Number(l.score || 0), 0) / items.length) : 0;
      const conversionPct = items.length > 0 ? Number(((booked / items.length) * 100).toFixed(1)) : 0;
      return { source, total: items.length, siteVisits, booked, avgScore, conversionPct };
    }).filter((r) => r.total > 0 || dateRange === 'all');
  }, [filteredLeads, dateRange]);

  // Agent Performance Leaderboard
  const agentStats = useMemo(() => {
    const uidSet = new Set<string>([
      ...team.map((m) => m.uid),
      ...filteredLeads.map((l) => l.assignedTo),
      ...filteredDeals.map((d) => d.agentUid),
    ]);
    return Array.from(uidSet)
      .filter(Boolean)
      .map((uid) => {
        const member = team.find((m) => m.uid === uid);
        const myLeads = filteredLeads.filter((l) => l.assignedTo === uid);
        const myVisits = filteredVisits.filter((v) => v.agentUid === uid && v.status === 'completed');
        const myDeals = filteredDeals.filter((d) => d.agentUid === uid && d.stage !== 'Cancelled');
        const closedDeals = myDeals.filter((d) => d.stage === 'Closed Won');
        const revenueInr = closedDeals.reduce((s, d) => s + Number(d.dealValueInr || 0), 0);
        const pipelineInr = myDeals.reduce((s, d) => s + Number(d.dealValueInr || 0), 0);
        const commInr = filteredCommissions
          .filter((c) => c.agentUid === uid)
          .reduce((s, c) => s + Number(c.netPayableInr || 0), 0);
        const name =
          member?.displayName ||
          myDeals[0]?.agentName ||
          myLeads[0]?.assignedToName ||
          uid.slice(0, 8);
        return {
          uid,
          name,
          role: (member?.role || 'sales_executive').replace(/_/g, ' '),
          leadsCount: myLeads.length,
          visitsDone: myVisits.length,
          closedCount: closedDeals.length,
          pipelineInr,
          revenueInr,
          commInr,
        };
      })
      .sort((a, b) => b.revenueInr - a.revenueInr || b.pipelineInr - a.pipelineInr);
  }, [team, filteredLeads, filteredVisits, filteredDeals, filteredCommissions]);

  // Property Inventory Summary
  const inventoryStats = useMemo(() => {
    const statuses: Property['status'][] = ['available', 'hold', 'booked', 'sold'];
    return statuses.map((st) => {
      const items = properties.filter((p) => p.status === st);
      return {
        status: st.toUpperCase(),
        count: items.length,
        totalValueInr: items.reduce((s, p) => s + Number(p.priceInr || 0), 0),
        totalSqFt: items.reduce((s, p) => s + Number(p.areaSqFt || 0), 0),
      };
    });
  }, [properties]);

  const dealStageData = useMemo(() => {
    const stages = ['Token', 'Booking', 'Agreement', 'Registration', 'Closed Won', 'Cancelled'];
    return stages.map((stage) => {
      const items = filteredDeals.filter((d) => d.stage === stage);
      const valueCr = Number((items.reduce((s, d) => s + Number(d.dealValueInr || 0), 0) / 10000000).toFixed(2));
      return { stage, count: items.length, valueCr };
    });
  }, [filteredDeals]);

  const logExportAudit = async (format: string, reportName: string) => {
    if (!activeCompanyId) return;
    await writeAuditEvent({
      companyId: activeCompanyId,
      eventType: 'export',
      targetPath: `companies/${activeCompanyId}/reports/${activeTab}`,
      details: `Exported ${reportName} (${format}) for period ${dateRange}`,
    });
  };

  const getCurrentReportDataset = (): {
    title: string;
    headers: string[];
    rows: (string | number)[][];
    objects: Record<string, unknown>[];
  } => {
    if (activeTab === 'sources') {
      return {
        title: 'Lead Source Attribution Report',
        headers: ['Source', 'Total Leads', 'Site Visits', 'Booked', 'Avg Score', 'Conversion %'],
        rows: sourceStats.map((s) => [s.source, s.total, s.siteVisits, s.booked, s.avgScore, `${s.conversionPct}%`]),
        objects: sourceStats.map((s) => ({
          Source: s.source,
          TotalLeads: s.total,
          SiteVisits: s.siteVisits,
          Booked: s.booked,
          AvgScore: s.avgScore,
          ConversionPct: s.conversionPct,
        })),
      };
    }
    if (activeTab === 'agents') {
      return {
        title: 'Advisor Performance Report',
        headers: ['Advisor', 'Role', 'Leads', 'Completed Visits', 'Closed Deals', 'Closed Revenue', 'Net Commission'],
        rows: agentStats.map((a) => [
          a.name,
          a.role,
          a.leadsCount,
          a.visitsDone,
          a.closedCount,
          formatINR(a.revenueInr),
          formatINR(a.commInr),
        ]),
        objects: agentStats.map((a) => ({
          Advisor: a.name,
          Role: a.role,
          Leads: a.leadsCount,
          CompletedVisits: a.visitsDone,
          ClosedDeals: a.closedCount,
          ClosedRevenueINR: a.revenueInr,
          PipelineINR: a.pipelineInr,
          NetCommissionINR: a.commInr,
        })),
      };
    }
    if (activeTab === 'inventory') {
      return {
        title: 'Property Inventory Valuation Report',
        headers: ['Status', 'Units', 'Total Area (sq ft)', 'Total Valuation'],
        rows: inventoryStats.map((i) => [i.status, i.count, i.totalSqFt, formatINR(i.totalValueInr)]),
        objects: inventoryStats.map((i) => ({
          Status: i.status,
          Units: i.count,
          TotalSqFt: i.totalSqFt,
          TotalValuationINR: i.totalValueInr,
        })),
      };
    }
    if (activeTab === 'commissions') {
      return {
        title: 'Commission & TDS Summary Report',
        headers: ['Deal', 'Advisor', 'Gross (INR)', 'TDS (INR)', 'Net Payable (INR)', 'Status', 'UTR / Ref'],
        rows: filteredCommissions.map((c) => [
          c.dealTitle || c.dealId,
          c.agentName || c.agentUid,
          formatINR(c.grossAmountInr),
          formatINR(c.tdsAmountInr || 0),
          formatINR(c.netPayableInr),
          c.status.toUpperCase(),
          c.payoutReference || '-',
        ]),
        objects: filteredCommissions.map((c) => ({
          Deal: c.dealTitle || c.dealId,
          Advisor: c.agentName || c.agentUid,
          GrossINR: c.grossAmountInr,
          TDSINR: c.tdsAmountInr || 0,
          NetPayableINR: c.netPayableInr,
          Status: c.status,
          PayoutRef: c.payoutReference || '',
        })),
      };
    }
    // Overview default: Deal stage pipeline
    return {
      title: 'Sales Pipeline & Revenue Report',
      headers: ['Deal Stage', 'Deals Count', 'Total Value (Cr)'],
      rows: dealStageData.map((d) => [d.stage, d.count, `₹${d.valueCr} Cr`]),
      objects: dealStageData.map((d) => ({
        Stage: d.stage,
        DealsCount: d.count,
        TotalValueCr: d.valueCr,
      })),
    };
  };

  const handleExportPdf = async () => {
    const ds = getCurrentReportDataset();
    exportReportPdf(
      `${company?.name || 'NivaasOS'} — ${ds.title}`,
      `Period: ${dateRange.toUpperCase()} | Generated ${new Date().toLocaleDateString('en-IN')}`,
      ds.headers,
      ds.rows,
      `nivaasos-${activeTab}-report.pdf`
    );
    await logExportAudit('PDF', ds.title);
    showToast('PDF report downloaded.', 'success');
  };

  const handleExportExcel = async () => {
    const ds = getCurrentReportDataset();
    exportToExcel(`nivaasos-${activeTab}-report.xlsx`, activeTab, ds.objects);
    await logExportAudit('XLSX', ds.title);
    showToast('Excel workbook downloaded.', 'success');
  };

  const handleExportCsv = async () => {
    const ds = getCurrentReportDataset();
    exportToCsv(`nivaasos-${activeTab}-report.csv`, ds.objects);
    await logExportAudit('CSV', ds.title);
    showToast('CSV report downloaded.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Analytics & Executive Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time funnel efficiency, INR deal velocity, portal attribution & TDS-adjusted commission audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Report Period"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-500"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Closed Sales Revenue</span>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatINRCompact(kpis.closedRevenueInr)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Pipeline: {formatINRCompact(kpis.pipelineValueInr)} ({kpis.closedDealsCount} closed)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Lead-to-Booking Rate</span>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {kpis.leadToBookRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {filteredLeads.length} total leads in period
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Visit-to-Booking Conversion</span>
            <CalendarClock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {kpis.visitToBookRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {kpis.completedVisits} completed site visits
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Commissions Settled</span>
            <BadgeIndianRupee className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatINRCompact(kpis.paidCommInr)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Pending / Approved: {formatINRCompact(kpis.pendingCommInr)}
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            { id: 'overview', label: 'Pipeline & Revenue' },
            { id: 'sources', label: 'Leads by Source' },
            { id: 'agents', label: 'Advisor Leaderboard' },
            { id: 'inventory', label: 'Property Inventory' },
            { id: 'commissions', label: 'Commission Ledger' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 dark:bg-teal-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
          Compiling real-time company analytics...
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-4">
                  Deal Pipeline Valuation by Stage (₹ Cr)
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dealStageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val) => [`₹${val ?? 0} Cr`, 'Deal Value']} />
                      <Bar dataKey="valueCr" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-4">
                  Lead Distribution Across Portals
                </h2>
                <div className="h-72">
                  {sourceStats.filter((s) => s.total > 0).length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No leads recorded in the selected timeframe.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sourceStats.filter((s) => s.total > 0)}
                          dataKey="total"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={88}
                          label
                        >
                          {sourceStats
                            .filter((s) => s.total > 0)
                            .map((entry, idx) => (
                              <Cell key={entry.source} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Lead Source</th>
                      <th className="px-4 py-3 text-right">Total Leads</th>
                      <th className="px-4 py-3 text-right">Progressed to Visit</th>
                      <th className="px-4 py-3 text-right">Booked</th>
                      <th className="px-4 py-3 text-right">Avg Lead Score</th>
                      <th className="px-4 py-3 text-right">Booking Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sourceStats.map((row) => (
                      <tr key={row.source} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.siteVisits}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-teal-600">{row.booked}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.avgScore}/100</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.conversionPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Advisor</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Assigned Leads</th>
                      <th className="px-4 py-3 text-right">Completed Visits</th>
                      <th className="px-4 py-3 text-right">Closed Won</th>
                      <th className="px-4 py-3 text-right">Closed Revenue</th>
                      <th className="px-4 py-3 text-right">Net Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {agentStats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No advisor activity recorded yet.
                        </td>
                      </tr>
                    ) : (
                      agentStats.map((a) => (
                        <tr key={a.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{a.name}</td>
                          <td className="px-4 py-3 capitalize text-slate-500">{a.role}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.leadsCount}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.visitsDone}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{a.closedCount}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-teal-600">
                            {formatINRCompact(a.revenueInr)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatINR(a.commInr)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {inventoryStats.map((item) => (
                <div
                  key={item.status}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{item.status}</span>
                    <Building2 className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {item.count} Units
                  </div>
                  <div className="mt-2 text-xs text-slate-500 tabular-nums">
                    Area: {item.totalSqFt.toLocaleString('en-IN')} sq ft
                  </div>
                  <div className="mt-1 text-sm font-semibold text-teal-600 tabular-nums">
                    {formatINRCompact(item.totalValueInr)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'commissions' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Deal</th>
                      <th className="px-4 py-3">Advisor</th>
                      <th className="px-4 py-3 text-right">Gross Brokerage</th>
                      <th className="px-4 py-3 text-right">TDS (194H)</th>
                      <th className="px-4 py-3 text-right">Net Payable</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payout UTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCommissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No commission entries found.
                        </td>
                      </tr>
                    ) : (
                      filteredCommissions.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {c.dealTitle || c.dealId}
                          </td>
                          <td className="px-4 py-3">{c.agentName || c.agentUid}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatINR(c.grossAmountInr)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                            -{formatINR(c.tdsAmountInr || 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatINR(c.netPayableInr)}
                          </td>
                          <td className="px-4 py-3 uppercase font-medium">{c.status}</td>
                          <td className="px-4 py-3 font-mono">{c.payoutReference || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
