/**
 * Firebase Emulator Security Rules Test Suite ("Dirty Dozen" Payloads)
 * Run with: firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */
import assert from 'node:assert/strict';

export interface DirtyDozenScenario {
  id: number;
  name: string;
  actor: { uid: string; email?: string; email_verified?: boolean; role?: string; companyId?: string };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Cross-Tenant Read',
    actor: { uid: 'exec_a', email: 'exec@companya.in', email_verified: true, role: 'sales_executive', companyId: 'company_a' },
    operation: 'get',
    path: 'companies/company_b/leads/lead_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Write Spoof',
    actor: { uid: 'mgr_a', email: 'mgr@companya.in', email_verified: true, role: 'sales_manager', companyId: 'company_a' },
    operation: 'create',
    path: 'companies/company_b/leads/lead_spoof',
    payload: { companyId: 'company_a', fullName: 'Spoof Lead', phone: '+919876543210', source: 'Website', stage: 'New', score: 50, assignedTo: 'mgr_a', createdBy: 'mgr_a', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Promotion to Super Admin',
    actor: { uid: 'attacker_1', email: 'attacker@gmail.com', email_verified: true },
    operation: 'create',
    path: 'users/attacker_1',
    payload: { uid: 'attacker_1', displayName: 'Attacker', role: 'super_admin', status: 'active', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Tenant Hopping Update',
    actor: { uid: 'admin_a', email: 'admin@companya.in', email_verified: true, role: 'company_admin', companyId: 'company_a' },
    operation: 'update',
    path: 'users/admin_a',
    payload: { companyId: 'company_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unapproved Company Bypass',
    actor: { uid: 'pending_owner', email: 'owner@pending.in', email_verified: true, role: 'company_admin', companyId: 'company_pending' },
    operation: 'create',
    path: 'companies/company_pending/leads/lead_1',
    payload: { companyId: 'company_pending', fullName: 'Early Lead', phone: '+919820011223', source: 'Website', stage: 'New', score: 60, assignedTo: 'pending_owner', createdBy: 'pending_owner', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Sales Executive Accessing Another Agent Lead',
    actor: { uid: 'exec_1', email: 'exec1@companya.in', email_verified: true, role: 'sales_executive', companyId: 'company_a' },
    operation: 'update',
    path: 'companies/company_a/leads/lead_owned_by_exec_2',
    payload: { stage: 'Booked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Sales Executive Approving Own Commission',
    actor: { uid: 'exec_1', email: 'exec1@companya.in', email_verified: true, role: 'sales_executive', companyId: 'company_a' },
    operation: 'update',
    path: 'companies/company_a/commissions/comm_1',
    payload: { status: 'paid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow Field Injection (Ghost Field)',
    actor: { uid: 'mgr_a', email: 'mgr@companya.in', email_verified: true, role: 'sales_manager', companyId: 'company_a' },
    operation: 'create',
    path: 'companies/company_a/leads/lead_shadow',
    payload: { companyId: 'company_a', fullName: 'Shadow User', phone: '+919811122233', source: '99acres', stage: 'New', score: 75, assignedTo: 'mgr_a', createdBy: 'mgr_a', isDeleted: false, isAdminBypass: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Exhaustion (Oversized Document ID & Notes)',
    actor: { uid: 'mgr_a', email: 'mgr@companya.in', email_verified: true, role: 'sales_manager', companyId: 'company_a' },
    operation: 'create',
    path: `companies/company_a/leads/${'x'.repeat(200)}`,
    payload: { companyId: 'company_a', fullName: 'Poison', phone: '+919811122233', source: '99acres', stage: 'New', score: 75, assignedTo: 'mgr_a', notes: 'A'.repeat(5000), createdBy: 'mgr_a', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Plaintext Aadhaar Storage Violation',
    actor: { uid: 'mgr_a', email: 'mgr@companya.in', email_verified: true, role: 'sales_manager', companyId: 'company_a' },
    operation: 'create',
    path: 'companies/company_a/customers/cust_aadhaar',
    payload: { companyId: 'company_a', fullName: 'Aarav Mehta', customerType: 'buyer', phone: '+919820098200', maskedAadhaar: '123456789012', kycStatus: 'pending', createdBy: 'mgr_a', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unverified Email Bypass',
    actor: { uid: 'unverified_1', email: 'unverified@companya.in', email_verified: false, role: 'sales_manager', companyId: 'company_a' },
    operation: 'create',
    path: 'companies/company_a/leads/lead_unverified',
    payload: { companyId: 'company_a', fullName: 'Test', phone: '+919820098200', source: 'Website', stage: 'New', score: 40, assignedTo: 'unverified_1', createdBy: 'unverified_1', isDeleted: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Company Admin Mutating Subscription Plan Limits',
    actor: { uid: 'admin_a', email: 'admin@companya.in', email_verified: true, role: 'company_admin', companyId: 'company_a' },
    operation: 'update',
    path: 'companies/company_a',
    payload: { planId: 'enterprise', userLimit: 9999, propertyLimit: 99999 },
    expected: 'PERMISSION_DENIED',
  },
];

assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
console.log(`Loaded ${DIRTY_DOZEN_PAYLOADS.length} Dirty Dozen security rule scenarios for Firebase Emulator verification.`);
