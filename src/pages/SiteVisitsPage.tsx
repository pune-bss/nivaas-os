import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Calendar, List, MapPin, Star, Download, X, Trash2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
} from '../firebase/firestoreService';
import { Lead, Property, SiteVisit, SiteVisitStatus, UserProfile } from '../types/crm';
import { exportToCsv } from '../utils/export';

export function SiteVisitsPage() {
  const { activeCompanyId, activeRole, profile } = useAuth();
  const { showToast } = useToast();

  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMode, setCalMode] = useState<'day' | 'week' | 'month' | 'list'>('week');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [feedbackVisit, setFeedbackVisit] = useState<SiteVisit | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);

  // Schedule form
  const [leadId, setLeadId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [agentUid, setAgentUid] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => `${new Date().toISOString().slice(0, 10)}T11:00`);
  const [mapsUrl, setMapsUrl] = useState('https://maps.google.com/?q=Mumbai+Maharashtra');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const u1 = subscribeTenantCollection<SiteVisit>(
      activeCompanyId,
      'siteVisits',
      (items) => {
        const scoped =
          activeRole === 'sales_executive' && profile?.uid
            ? items.filter((v) => v.agentUid === profile.uid)
            : items;
        setVisits(scoped);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    const u2 = subscribeTenantCollection<Lead>(activeCompanyId, 'leads', (items) => {
      setLeads(items);
      if (items.length > 0 && !leadId) setLeadId(items[0].id);
    }, [], () => {});
    const u3 = subscribeTenantCollection<Property>(activeCompanyId, 'properties', (items) => {
      setProperties(items);
      if (items.length > 0 && !propertyId) setPropertyId(items[0].id);
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

  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        if (calMode === 'day') return v.scheduledAt?.startsWith(selectedDate);
        if (calMode === 'week') {
          const base = new Date(selectedDate);
          const vDate = new Date(v.scheduledAt);
          const diffDays = Math.abs((vDate.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        }
        if (calMode === 'month') return v.scheduledAt?.slice(0, 7) === selectedDate.slice(0, 7);
        return true;
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [visits, statusFilter, calMode, selectedDate]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const lead = leads.find((l) => l.id === leadId);
    const prop = properties.find((p) => p.id === propertyId);
    const agent = team.find((m) => m.uid === agentUid);
    if (!lead || !prop) {
      showToast('Select a valid lead and property first.', 'error');
      return;
    }

    await createTenantDoc(activeCompanyId, 'siteVisits', {
      leadId: lead.id,
      leadName: lead.fullName,
      propertyId: prop.id,
      propertyTitle: prop.title,
      agentUid: agent?.uid || profile?.uid || 'agent',
      agentName: agent?.displayName || profile?.displayName || 'Advisor',
      scheduledAt,
      status: 'scheduled',
      mapsUrl: mapsUrl.trim(),
    });
    showToast('Site visit scheduled.', 'success');
    setShowAdd(false);
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !feedbackVisit) return;
    await updateTenantDoc(activeCompanyId, 'siteVisits', feedbackVisit.id, {
      status: 'completed',
      feedback: feedbackText.trim(),
      rating: feedbackRating,
    });
    showToast('Visit marked completed with client feedback.', 'success');
    setFeedbackVisit(null);
    setFeedbackText('');
  };

  const canDelete = activeRole === 'company_admin' || activeRole === 'sales_manager' || activeRole === 'super_admin';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Site Visits Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Schedule property walkthroughs, track feedback, and launch Google Maps navigation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'nivaasos-site-visits.csv',
                filteredVisits.map((v) => ({
                  Lead: v.leadName || v.leadId,
                  Property: v.propertyTitle || v.propertyId,
                  Agent: v.agentName || v.agentUid,
                  ScheduledAt: v.scheduledAt,
                  Status: v.status,
                  Rating: v.rating || '',
                  Feedback: v.feedback || '',
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            Schedule Visit
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(['day', 'week', 'month', 'list'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCalMode(m)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                calMode === m ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              {m === 'list' ? <List className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
        </div>
      </div>

      {/* Visits Grid / List */}
      {loading ? (
        <div className="h-56 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
          No site visits found in this {calMode} window.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVisits.map((v) => (
            <div key={v.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-mono">{v.scheduledAt.replace('T', ' ').slice(0, 16)}</span>
                  <span className="capitalize font-semibold text-teal-600">{v.status.replace('_', ' ')}</span>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{v.leadName}</h3>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{v.propertyTitle}</div>
                <div className="text-xs text-slate-500 mt-1">Advisor: {v.agentName}</div>
                {v.feedback && (
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <div className="flex items-center gap-1 text-amber-500 mb-1">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span className="font-mono font-semibold">{v.rating || 5}/5</span>
                    </div>
                    {v.feedback}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <select
                    value={v.status}
                    onChange={(e) => updateTenantDoc(activeCompanyId!, 'siteVisits', v.id, { status: e.target.value as SiteVisitStatus })}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="no_show">No Show</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackVisit(v);
                      setFeedbackText(v.feedback || '');
                      setFeedbackRating(v.rating || 5);
                    }}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Feedback
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {v.mapsUrl && (
                    <a
                      href={v.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open Google Maps"
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => softDeleteTenantDoc(activeCompanyId!, 'siteVisits', v.id, v.leadName)}
                      className="text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Visit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleSchedule} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Schedule Site Visit</h2>
              <button type="button" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Select Lead *</label>
              <select required value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                <option value="">Choose lead...</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.fullName} ({l.phone})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Select Property *</label>
              <select required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                <option value="">Choose property...</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Advisor</label>
                <select value={agentUid} onChange={(e) => setAgentUid(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  {team.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date & Time *</label>
                <input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Google Maps Link</label>
              <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Confirm Schedule</button>
            </div>
          </form>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleSaveFeedback} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Site Visit Feedback — {feedbackVisit.leadName}</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Buyer Interest Rating (1–5)</label>
              <input type="number" min={1} max={5} value={feedbackRating} onChange={(e) => setFeedbackRating(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Visit Notes *</label>
              <textarea rows={3} required value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Liked the balcony view and east-facing layout; discussing loan sanction..." className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFeedbackVisit(null)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Mark Completed</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
