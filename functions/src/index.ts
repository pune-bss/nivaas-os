import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';

initializeApp();
const auth = getAuth();
const db = getFirestore();

type AppRole =
  | 'super_admin'
  | 'company_admin'
  | 'sales_manager'
  | 'sales_executive'
  | 'accountant'
  | 'receptionist';

async function writeAudit(params: {
  companyId?: string;
  actorUid: string;
  actorEmail?: string;
  eventType: string;
  targetPath?: string;
  details: string;
}) {
  const payload = {
    companyId: params.companyId || '',
    actorUid: params.actorUid,
    actorEmail: params.actorEmail || '',
    eventType: params.eventType,
    targetPath: params.targetPath || '',
    details: params.details.slice(0, 500),
    createdBy: params.actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isDeleted: false,
  };
  await db.collection('platform/auditLogs/items').add(payload);
  if (params.companyId) {
    await db.collection(`companies/${params.companyId}/auditLogs`).add(payload);
  }
}

function assertSuperAdmin(authCtx: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!authCtx) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (authCtx.token.role !== 'super_admin' && authCtx.token.email !== 'shinde.amruta1@gmail.com') {
    throw new HttpsError('permission-denied', 'Super Admin privilege required.');
  }
}

export const approveCompany = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const { companyId, planId = 'starter', userLimit = 15, propertyLimit = 150 } = request.data as {
    companyId: string;
    planId?: string;
    userLimit?: number;
    propertyLimit?: number;
  };
  if (!companyId) throw new HttpsError('invalid-argument', 'companyId is required.');

  const compRef = db.doc(`companies/${companyId}`);
  const compSnap = await compRef.get();
  if (!compSnap.exists) throw new HttpsError('not-found', 'Company not found.');
  const ownerUid = compSnap.data()!.ownerUid as string;

  await compRef.update({
    status: 'active',
    planId,
    userLimit,
    propertyLimit,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`users/${ownerUid}`).update({
    role: 'company_admin',
    status: 'active',
    companyId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await auth.setCustomUserClaims(ownerUid, { role: 'company_admin', companyId });

  await writeAudit({
    companyId,
    actorUid: request.auth!.uid,
    actorEmail: String(request.auth!.token.email || ''),
    eventType: 'company_approval',
    targetPath: `companies/${companyId}`,
    details: `Approved company ${companyId} on plan ${planId}.`,
  });

  return { ok: true, companyId, status: 'active' };
});

export const suspendCompany = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const { companyId, reason = 'Administrative suspension' } = request.data as {
    companyId: string;
    reason?: string;
  };
  if (!companyId) throw new HttpsError('invalid-argument', 'companyId is required.');

  await db.doc(`companies/${companyId}`).update({
    status: 'suspended',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    companyId,
    actorUid: request.auth!.uid,
    actorEmail: String(request.auth!.token.email || ''),
    eventType: 'company_approval',
    targetPath: `companies/${companyId}`,
    details: `Suspended company ${companyId}: ${reason}`,
  });

  return { ok: true, companyId, status: 'suspended' };
});

export const inviteEmployee = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required.');
  const callerRole = request.auth.token.role as string;
  const callerCompany = request.auth.token.companyId as string;
  const { companyId, email, displayName, role } = request.data as {
    companyId: string;
    email: string;
    displayName: string;
    role: AppRole;
  };

  if (callerRole !== 'super_admin' && (callerRole !== 'company_admin' || callerCompany !== companyId)) {
    throw new HttpsError('permission-denied', 'Only Company Admin can invite employees.');
  }
  if (role === 'super_admin') {
    throw new HttpsError('permission-denied', 'Cannot invite Super Admin.');
  }

  // Enforce plan user limit
  const compSnap = await db.doc(`companies/${companyId}`).get();
  if (!compSnap.exists) throw new HttpsError('not-found', 'Company not found.');
  const userLimit = Number(compSnap.data()!.userLimit || 5);
  const activeUsersSnap = await db.collection('users').where('companyId', '==', companyId).where('isDeleted', '==', false).get();
  if (activeUsersSnap.size >= userLimit) {
    throw new HttpsError('resource-exhausted', `User limit (${userLimit}) reached for current plan.`);
  }

  const inviteCode = randomBytes(12).toString('hex');
  await db.doc(`companies/${companyId}/invitations/${inviteCode}`).set({
    companyId,
    email: email.toLowerCase().trim(),
    displayName: displayName.trim(),
    role,
    inviteCode,
    status: 'pending',
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isDeleted: false,
  });

  await writeAudit({
    companyId,
    actorUid: request.auth.uid,
    actorEmail: String(request.auth.token.email || ''),
    eventType: 'invite',
    targetPath: `companies/${companyId}/invitations/${inviteCode}`,
    details: `Invited ${email} as ${role}.`,
  });

  return { ok: true, inviteCode };
});

export const setUserRole = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required.');
  const { targetUid, companyId, role } = request.data as {
    targetUid: string;
    companyId: string;
    role: AppRole;
  };
  const callerRole = request.auth.token.role as string;
  const callerCompany = request.auth.token.companyId as string;

  if (callerRole !== 'super_admin' && (callerRole !== 'company_admin' || callerCompany !== companyId)) {
    throw new HttpsError('permission-denied', 'Unauthorized role assignment.');
  }
  if (role === 'super_admin' && callerRole !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Cannot escalate to super_admin.');
  }

  await db.doc(`users/${targetUid}`).update({
    role,
    companyId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await auth.setCustomUserClaims(targetUid, { role, companyId });
  await auth.revokeRefreshTokens(targetUid);

  await writeAudit({
    companyId,
    actorUid: request.auth.uid,
    actorEmail: String(request.auth.token.email || ''),
    eventType: 'role_change',
    targetPath: `users/${targetUid}`,
    details: `Changed role for ${targetUid} to ${role}.`,
  });

  return { ok: true };
});

export const impersonateCompanyAdmin = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const { companyId } = request.data as { companyId: string };
  await writeAudit({
    companyId,
    actorUid: request.auth!.uid,
    actorEmail: String(request.auth!.token.email || ''),
    eventType: 'impersonation',
    targetPath: `companies/${companyId}`,
    details: `Super Admin initiated audited impersonation of company ${companyId}.`,
  });
  return { ok: true, companyId };
});

export const onDealClosedCalculateCommission = onDocumentUpdated(
  'companies/{companyId}/deals/{dealId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.stage !== 'Closed Won' && after.stage === 'Closed Won') {
      const companyId = event.params.companyId;
      const dealValueInr = Number(after.dealValueInr || 0);
      const ratePercent = 2; // Default 2% Indian brokerage standard
      const grossAmountInr = Math.round((dealValueInr * ratePercent) / 100);
      const tdsPercent = 5; // Section 194H 5% TDS
      const tdsAmountInr = Math.round((grossAmountInr * tdsPercent) / 100);
      const netPayableInr = grossAmountInr - tdsAmountInr;

      await db.collection(`companies/${companyId}/commissions`).add({
        companyId,
        dealId: event.params.dealId,
        dealTitle: after.title,
        agentUid: after.agentUid,
        agentName: after.agentName || 'Assigned Agent',
        ruleType: 'percentage',
        ratePercent,
        grossAmountInr,
        tdsPercent,
        tdsAmountInr,
        netPayableInr,
        splitPercent: 100,
        status: 'pending',
        createdBy: after.agentUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isDeleted: false,
      });
    }
  }
);

export const dailyFollowUpDigest = onSchedule('every day 08:30', async () => {
  const companiesSnap = await db.collection('companies').where('status', '==', 'active').get();
  const nowIso = new Date().toISOString();

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    const overdueSnap = await db
      .collection(`companies/${companyId}/tasks`)
      .where('status', '==', 'pending')
      .where('dueAt', '<=', nowIso)
      .get();

    const byAgent = new Map<string, number>();
    overdueSnap.forEach((docSnap) => {
      const uid = docSnap.data().assignedTo as string;
      byAgent.set(uid, (byAgent.get(uid) || 0) + 1);
    });

    for (const [agentUid, count] of byAgent.entries()) {
      await db.collection(`companies/${companyId}/notifications`).add({
        companyId,
        recipientUid: agentUid,
        title: 'Daily Follow-up Digest',
        message: `You have ${count} due or overdue follow-up(s) today.`,
        read: false,
        link: '/app/tasks',
        createdBy: 'system',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isDeleted: false,
      });
    }
  }
});
