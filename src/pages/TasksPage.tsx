import React, { useEffect, useMemo, useState } from 'react';
import { Plus, CheckCircle2, Circle, AlertTriangle, X, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
} from '../firebase/firestoreService';
import { TaskItem } from '../types/crm';

export function TasksPage() {
  const { activeCompanyId, activeRole, profile } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskItem['type']>('follow_up');
  const [priority, setPriority] = useState<TaskItem['priority']>('high');
  const [dueAt, setDueAt] = useState(() => `${new Date().toISOString().slice(0, 10)}T17:00`);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const unsub = subscribeTenantCollection<TaskItem>(
      activeCompanyId,
      'tasks',
      (items) => {
        const scoped =
          activeRole === 'sales_executive' && profile?.uid
            ? items.filter((tk) => tk.assignedTo === profile.uid)
            : items;
        setTasks(scoped);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    return () => unsub();
  }, [activeCompanyId, activeRole, profile?.uid]);

  const nowIso = new Date().toISOString();

  const filtered = useMemo(() => {
    return tasks.filter((tk) => {
      if (filter === 'pending') return tk.status === 'pending';
      if (filter === 'completed') return tk.status === 'completed';
      if (filter === 'overdue') return tk.status === 'pending' && tk.dueAt < nowIso;
      return true;
    });
  }, [tasks, filter, nowIso]);

  const overdueCount = tasks.filter((tk) => tk.status === 'pending' && tk.dueAt < nowIso).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !profile?.uid) return;
    await createTenantDoc(activeCompanyId, 'tasks', {
      title: title.trim(),
      type,
      priority,
      status: 'pending',
      dueAt,
      assignedTo: profile.uid,
      assignedToName: profile.displayName,
    });
    showToast('Task & reminder scheduled.', 'success');
    setShowAdd(false);
    setTitle('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Tasks & Follow-ups</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Daily call reminders, payment follow-ups & overdue alerts
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500 self-start"
        >
          <Plus className="h-4 w-4" />
          New Follow-up
        </button>
      </div>

      {overdueCount > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>You have <strong>{overdueCount}</strong> overdue follow-up(s) requiring immediate action.</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-1">
          {(['all', 'pending', 'overdue', 'completed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                filter === f ? 'bg-slate-900 text-white dark:bg-teal-600' : 'text-slate-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">No tasks in this view.</div>
          ) : (
            filtered.map((tk) => {
              const isOverdue = tk.status === 'pending' && tk.dueAt < nowIso;
              return (
                <div key={tk.id} className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() =>
                      updateTenantDoc(activeCompanyId!, 'tasks', tk.id, {
                        status: tk.status === 'completed' ? 'pending' : 'completed',
                      })
                    }
                    className="flex items-start gap-3 text-left min-w-0 flex-1"
                  >
                    {tk.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${tk.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {tk.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span className="capitalize">{tk.type.replace('_', ' ')}</span> · Priority {tk.priority} · Due{' '}
                        <span className={`font-mono ${isOverdue ? 'text-rose-600 font-semibold' : ''}`}>
                          {tk.dueAt.replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                    </div>
                  </button>
                  {(activeRole === 'company_admin' || activeRole === 'sales_manager' || activeRole === 'super_admin') && (
                    <button
                      type="button"
                      onClick={() => softDeleteTenantDoc(activeCompanyId!, 'tasks', tk.id, tk.title)}
                      className="text-rose-600 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleCreate} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">New Task / Follow-up</h2>
              <button type="button" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Title *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up on RERA allotment cheque" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as TaskItem['type'])} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="follow_up">Follow-up</option>
                  <option value="call">Call</option>
                  <option value="task">Task</option>
                  <option value="payment_reminder">Payment Reminder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskItem['priority'])} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date & Time *</label>
              <input type="datetime-local" required value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Create Task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
