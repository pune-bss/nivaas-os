import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import * as OTPAuth from 'otpauth';
import {
  Building2,
  ShieldCheck,
  Sliders,
  FileDown,
  Trash2,
  LogOut,
  History,
  KeyRound,
  Copy,
  Upload,
} from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { uploadCompanyFile, writeAuditEvent } from '../firebase/firestoreService';
import { AuditLog, BusinessType, CompanySettings, LEAD_SOURCES, LEAD_STAGES } from '../types/crm';
import { INDIAN_STATES, isValidIndianPhone, normalizeIndianPhone, WHATSAPP_TEMPLATES } from '../utils/india';
import { exportToCsv } from '../utils/export';

type SettingsTab = 'company' | 'pipeline' | 'security' | 'dpdp' | 'audit';

export function SettingsPage() {
  const { activeCompanyId, activeRole, profile, company, firebaseUser, logout, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<SettingsTab>(activeCompanyId ? 'company' : 'security');
  const isCompanyAdmin = activeRole === 'company_admin' || activeRole === 'super_admin';

  // Company profile form
  const [compName, setCompName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('agency');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Pipeline & automation settings
  const [pipelineStagesText, setPipelineStagesText] = useState(LEAD_STAGES.join(', '));
  const [leadSourcesText, setLeadSourcesText] = useState(LEAD_SOURCES.join(', '));
  const [autoAssignRoundRobin, setAutoAssignRoundRobin] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(true);
  const [settingsExists, setSettingsExists] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // TOTP 2FA setup state
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [saving2FA, setSaving2FA] = useState(false);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');

  useEffect(() => {
    if (!company) return;
    setCompName(company.name || '');
    setBusinessType(company.businessType || 'agency');
    setPhone(company.phone || '');
    setCity(company.city || '');
    setStateName(company.state || 'Maharashtra');
    setPinCode(company.pinCode || '');
    setGstNumber(company.gstNumber || '');
    setReraNumber(company.reraNumber || '');
    setLogoUrl(company.logoUrl || '');
  }, [company]);

  useEffect(() => {
    if (!activeCompanyId) return;
    getDoc(doc(db, `companies/${activeCompanyId}/settings`, 'default'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as CompanySettings;
          setSettingsExists(true);
          if (data.pipelineStages?.length) setPipelineStagesText(data.pipelineStages.join(', '));
          if (data.leadSources?.length) setLeadSourcesText(data.leadSources.join(', '));
          setAutoAssignRoundRobin(Boolean(data.autoAssignRoundRobin));
          setDailyDigestEnabled(Boolean(data.dailyDigestEnabled));
        } else {
          setSettingsExists(false);
        }
      })
      .catch(() => {});
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId || !isCompanyAdmin) return;
    const q = query(
      collection(db, `companies/${activeCompanyId}/auditLogs`),
      orderBy('createdAt', 'desc'),
      limit(60)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AuditLog[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() } as AuditLog));
        setAuditLogs(rows);
      },
      () => {}
    );
    return () => unsub();
  }, [activeCompanyId, isCompanyAdmin]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId || !isCompanyAdmin) return;
    try {
      const url = await uploadCompanyFile(activeCompanyId, 'branding', file);
      setLogoUrl(url);
      showToast('Logo uploaded. Click Save Company Profile to apply.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Logo upload failed.', 'error');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !isCompanyAdmin) return;
    if (phone && !isValidIndianPhone(phone)) {
      showToast('Please enter a valid 10-digit Indian mobile number (+91).', 'error');
      return;
    }
    setSavingCompany(true);
    try {
      await updateDoc(doc(db, 'companies', activeCompanyId), {
        name: compName.trim(),
        businessType,
        phone: phone ? normalizeIndianPhone(phone) : '',
        city: city.trim(),
        state: stateName,
        pinCode: pinCode.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        reraNumber: reraNumber.trim().toUpperCase(),
        logoUrl: logoUrl.trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('Company profile updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save company profile.', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !isCompanyAdmin || !firebaseUser) return;

    const stages = pipelineStagesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);
    const sources = leadSourcesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    setSavingSettings(true);
    try {
      const refDoc = doc(db, `companies/${activeCompanyId}/settings`, 'default');
      if (settingsExists) {
        await updateDoc(refDoc, {
          pipelineStages: stages,
          leadSources: sources,
          autoAssignRoundRobin,
          dailyDigestEnabled,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(refDoc, {
          companyId: activeCompanyId,
          pipelineStages: stages,
          leadSources: sources,
          whatsappTemplates: WHATSAPP_TEMPLATES,
          autoAssignRoundRobin,
          dailyDigestEnabled,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false,
        });
        setSettingsExists(true);
      }
      showToast('Pipeline & automation rules saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const startTotpSetup = () => {
    if (!firebaseUser) return;
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'NivaasOS',
      label: firebaseUser.email || firebaseUser.uid,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    setPendingSecret(secret.base32);
    setPendingUri(totp.toString());
    setTotpVerifyCode('');
  };

  const confirmEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !pendingSecret) return;

    const totp = new OTPAuth.TOTP({
      issuer: 'NivaasOS',
      label: firebaseUser.email || firebaseUser.uid,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(pendingSecret),
    });

    const delta = totp.validate({ token: totpVerifyCode.trim(), window: 1 });
    if (delta === null) {
      showToast('Invalid 6-digit authenticator code. Please check device clock and try again.', 'error');
      return;
    }

    setSaving2FA(true);
    try {
      const secRef = doc(db, `users/${firebaseUser.uid}/private`, 'security');
      const existingSec = await getDoc(secRef);
      const currentEpoch = existingSec.exists() ? Number(existingSec.data().sessionEpoch || 0) : Date.now();
      await setDoc(
        secRef,
        {
          sessionEpoch: currentEpoch,
          totpSecret: pendingSecret,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        totpEnabled: true,
        updatedAt: serverTimestamp(),
      });
      sessionStorage.setItem(`nivaasos_2fa_${firebaseUser.uid}`, 'verified');
      setPendingSecret(null);
      setPendingUri(null);
      await refreshProfile();
      showToast('TOTP Two-Factor Authentication is now active.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to enable 2FA.', 'error');
    } finally {
      setSaving2FA(false);
    }
  };

  const disableTotp = async () => {
    if (!firebaseUser) return;
    setSaving2FA(true);
    try {
      const secRef = doc(db, `users/${firebaseUser.uid}/private`, 'security');
      const existingSec = await getDoc(secRef);
      const currentEpoch = existingSec.exists() ? Number(existingSec.data().sessionEpoch || 0) : Date.now();
      await setDoc(secRef, {
        sessionEpoch: currentEpoch,
        totpSecret: '',
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        totpEnabled: false,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      showToast('2FA disabled on your account.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disable 2FA.', 'error');
    } finally {
      setSaving2FA(false);
    }
  };

  const handleDpdpExport = async () => {
    if (!profile) return;
    const bundle = {
      exportedAt: new Date().toISOString(),
      legislation: 'Digital Personal Data Protection Act, 2023 (India)',
      userProfile: {
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        companyId: profile.companyId,
        preferredLanguage: profile.preferredLanguage,
      },
      organization: company
        ? {
            companyId: company.companyId,
            name: company.name,
            city: company.city,
            state: company.state,
            gstNumber: company.gstNumber,
            reraNumber: company.reraNumber,
          }
        : null,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpdp-personal-data-${profile.uid.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await writeAuditEvent({
      companyId: activeCompanyId || undefined,
      eventType: 'dpdp_request',
      targetPath: `users/${profile.uid}`,
      details: `User ${profile.email || profile.uid} exported DPDP Act personal data archive.`,
    });
    showToast('Personal data JSON archive downloaded.', 'success');
  };

  const handleDpdpDeletionRequest = async () => {
    if (!firebaseUser) return;
    try {
      const secRef = doc(db, `users/${firebaseUser.uid}/private`, 'security');
      const existingSec = await getDoc(secRef);
      const currentEpoch = existingSec.exists() ? Number(existingSec.data().sessionEpoch || 0) : Date.now();
      const existingSecret = existingSec.exists() ? existingSec.data().totpSecret : undefined;
      await setDoc(secRef, {
        sessionEpoch: currentEpoch,
        ...(existingSecret ? { totpSecret: existingSecret } : {}),
        dpdpDeletionRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditEvent({
        companyId: activeCompanyId || undefined,
        eventType: 'dpdp_request',
        targetPath: `users/${firebaseUser.uid}/private/security`,
        details: `DPDP Act data erasure request submitted by ${profile?.email || firebaseUser.uid}.`,
      });
      showToast('DPDP data erasure request logged with your Data Protection Officer.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit erasure request.', 'error');
    }
  };

  const filteredAuditLogs = auditLogs.filter(
    (log) => auditFilter === 'all' || log.eventType === auditFilter
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Workspace Settings & Security
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Organization RERA/GST metadata, pipeline rules, TOTP 2FA, DPDP Act compliance & audit trails.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
        {activeCompanyId && (
          <>
            <button
              type="button"
              onClick={() => setTab('company')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium ${
                tab === 'company'
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Company Profile
            </button>
            <button
              type="button"
              onClick={() => setTab('pipeline')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium ${
                tab === 'pipeline'
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Pipeline & Automation
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setTab('security')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium ${
            tab === 'security'
              ? 'bg-slate-900 dark:bg-teal-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          2FA & Sessions
        </button>
        <button
          type="button"
          onClick={() => setTab('dpdp')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium ${
            tab === 'dpdp'
              ? 'bg-slate-900 dark:bg-teal-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileDown className="h-3.5 w-3.5" />
          DPDP Act Compliance
        </button>
        {activeCompanyId && isCompanyAdmin && (
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium ${
              tab === 'audit'
                ? 'bg-slate-900 dark:bg-teal-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Company Audit Logs
          </button>
        )}
      </div>

      {/* Company Profile Tab */}
      {tab === 'company' && company && (
        <form
          onSubmit={handleSaveCompany}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-3xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base">Organization Identity & Statutory Numbers</h2>
            {!isCompanyAdmin && (
              <span className="text-xs text-slate-500">Read-only (Company Admin required to edit)</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Registered Company Name</label>
              <input
                type="text"
                required
                disabled={!isCompanyAdmin}
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Business Type</label>
              <select
                disabled={!isCompanyAdmin}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
              >
                <option value="agency">Real Estate Agency</option>
                <option value="broker">Channel Partner / Broker</option>
                <option value="builder">Builder / Developer</option>
                <option value="consultant">Property Consultant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Primary Contact (+91)</label>
              <input
                type="text"
                disabled={!isCompanyAdmin}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919820112233"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">City</label>
              <input
                type="text"
                disabled={!isCompanyAdmin}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">State</label>
              <select
                disabled={!isCompanyAdmin}
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">PIN Code</label>
              <input
                type="text"
                disabled={!isCompanyAdmin}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">GSTIN</label>
              <input
                type="text"
                disabled={!isCompanyAdmin}
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="27AABCS1429B1ZS"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">State RERA ID</label>
              <input
                type="text"
                disabled={!isCompanyAdmin}
                value={reraNumber}
                onChange={(e) => setReraNumber(e.target.value)}
                placeholder="P51900048210"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase disabled:opacity-60"
              />
            </div>
          </div>

          {isCompanyAdmin && (
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                <Upload className="h-4 w-4 text-teal-600" />
                <span>Upload Company Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              <button
                type="submit"
                disabled={savingCompany}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
              >
                {savingCompany ? 'Saving...' : 'Save Company Profile'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Pipeline & Automation Tab */}
      {tab === 'pipeline' && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-3xl space-y-4"
        >
          <h2 className="font-display font-semibold text-base">Lead Pipeline & Assignment Rules</h2>
          <div>
            <label className="block text-xs font-medium mb-1">
              Pipeline Stage Labels (comma-separated, max 15)
            </label>
            <input
              type="text"
              disabled={!isCompanyAdmin}
              value={pipelineStagesText}
              onChange={(e) => setPipelineStagesText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Active Lead Sources (comma-separated, max 20)
            </label>
            <input
              type="text"
              disabled={!isCompanyAdmin}
              value={leadSourcesText}
              onChange={(e) => setLeadSourcesText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm disabled:opacity-60"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                disabled={!isCompanyAdmin}
                checked={autoAssignRoundRobin}
                onChange={(e) => setAutoAssignRoundRobin(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Enable round-robin auto-assignment for new portal leads (99acres / MagicBricks)</span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                disabled={!isCompanyAdmin}
                checked={dailyDigestEnabled}
                onChange={(e) => setDailyDigestEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Send morning 09:00 AM IST scheduled follow-up digest notifications</span>
            </label>
          </div>

          {isCompanyAdmin && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Pipeline Settings'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Security & 2FA Tab */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600" />
              <h2 className="font-display font-semibold text-base">
                Two-Factor Authentication (TOTP)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Recommended for Super Admins and Company Admins. Protects client KYC & commission records with Google Authenticator or Microsoft Authenticator.
            </p>

            <div className="text-xs font-medium">
              Current Status:{' '}
              <span className={profile?.totpEnabled ? 'text-emerald-600' : 'text-amber-600'}>
                {profile?.totpEnabled ? 'Enabled & Enforced' : 'Not Configured'}
              </span>
            </div>

            {profile?.totpEnabled ? (
              <button
                type="button"
                disabled={saving2FA}
                onClick={disableTotp}
                className="px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Disable 2FA
              </button>
            ) : pendingSecret ? (
              <form onSubmit={confirmEnableTotp} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3 text-xs space-y-2">
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    1. Add this setup key to your Authenticator app:
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-xs bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700">
                    <span className="truncate">{pendingSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pendingSecret);
                        showToast('Secret key copied.', 'success');
                      }}
                      className="text-teal-600 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pendingUri && (
                    <div className="text-[11px] text-slate-500 break-all font-mono">
                      URI: {pendingUri}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">2. Enter 6-digit code to verify</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tracking-widest"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving2FA}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-500"
                  >
                    {saving2FA ? 'Activating...' : 'Verify & Enable 2FA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingSecret(null)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={startTotpSetup}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-medium hover:opacity-90"
              >
                Set Up Authenticator App
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-amber-600" />
              <h2 className="font-display font-semibold text-base">Active Session Controls</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Idle sessions automatically sign out after 30 minutes of inactivity. Use global sign-out to rotate your session epoch across all browsers and mobile devices.
            </p>
            <button
              type="button"
              onClick={() => logout(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout From All Devices
            </button>
          </div>
        </div>
      )}

      {/* DPDP Act Tab */}
      {tab === 'dpdp' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-3xl space-y-5">
          <div>
            <h2 className="font-display font-semibold text-base">
              Digital Personal Data Protection (DPDP) Act, 2023
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Under India&apos;s DPDP Act, every Data Principal has the right to obtain a summary of personal data processed and request erasure of personal records.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDpdpExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-500"
            >
              <FileDown className="h-4 w-4" />
              Export My Personal Data (JSON)
            </button>
            <button
              type="button"
              onClick={handleDpdpDeletionRequest}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Request Data Erasure
            </button>
          </div>
        </div>
      )}

      {/* Company Audit Logs Tab */}
      {tab === 'audit' && isCompanyAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              aria-label="Filter audit events"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="all">All Event Types</option>
              <option value="sign_in">Sign In</option>
              <option value="invite">Team Invitation</option>
              <option value="role_change">Role Change</option>
              <option value="export">Report Export</option>
              <option value="soft_delete">Soft Delete</option>
              <option value="dpdp_request">DPDP Request</option>
              <option value="impersonation">Admin Impersonation</option>
            </select>

            <button
              type="button"
              onClick={() =>
                exportToCsv(
                  `audit-logs-${activeCompanyId}.csv`,
                  filteredAuditLogs.map((l) => ({
                    Event: l.eventType,
                    Actor: l.actorEmail || l.actorUid,
                    Target: l.targetPath || '',
                    Details: l.details,
                  }))
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              Export Audit CSV
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Target Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 font-mono uppercase text-teal-600">{log.eventType}</td>
                        <td className="px-4 py-3">{log.actorEmail || log.actorUid}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.details}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{log.targetPath || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
