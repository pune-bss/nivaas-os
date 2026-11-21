import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Phone, Mail, KeyRound, Building2, UserPlus, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { INDIAN_STATES, evaluatePasswordStrength, normalizeIndianPhone, isValidIndianPhone } from '../utils/india';
import { BusinessType } from '../types/crm';

type AuthTab = 'signin' | 'register' | 'invite' | 'phone' | 'reset';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthTab) || 'signin';
  const [tab, setTab] = useState<AuthTab>(initialMode);
  const {
    firebaseUser,
    profile,
    needsOnboarding,
    needsEmailVerification,
    needs2FA,
    lockoutUntil,
    signInWithGoogle,
    signInWithEmail,
    registerCompanyOwner,
    acceptInvitation,
    sendPhoneOtp,
    confirmPhoneOtp,
    resendVerificationEmail,
    sendResetPassword,
    verifyTotpCode,
    refreshProfile,
    logout,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Sign-In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Company Registration state
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('agency');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [dpdpConsent, setDpdpConsent] = useState(false);

  // Invite state
  const [inviteCompanyId, setInviteCompanyId] = useState(searchParams.get('companyId') || '');
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '');
  const [inviteName, setInviteName] = useState('');

  // Phone OTP state
  const [phoneInput, setPhoneInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');

  // 2FA state
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    if (firebaseUser && profile && !needsEmailVerification && !needs2FA) {
      if (profile.status === 'pending_approval' || profile.status === 'suspended') {
        navigate('/pending-approval', { replace: true });
      } else if (profile.role === 'super_admin') {
        navigate('/app/super-admin', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [firebaseUser, profile, needsEmailVerification, needs2FA, navigate]);

  const strength = evaluatePasswordStrength(regPassword);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      showToast('Signed in with Google.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      showToast('Signed in successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sign in failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCompanyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser && strength.score < 4) {
      showToast('Please choose a stronger password (at least 8 chars with uppercase, lowercase, number, and symbol).', 'error');
      return;
    }
    if (!isValidIndianPhone(regPhone)) {
      showToast('Please enter a valid 10-digit Indian mobile number (+91).', 'error');
      return;
    }
    setBusy(true);
    try {
      await registerCompanyOwner({
        companyName,
        businessType,
        ownerName: ownerName || firebaseUser?.displayName || 'Company Owner',
        email: regEmail || firebaseUser?.email || '',
        password: firebaseUser ? undefined : regPassword,
        phone: normalizeIndianPhone(regPhone),
        city,
        state: stateName,
        pinCode,
        gstNumber,
        reraNumber,
        dpdpConsent,
      });
      showToast('Company registration submitted for Super Admin review.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Registration failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await acceptInvitation({
        companyId: inviteCompanyId,
        inviteCode,
        displayName: inviteName,
      });
      showToast('Invitation accepted! Welcome to your company workspace.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not accept invitation.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = normalizeIndianPhone(phoneInput);
    if (!isValidIndianPhone(formatted)) {
      showToast('Enter a valid Indian mobile number (+9198XXXXXXXX).', 'error');
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(formatted, 'recaptcha-phone-container');
      setOtpSent(true);
      showToast(`OTP sent to ${formatted}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send Phone OTP. Ensure Phone Auth is enabled in Firebase Console.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await confirmPhoneOtp(otpCode);
      showToast('Phone verified.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid OTP code.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await verifyTotpCode(totpCode);
      if (!ok) showToast('Invalid 6-digit authenticator code.', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Gate 1: TOTP 2FA Verification
  if (firebaseUser && needs2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
          <div className="flex items-center gap-2.5 text-teal-600 mb-3">
            <ShieldCheck className="h-6 w-6" />
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Enter the 6-digit code from your TOTP authenticator app to unlock your workspace.
          </p>
          <form onSubmit={handleTotpVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center text-lg tracking-widest"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 disabled:opacity-50"
            >
              Verify Code
            </button>
          </form>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-4 w-full text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Gate 2: Mandatory Email Verification
  if (firebaseUser && needsEmailVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
          <Mail className="h-8 w-8 text-teal-600 mb-3" />
          <h1 className="font-display text-xl font-bold mb-2">Verify your email address</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            A verification link was sent to <strong>{firebaseUser.email}</strong>. Security rules require verified email addresses before creating company records.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                await refreshProfile();
                const saved = localStorage.getItem('nivaasos_pending_company_reg');
                if (saved && authCheckVerified()) {
                  await registerCompanyOwner(JSON.parse(saved));
                }
              }}
              className="w-full py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500"
            >
              I Have Verified My Email
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                showToast('Verification email resent.', 'info');
              }}
              className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-xs text-slate-500 pt-2"
            >
              Sign out and switch account
            </button>
          </div>
        </div>
      </div>
    );
  }

  function authCheckVerified() {
    return Boolean(firebaseUser?.emailVerified);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-10 px-4">
      <div className="max-w-xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to NivaasOS Home
          </Link>
          {firebaseUser && (
            <button type="button" onClick={() => logout()} className="text-xs text-rose-600 hover:underline">
              Sign Out ({firebaseUser.email || firebaseUser.phoneNumber})
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {needsOnboarding ? 'Complete Your Organization Setup' : 'NivaasOS Workspace Access'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {needsOnboarding
                ? 'Register a new real estate company or join an existing team via invite code.'
                : 'Sign in with Google, verified email, Indian +91 OTP, or register your company.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 mb-6">
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => setTab('signin')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === 'signin' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'register' || (needsOnboarding && tab === 'signin')
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Register Company
            </button>
            <button
              type="button"
              onClick={() => setTab('invite')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'invite' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Join via Invite
            </button>
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => setTab('phone')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === 'phone' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                +91 Phone OTP
              </button>
            )}
          </div>

          {lockoutUntil && Date.now() < lockoutUntil && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              Too many failed login attempts. Sign-in is temporarily locked for security.
            </div>
          )}

          {/* Tab 1: Sign In */}
          {tab === 'signin' && !firebaseUser && (
            <div className="space-y-5">
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span>Continue with Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="shrink mx-3 text-xs text-slate-400">or email & password</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.in"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium">Password</label>
                    <button
                      type="button"
                      onClick={() => setTab('reset')}
                      className="text-xs text-teal-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-teal-500 disabled:opacity-50"
                >
                  Sign In
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Company Registration */}
          {(tab === 'register' || (needsOnboarding && tab === 'signin')) && (
            <form onSubmit={handleCompanyRegister} className="space-y-4">
              {!firebaseUser && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Prefer instant verification?
                  </span>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    className="px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Connect Google First
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Company / Agency Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Sahyadri Realty Pvt Ltd"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Business Type *</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="agency">Real Estate Agency</option>
                    <option value="broker">Channel Partner / Broker</option>
                    <option value="builder">Builder / Developer</option>
                    <option value="consultant">Property Consultant</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    value={ownerName || firebaseUser?.displayName || ''}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Aarav Deshmukh"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Mobile (+91) *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+919820112233"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              {!firebaseUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Owner Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="founder@agency.in"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                    {regPassword && (
                      <div className="text-[11px] mt-1 text-slate-500">
                        Strength: <strong>{strength.label}</strong> ({strength.score}/5)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">State *</label>
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    pattern="^[1-9][0-9]{5}$"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="400051"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="27AABCS1429B1ZS"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">RERA Registration (Optional)</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={reraNumber}
                    onChange={(e) => setReraNumber(e.target.value)}
                    placeholder="P51900048210"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dpdpConsent}
                  onChange={(e) => setDpdpConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  I consent to NivaasOS processing my organization & KYC metadata under the Digital Personal Data Protection (DPDP) Act, 2023.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 disabled:opacity-50"
              >
                <Building2 className="h-4 w-4" />
                Submit Company for Super Admin Approval
              </button>
            </form>
          )}

          {/* Tab 3: Join via Employee Invitation */}
          {tab === 'invite' && (
            <div className="space-y-4">
              {!firebaseUser && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-3">
                  <p>Employees join strictly by invitation. First sign in using the invited Google email address:</p>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white font-semibold"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              <form onSubmit={handleAcceptInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Company ID *</label>
                  <input
                    type="text"
                    required
                    value={inviteCompanyId}
                    onChange={(e) => setInviteCompanyId(e.target.value)}
                    placeholder="sahyadri_realty"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Invitation Code *</label>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Paste invite token"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Your Display Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Priya Kulkarni"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !firebaseUser}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Accept Invitation & Join Company
                </button>
              </form>
            </div>
          )}

          {/* Tab 4: Phone OTP (+91) */}
          {tab === 'phone' && !firebaseUser && (
            <div className="space-y-4">
              <div id="recaptcha-phone-container" />
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Indian Mobile Number (+91)</label>
                    <input
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+919820112233"
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold"
                  >
                    <Phone className="h-4 w-4" />
                    Send SMS OTP
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Enter 6-digit OTP</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-center tracking-widest"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Verify & Sign In
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Tab 5: Forgot / Reset Password */}
          {tab === 'reset' && !firebaseUser && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await sendResetPassword(resetEmail);
                  showToast('Password reset link sent to your email.', 'success');
                  setTab('signin');
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Failed to send reset link.', 'error');
                } finally {
                  setBusy(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold"
              >
                <KeyRound className="h-4 w-4" />
                Send Password Reset Link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
