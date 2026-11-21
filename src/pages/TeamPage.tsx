import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { UserPlus, Copy, Clock, X } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { createTenantDoc, subscribeTenantCollection, writeAuditEvent } from '../firebase/firestoreService';
import { AppRole, Invitation, UserProfile } from '../types/crm';
import { formatINRCompact } from '../utils/india';

const ASSIGNABLE_ROLES: Exclude<AppRole, 'super_admin' | 'pending_owner'>[] = [
  'company_admin',
  'sales_manager',
  'sales_executive',
  'accountant',
  'receptionist',
];

export function TeamPage() {
  const { activeCompanyId, activeRole, company, profile } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(() => localStorage.getItem(`nivaasos_att_${new Date().toISOString().slice(0, 10)}`) === 'in');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Invite form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<Exclude<AppRole, 'super_admin' | 'pending_owner'>>('sales_executive');

  const loadMembers = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', activeCompanyId)));
      setMembers(snap.docs.map((d) => d.data() as UserProfile).filter((m) => !m.isDeleted));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    loadMembers();
    const unsub = subscribeTenantCollection<Invitation>(activeCompanyId, 'invitations', setInvitations, [], () => {});
    return () => unsub();
  }, [activeCompanyId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (company && members.length >= company.userLimit) {
      showToast(`User seat limit (${company.userLimit}) reached on ${company.planId} plan.`, 'error');
      return;
    }

    const code = `inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await createTenantDoc(
      activeCompanyId,
      'invitations',
      {
        email: invEmail.trim().toLowerCase(),
        displayName: invName.trim(),
        role: invRole,
        inviteCode: code,
        status: 'pending',
      },
      code
    );
    await writeAuditEvent({
      companyId: activeCompanyId,
      eventType: 'invite',
      details: `Invited ${invEmail} as ${invRole}`,
    });
    showToast(`Invitation created! Share the invite code ${code}.`, 'success');
    setShowInviteModal(false);
    setInvEmail('');
    setInvName('');
  };

  const handleRoleUpdate = async (member: UserProfile, role: AppRole) => {
    if (!activeCompanyId) return;
    await updateDoc(doc(db, 'users', member.uid), { role, updatedAt: serverTimestamp() });
    await writeAuditEvent({
      companyId: activeCompanyId,
      eventType: 'role_change',
      targetPath: `users/${member.uid}`,
      details: `Changed ${member.displayName} role to ${role}`,
    });
    showToast(`Updated ${member.displayName} to ${role.replace('_', ' ')}.`, 'success');
    loadMembers();
  };

  const handleTargetUpdate = async (member: UserProfile, targetInr: number) => {
    await updateDoc(doc(db, 'users', member.uid), { monthlyTargetInr: targetInr, updatedAt: serverTimestamp() });
    showToast('Monthly sales target updated.', 'success');
    loadMembers();
  };

  const toggleAttendance = () => {
    const key = `nivaasos_att_${new Date().toISOString().slice(0, 10)}`;
    const next = !checkedInToday;
    setCheckedInToday(next);
    localStorage.setItem(key, next ? 'in' : 'out');
    showToast(next ? `Checked in at ${new Date().toLocaleTimeString('en-IN')}` : 'Checked out for the day.', 'info');
  };

  const isAdmin = activeRole === 'company_admin' || activeRole === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Employees & Teams</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Invite-only onboarding · Role permissions · Monthly INR targets · {members.length}/{company?.userLimit || '∞'} seats used
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAttendance}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold ${
              checkedInToday
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {checkedInToday ? 'Checked In Today' : 'Check In (Attendance)'}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
            >
              <UserPlus className="h-4 w-4" />
              Invite Employee
            </button>
          )}
        </div>
      </div>

      {/* Team Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Team Member</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Monthly Target (INR)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading team...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No employees found.</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{m.displayName}</div>
                      <div className="text-[11px] text-slate-500">{m.email} · {m.phone || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && m.uid !== profile?.uid ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleUpdate(m, e.target.value as AppRole)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs capitalize"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize font-medium">{m.role.replace('_', ' ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatINRCompact(m.monthlyTargetInr || 0)}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleTargetUpdate(m, (m.monthlyTargetInr || 0) + 5000000)}
                          className="ml-2 text-[11px] text-teal-600 hover:underline"
                        >
                          +50L
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize font-medium text-emerald-600">{m.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="font-display text-sm font-bold mb-3">Employee Invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-xs text-slate-500">No pending employee invitations.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {invitations.map((inv) => {
              const link = `${window.location.origin}/auth?mode=invite&companyId=${inv.companyId}&code=${inv.inviteCode}`;
              return (
                <div key={inv.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{inv.displayName || inv.email}</div>
                    <div className="text-[11px] text-slate-500">
                      {inv.email} · {inv.role.replace('_', ' ')} · Code: <span className="font-mono">{inv.inviteCode}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-slate-500">{inv.status}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        showToast('Invite link copied to clipboard.', 'success');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Copy className="h-3 w-3" />
                      Copy Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleInvite} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Invite Employee</h2>
              <button type="button" onClick={() => setShowInviteModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Work Email *</label>
              <input type="email" required value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="agent@agency.in" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Full Name *</label>
              <input type="text" required value={invName} onChange={(e) => setInvName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Assigned Role *</label>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value as Exclude<AppRole, 'super_admin' | 'pending_owner'>)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Generate Invite</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
