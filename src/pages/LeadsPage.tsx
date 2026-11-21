import React, { useEffect, useMemo, useState } from 'react';
import { flexRender, SortingState } from '@tanstack/react-table';
import {
  useLegacyTable as useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import Papa from 'papaparse';
import {
  Plus,
  Search,
  Phone,
  MessageSquare,
  Upload,
  Download,
  Columns3,
  Table2,
  Trash2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
  writeAuditEvent,
} from '../firebase/firestoreService';
import {
  ActivityLog,
  LEAD_SOURCES,
  LEAD_STAGES,
  Lead,
  LeadSource,
  LeadStage,
  UserProfile,
} from '../types/crm';
import {
  buildWhatsAppUrl,
  formatINRCompact,
  isValidIndianPhone,
  normalizeIndianPhone,
  WHATSAPP_TEMPLATES,
} from '../utils/india';
import { exportToCsv, exportToExcel } from '../utils/export';

const columnHelper = createColumnHelper<Lead>();

export function LeadsPage() {
  const { activeCompanyId, activeRole, profile } = useAuth();
  const { showToast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modal & Drawer state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState('');
  const [waTemplateIdx, setWaTemplateIdx] = useState(0);

  // Add lead form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('99acres');
  const [stage, setStage] = useState<LeadStage>('New');
  const [budgetMinInr, setBudgetMinInr] = useState('15000000');
  const [budgetMaxInr, setBudgetMaxInr] = useState('25000000');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredBhk, setPreferredBhk] = useState('3 BHK');
  const [score, setScore] = useState('75');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const unsubLeads = subscribeTenantCollection<Lead>(
      activeCompanyId,
      'leads',
      (items) => {
        const scoped =
          activeRole === 'sales_executive' && profile?.uid
            ? items.filter((l) => l.assignedTo === profile.uid)
            : items;
        setLeads(scoped);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );

    const unsubAct = subscribeTenantCollection<ActivityLog>(
      activeCompanyId,
      'activities',
      (items) => setActivities(items.filter((a) => a.entityType === 'lead')),
      [],
      () => {}
    );

    getDocs(query(collection(db, 'users'), where('companyId', '==', activeCompanyId)))
      .then((snap) => {
        const members = snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => !u.isDeleted && u.status === 'active');
        setTeam(members);
        if (members.length > 0 && !assignedTo) {
          setAssignedTo(profile?.uid || members[0].uid);
        }
      })
      .catch(() => {});

    return () => {
      unsubLeads();
      unsubAct();
    };
  }, [activeCompanyId, activeRole, profile?.uid]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        l.fullName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.preferredLocation || '').toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter, stageFilter]);

  const duplicateMatch = useMemo(() => {
    const normalized = normalizeIndianPhone(phone);
    if (normalized.length < 10) return null;
    return leads.find((l) => normalizeIndianPhone(l.phone) === normalized) || null;
  }, [phone, leads]);

  const pickRoundRobinAgent = () => {
    const salesPool = team.filter((m) => m.role === 'sales_executive' || m.role === 'sales_manager');
    const pool = salesPool.length > 0 ? salesPool : team;
    if (pool.length === 0) return { uid: profile?.uid || 'unassigned', name: profile?.displayName || 'Admin' };
    const idx = leads.length % pool.length;
    return { uid: pool[idx].uid, name: pool[idx].displayName };
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const normalized = normalizeIndianPhone(phone);
    if (!isValidIndianPhone(normalized)) {
      showToast('Enter a valid 10-digit Indian phone number (+91).', 'error');
      return;
    }
    if (duplicateMatch) {
      showToast(`Duplicate phone detected! Existing lead: ${duplicateMatch.fullName}`, 'error');
      return;
    }

    const chosen = assignedTo
      ? {
          uid: assignedTo,
          name: team.find((t) => t.uid === assignedTo)?.displayName || profile?.displayName || 'Advisor',
        }
      : pickRoundRobinAgent();

    const id = await createTenantDoc(activeCompanyId, 'leads', {
      fullName: fullName.trim(),
      phone: normalized,
      email: email.trim(),
      source,
      stage,
      score: Math.min(100, Math.max(0, Number(score || 50))),
      budgetMinInr: Number(budgetMinInr || 0),
      budgetMaxInr: Number(budgetMaxInr || 0),
      preferredLocation: preferredLocation.trim(),
      preferredBhk: preferredBhk.trim(),
      assignedTo: chosen.uid,
      assignedToName: chosen.name,
      notes: notes.trim(),
    });

    await createTenantDoc(activeCompanyId, 'activities', {
      entityType: 'lead',
      entityId: id,
      action: 'Lead Created',
      summary: `Source: ${source} · Assigned to ${chosen.name}`,
      actorName: profile?.displayName || 'System',
    });

    showToast('Lead added to pipeline.', 'success');
    setShowAddModal(false);
    setFullName('');
    setPhone('');
    setEmail('');
    setNotes('');
  };

  const handleStageMove = async (lead: Lead, nextStage: LeadStage) => {
    if (!activeCompanyId || lead.stage === nextStage) return;
    await updateTenantDoc(activeCompanyId, 'leads', lead.id, { stage: nextStage });
    await createTenantDoc(activeCompanyId, 'activities', {
      entityType: 'lead',
      entityId: lead.id,
      action: 'Stage Changed',
      summary: `Moved from ${lead.stage} to ${nextStage}`,
      actorName: profile?.displayName || 'User',
    });
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, stage: nextStage });
    }
    showToast(`${lead.fullName} moved to ${nextStage}.`, 'info');
  };

  const handleAddTimelineEntry = async (action: 'Note Added' | 'Call Logged') => {
    if (!activeCompanyId || !selectedLead || !newNote.trim()) return;
    await createTenantDoc(activeCompanyId, 'activities', {
      entityType: 'lead',
      entityId: selectedLead.id,
      action,
      summary: newNote.trim(),
      actorName: profile?.displayName || 'User',
    });
    if (action === 'Call Logged') {
      await updateTenantDoc(activeCompanyId, 'leads', selectedLead.id, {
        lastContactedAt: new Date().toISOString(),
      });
    }
    setNewNote('');
    showToast(`${action}.`, 'success');
  };

  const handleBulkCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let imported = 0;
        let skipped = 0;
        const existingPhones = new Set(leads.map((l) => normalizeIndianPhone(l.phone)));

        for (const row of results.data.slice(0, 100)) {
          const rawPhone = row.phone || row.Phone || row.mobile || '';
          const norm = normalizeIndianPhone(rawPhone);
          if (!isValidIndianPhone(norm) || existingPhones.has(norm)) {
            skipped++;
            continue;
          }
          existingPhones.add(norm);
          const rr = pickRoundRobinAgent();
          await createTenantDoc(activeCompanyId, 'leads', {
            fullName: (row.fullName || row.name || row.Name || 'Imported Prospect').slice(0, 120),
            phone: norm,
            email: (row.email || row.Email || '').slice(0, 180),
            source: LEAD_SOURCES.includes(row.source as LeadSource) ? row.source : 'Website',
            stage: 'New',
            score: 60,
            budgetMinInr: Number(row.budgetMinInr || 10000000),
            budgetMaxInr: Number(row.budgetMaxInr || 20000000),
            preferredLocation: row.preferredLocation || row.location || '',
            preferredBhk: row.preferredBhk || '2 BHK',
            assignedTo: rr.uid,
            assignedToName: rr.name,
            notes: 'Imported via CSV',
          });
          imported++;
        }
        showToast(`CSV Import complete: ${imported} added, ${skipped} duplicate/invalid skipped.`, 'success');
      },
    });
    e.target.value = '';
  };

  const columns = useMemo<LegacyColumnDef<Lead, unknown>[]>(
    () =>
      [
        columnHelper.accessor('fullName', {
          header: 'Lead Name',
          cell: (info) => (
            <button
              type="button"
              onClick={() => setSelectedLead(info.row.original)}
              className="font-semibold text-left text-slate-900 dark:text-white hover:text-teal-600"
            >
              {info.getValue()}
            </button>
          ),
        }),
        columnHelper.accessor('phone', {
          header: 'Phone',
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        columnHelper.accessor('source', { header: 'Source' }),
        columnHelper.accessor('stage', {
          header: 'Stage',
          cell: (info) => (
            <select
              value={info.getValue()}
              onChange={(e) => handleStageMove(info.row.original, e.target.value as LeadStage)}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              {LEAD_STAGES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          ),
        }),
        columnHelper.accessor('budgetMaxInr', {
          header: 'Max Budget',
          cell: (info) => <span className="font-mono tabular-nums">{formatINRCompact(info.getValue())}</span>,
        }),
        columnHelper.accessor('score', {
          header: 'Score',
          cell: (info) => <span className="font-mono tabular-nums font-semibold">{info.getValue()}/100</span>,
        }),
        columnHelper.accessor('assignedToName', { header: 'Assigned To' }),
      ] as LegacyColumnDef<Lead, unknown>[],
    [activeCompanyId]
  );

  const table = useReactTable({
    data: filteredLeads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const canDelete = activeRole === 'company_admin' || activeRole === 'sales_manager' || activeRole === 'super_admin';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Leads Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time Kanban · 99acres, MagicBricks & WhatsApp intake · +91 duplicate guard
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleBulkCsv} className="hidden" />
          </label>
          <button
            type="button"
            onClick={async () => {
              const rows = filteredLeads.map((l) => ({
                Name: l.fullName,
                Phone: l.phone,
                Email: l.email || '',
                Source: l.source,
                Stage: l.stage,
                Score: l.score,
                MaxBudgetINR: l.budgetMaxInr || 0,
                Location: l.preferredLocation || '',
                BHK: l.preferredBhk || '',
                AssignedTo: l.assignedToName || l.assignedTo,
              }));
              exportToCsv('nivaasos-leads.csv', rows);
              await writeAuditEvent({ companyId: activeCompanyId || '', eventType: 'export', details: `Exported ${rows.length} leads to CSV` });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={async () => {
              const rows = filteredLeads.map((l) => ({
                Name: l.fullName,
                Phone: l.phone,
                Source: l.source,
                Stage: l.stage,
                MaxBudgetINR: l.budgetMaxInr || 0,
                Location: l.preferredLocation || '',
              }));
              exportToExcel('nivaasos-leads.xlsx', 'Leads', rows);
              await writeAuditEvent({ companyId: activeCompanyId || '', eventType: 'export', details: `Exported ${rows.length} leads to Excel` });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters & View Switch */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, +91 phone, location..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="all">All Sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="all">All Stages</option>
            {LEAD_STAGES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${
              viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${
              viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Kanban or Table View */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STAGES.map((colStage) => {
            const colLeads = filteredLeads.filter((l) => l.stage === colStage);
            return (
              <div
                key={colStage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/lead-id');
                  const found = leads.find((l) => l.id === id);
                  if (found) handleStageMove(found, colStage);
                }}
                className="w-72 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/70 flex flex-col max-h-[70vh]"
              >
                <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{colStage}</span>
                  <span className="font-mono text-xs text-slate-500">{colLeads.length}</span>
                </div>
                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                  {colLeads.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-400">No leads in {colStage}</div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/lead-id', lead.id)}
                        onClick={() => setSelectedLead(lead)}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 cursor-pointer hover:border-teal-500 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {lead.fullName}
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-teal-600 shrink-0">
                            {lead.score}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {lead.source} · {lead.preferredBhk || 'Property'} · {formatINRCompact(lead.budgetMaxInr)}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {lead.preferredLocation || 'Location TBD'}
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 truncate max-w-[120px]">
                            {lead.assignedToName || 'Advisor'}
                          </span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={`tel:${lead.phone}`}
                              title="Call Lead"
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={buildWhatsAppUrl(
                                lead.phone,
                                WHATSAPP_TEMPLATES[0].body
                                  .replace('{{name}}', lead.fullName)
                                  .replace('{{location}}', lead.preferredLocation || 'our project')
                              )}
                              target="_blank"
                              rel="noreferrer"
                              title="WhatsApp Lead"
                              className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="px-4 py-3 font-semibold text-slate-500 cursor-pointer select-none"
                      >
                        <div className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Actions</th>
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No leads found. Click <strong>Add Lead</strong> or import a CSV sheet.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <a href={`tel:${row.original.phone}`} className="text-slate-600 hover:text-teal-600">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => softDeleteTenantDoc(activeCompanyId!, 'leads', row.original.id, row.original.fullName)}
                              className="text-rose-600 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateLead}
            className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Add New Lead</h2>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone (+91) *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919820112233"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
                {duplicateMatch && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    Duplicate phone: matches {duplicateMatch.fullName} ({duplicateMatch.stage})
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as LeadStage)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {LEAD_STAGES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Min Budget (INR)</label>
                <input
                  type="number"
                  value={budgetMinInr}
                  onChange={(e) => setBudgetMinInr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Max Budget (INR)</label>
                <input
                  type="number"
                  value={budgetMaxInr}
                  onChange={(e) => setBudgetMaxInr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Preferred Location</label>
                <input
                  type="text"
                  value={preferredLocation}
                  onChange={(e) => setPreferredLocation(e.target.value)}
                  placeholder="Bandra / Whitefield"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Preferred BHK</label>
                <input
                  type="text"
                  value={preferredBhk}
                  onChange={(e) => setPreferredBhk(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Assign Agent</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">Auto Round-Robin</option>
                  {team.map((m) => (
                    <option key={m.uid} value={m.uid}>{m.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
              >
                Save Lead
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lead Detail & Activity Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={() => setSelectedLead(null)}>
          <div
            className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold">{selectedLead.fullName}</h2>
                  <p className="font-mono text-xs text-slate-500 mt-0.5">{selectedLead.phone} · {selectedLead.email || 'No email'}</p>
                </div>
                <button type="button" onClick={() => setSelectedLead(null)}>
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl">
                <div><span className="text-slate-500 block">Stage</span><strong>{selectedLead.stage}</strong></div>
                <div><span className="text-slate-500 block">Budget</span><strong>{formatINRCompact(selectedLead.budgetMaxInr)}</strong></div>
                <div><span className="text-slate-500 block">Preference</span><strong>{selectedLead.preferredBhk} · {selectedLead.preferredLocation}</strong></div>
                <div><span className="text-slate-500 block">Advisor</span><strong>{selectedLead.assignedToName}</strong></div>
              </div>

              {/* One-click Call & WhatsApp Templates */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold">WhatsApp Template</label>
                <select
                  value={waTemplateIdx}
                  onChange={(e) => setWaTemplateIdx(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  {WHATSAPP_TEMPLATES.map((tpl, i) => (
                    <option key={tpl.name} value={i}>{tpl.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call Now
                  </a>
                  <a
                    href={buildWhatsAppUrl(
                      selectedLead.phone,
                      WHATSAPP_TEMPLATES[waTemplateIdx].body
                        .replace('{{name}}', selectedLead.fullName)
                        .replace('{{location}}', selectedLead.preferredLocation || 'our project')
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send WhatsApp
                  </a>
                </div>
              </div>

              {/* Add Note / Log Call */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-semibold">Log Call or Add Note</label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Customer asked for 12th floor east-facing brochure..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddTimelineEntry('Note Added')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-medium"
                  >
                    Save Note
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddTimelineEntry('Call Logged')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    Log Call
                  </button>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-semibold mb-3">Activity Timeline</h3>
                <div className="space-y-2.5 text-xs">
                  {activities.filter((a) => a.entityId === selectedLead.id).length === 0 ? (
                    <p className="text-slate-400">No timeline entries yet.</p>
                  ) : (
                    activities
                      .filter((a) => a.entityId === selectedLead.id)
                      .map((act) => (
                        <div key={act.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                          <div className="font-semibold">{act.action}</div>
                          <div className="text-slate-600 dark:text-slate-300 mt-0.5">{act.summary}</div>
                          <div className="text-[11px] text-slate-400 mt-1">by {act.actorName}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={async () => {
                  await softDeleteTenantDoc(activeCompanyId!, 'leads', selectedLead.id, selectedLead.fullName);
                  setSelectedLead(null);
                  showToast('Lead moved to archive.', 'info');
                }}
                className="mt-6 w-full py-2 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Soft Delete Lead
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
