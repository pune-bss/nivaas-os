import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import * as OTPAuth from 'otpauth';
import { auth, db, googleProvider } from '../firebase/config';
import { Company, UserProfile, BusinessType, AppRole } from '../types/crm';
import { writeAuditEvent } from '../firebase/firestoreService';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';

const SUPER_ADMIN_EMAIL = 'shinde.amruta1@gmail.com';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

interface RegisterCompanyInput {
  companyName: string;
  businessType: BusinessType;
  ownerName: string;
  email: string;
  password?: string;
  phone: string;
  city: string;
  state: string;
  pinCode: string;
  gstNumber?: string;
  reraNumber?: string;
  dpdpConsent: boolean;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  company: Company | null;
  activeCompanyId: string | null;
  activeRole: AppRole | null;
  impersonatedCompany: Company | null;
  loading: boolean;
  needsOnboarding: boolean;
  needsEmailVerification: boolean;
  needs2FA: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerCompanyOwner: (input: RegisterCompanyInput) => Promise<void>;
  acceptInvitation: (params: { companyId: string; inviteCode: string; displayName?: string }) => Promise<void>;
  sendPhoneOtp: (phoneE164: string, recaptchaElementId: string) => Promise<void>;
  confirmPhoneOtp: (otp: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  verifyTotpCode: (code: string) => Promise<boolean>;
  impersonateCompany: (comp: Company) => Promise<void>;
  exitImpersonation: () => void;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [impersonatedCompany, setImpersonatedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(() =>
    Number(localStorage.getItem('nivaasos_failed_logins') || '0')
  );
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const val = localStorage.getItem('nivaasos_lockout_until');
    return val ? Number(val) : null;
  });

  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const loadUserProfile = useCallback(async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);

        // Check if TOTP 2FA verification is required in this browser session
        if (data.totpEnabled && sessionStorage.getItem(`nivaasos_2fa_${user.uid}`) !== 'verified') {
          setNeeds2FA(true);
        } else {
          setNeeds2FA(false);
        }
        return data;
      }

      // Auto-provision Bootstrapped Super Admin on first verified sign-in
      if (user.email === SUPER_ADMIN_EMAIL && user.emailVerified) {
        const adminProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Platform Super Admin',
          role: 'super_admin',
          companyId: null,
          status: 'active',
          totpEnabled: false,
          preferredLanguage: 'en',
          isDeleted: false,
        };
        await setDoc(userRef, {
          ...adminProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const created = { ...adminProfile } as UserProfile;
        setProfile(created);
        return created;
      }

      setProfile(null);
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setCompany(null);
        setImpersonatedCompany(null);
        setNeeds2FA(false);
        setLoading(false);
        return;
      }
      if (user.emailVerified || user.providerData.some((p) => p.providerId === 'phone')) {
        await loadUserProfile(user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadUserProfile]);

  // Listen to active user profile & company in real-time
  useEffect(() => {
    if (!firebaseUser) return;
    if (!firebaseUser.emailVerified && !firebaseUser.providerData.some((p) => p.providerId === 'phone')) {
      return;
    }
    const unsubProfile = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      () => {}
    );
    return () => unsubProfile();
  }, [firebaseUser]);

  useEffect(() => {
    const cid = impersonatedCompany?.companyId || profile?.companyId;
    if (!cid || !firebaseUser) {
      setCompany(null);
      return;
    }
    const unsubComp = onSnapshot(
      doc(db, 'companies', cid),
      (snap) => {
        if (snap.exists()) {
          setCompany(snap.data() as Company);
        }
      },
      () => {}
    );
    return () => unsubComp();
  }, [profile?.companyId, impersonatedCompany?.companyId, firebaseUser]);

  // Idle session timeout
  useEffect(() => {
    if (!firebaseUser) return;
    let timer = window.setTimeout(() => {
      signOut(auth);
    }, SESSION_TIMEOUT_MS);

    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        signOut(auth);
      }, SESSION_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [firebaseUser]);

  const checkLockout = () => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      throw new Error(`Account temporarily locked due to repeated failed attempts. Try again in ${mins} minute(s).`);
    }
  };

  const recordFailedAttempt = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    localStorage.setItem('nivaasos_failed_logins', String(next));
    if (next >= 5) {
      const until = Date.now() + 5 * 60 * 1000;
      setLockoutUntil(until);
      localStorage.setItem('nivaasos_lockout_until', String(until));
    }
  };

  const clearFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    localStorage.removeItem('nivaasos_failed_logins');
    localStorage.removeItem('nivaasos_lockout_until');
  };

  const signInWithGoogle = async () => {
    checkLockout();
    const cred = await signInWithPopup(auth, googleProvider);
    clearFailedAttempts();
    await loadUserProfile(cred.user);
    await writeAuditEvent({
      eventType: 'sign_in',
      details: `Google sign-in by ${cred.user.email || cred.user.uid}`,
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    checkLockout();
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      clearFailedAttempts();
      if (!cred.user.emailVerified) {
        return;
      }
      await loadUserProfile(cred.user);
      await writeAuditEvent({
        eventType: 'sign_in',
        details: `Email sign-in by ${cred.user.email}`,
      });
    } catch (err) {
      recordFailedAttempt();
      throw err;
    }
  };

  const registerCompanyOwner = async (input: RegisterCompanyInput) => {
    if (!input.dpdpConsent) {
      throw new Error('DPDP Act consent is required to register an organization.');
    }

    let user = auth.currentUser;
    if (!user && input.password) {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      await updateProfile(cred.user, { displayName: input.ownerName.trim() });
      await sendEmailVerification(cred.user);
      user = cred.user;
    }
    if (!user) throw new Error('Authentication session required.');

    // If email is not yet verified (e.g. newly signed up with email/password), ask user to verify first
    if (!user.emailVerified && !user.providerData.some((p) => p.providerId === 'phone')) {
      localStorage.setItem('nivaasos_pending_company_reg', JSON.stringify(input));
      return;
    }

    const slug = input.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
    const companyId = `${slug || 'company'}_${Date.now().toString(36)}`;

    await setDoc(doc(db, 'companies', companyId), {
      companyId,
      name: input.companyName.trim(),
      businessType: input.businessType,
      ownerUid: user.uid,
      ownerEmail: user.email || input.email.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      state: input.state,
      pinCode: input.pinCode.trim(),
      gstNumber: (input.gstNumber || '').trim().toUpperCase(),
      reraNumber: (input.reraNumber || '').trim().toUpperCase(),
      status: 'pending_approval',
      planId: 'free',
      userLimit: 5,
      propertyLimit: 25,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email || input.email.trim(),
      displayName: input.ownerName.trim(),
      phone: input.phone.trim(),
      role: 'company_admin',
      companyId,
      status: 'pending_approval',
      totpEnabled: false,
      preferredLanguage: 'en',
      dpdpConsentAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });

    localStorage.removeItem('nivaasos_pending_company_reg');
    await loadUserProfile(user);
  };

  const acceptInvitation = async ({
    companyId,
    inviteCode,
    displayName,
  }: {
    companyId: string;
    inviteCode: string;
    displayName?: string;
  }) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in first with your invited email.');
    const inviteRef = doc(db, `companies/${companyId.trim()}/invitations`, inviteCode.trim());
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invitation code not found for this company.');
    }
    const inv = inviteSnap.data();
    if (inv.status !== 'pending') {
      throw new Error('This invitation has already been used or revoked.');
    }
    if (inv.email?.toLowerCase() !== user.email?.toLowerCase()) {
      throw new Error(`This invitation is issued for ${inv.email}. Please sign in with that email.`);
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || inv.email,
        displayName: displayName || user.displayName || inv.displayName || 'Team Member',
        role: inv.role,
        companyId: companyId.trim(),
        inviteCode: inviteCode.trim(),
        status: 'active',
        totpEnabled: false,
        preferredLanguage: 'en',
        dpdpConsentAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });
    } else {
      await updateDoc(userRef, {
        companyId: companyId.trim(),
        role: inv.role,
        status: 'active',
        inviteCode: inviteCode.trim(),
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(inviteRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    await loadUserProfile(user);
  };

  const sendPhoneOtp = async (phoneE164: string, recaptchaElementId: string) => {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
    }
    recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaElementId, { size: 'invisible' });
    phoneConfirmationRef.current = await signInWithPhoneNumber(auth, phoneE164, recaptchaRef.current);
  };

  const confirmPhoneOtp = async (otp: string) => {
    if (!phoneConfirmationRef.current) throw new Error('Request an OTP first.');
    const cred = await phoneConfirmationRef.current.confirm(otp);
    await loadUserProfile(cred.user);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const verifyTotpCode = async (code: string): Promise<boolean> => {
    if (!firebaseUser) return false;
    const secSnap = await getDoc(doc(db, `users/${firebaseUser.uid}/private`, 'security'));
    if (!secSnap.exists() || !secSnap.data().totpSecret) {
      sessionStorage.setItem(`nivaasos_2fa_${firebaseUser.uid}`, 'verified');
      setNeeds2FA(false);
      return true;
    }
    const totp = new OTPAuth.TOTP({
      issuer: 'NivaasOS',
      label: firebaseUser.email || firebaseUser.uid,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secSnap.data().totpSecret),
    });
    const delta = totp.validate({ token: code.trim(), window: 1 });
    if (delta !== null) {
      sessionStorage.setItem(`nivaasos_2fa_${firebaseUser.uid}`, 'verified');
      setNeeds2FA(false);
      return true;
    }
    return false;
  };

  const impersonateCompany = async (comp: Company) => {
    if (profile?.role !== 'super_admin') throw new Error('Only Super Admin can impersonate.');
    setImpersonatedCompany(comp);
    await writeAuditEvent({
      companyId: comp.companyId,
      eventType: 'impersonation',
      targetPath: `companies/${comp.companyId}`,
      details: `Super Admin impersonated ${comp.name} (${comp.companyId})`,
    });
  };

  const exitImpersonation = () => {
    setImpersonatedCompany(null);
  };

  const logout = async (allDevices = false) => {
    if (allDevices && firebaseUser) {
      try {
        await setDoc(
          doc(db, `users/${firebaseUser.uid}/private`, 'security'),
          {
            sessionEpoch: Date.now(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // Proceed with signOut
      }
    }
    if (firebaseUser) {
      sessionStorage.removeItem(`nivaasos_2fa_${firebaseUser.uid}`);
    }
    setImpersonatedCompany(null);
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      await loadUserProfile(auth.currentUser);
    }
  };

  const isPhoneAuth = Boolean(firebaseUser?.providerData.some((p) => p.providerId === 'phone'));
  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified && !isPhoneAuth);
  const needsOnboarding = Boolean(firebaseUser && !needsEmailVerification && !profile && !loading);

  const activeCompanyId = impersonatedCompany?.companyId || profile?.companyId || null;
  const activeRole: AppRole | null = impersonatedCompany
    ? 'company_admin'
    : profile?.role || null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        company,
        activeCompanyId,
        activeRole,
        impersonatedCompany,
        loading,
        needsOnboarding,
        needsEmailVerification,
        needs2FA,
        failedAttempts,
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
        impersonateCompany,
        exitImpersonation,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
