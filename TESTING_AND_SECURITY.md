# Security Checklist & Testing Guide

## 1. Multi-Tenant & RBAC Security Checklist
- [x] **Deny by Default**: Root `match /{document=**}` denies all reads/writes unless explicitly matched.
- [x] **Tenant Isolation**: Every subcollection document enforces `companyId == path.companyId` and verifies active membership in that company.
- [x] **Approval Gate**: Companies created via public registration default to `status: "pending_approval"`, `planId: "free"`, `userLimit: 5`. Operational subcollections deny access until Super Admin sets `status: "active"`.
- [x] **No Self-Privilege Escalation**: Users cannot assign `super_admin` or switch `companyId` in `/users/{uid}`. Company Admins cannot mutate `planId`, `userLimit`, `propertyLimit`, or `status`.
- [x] **Role Scoping**:
  - `sales_executive` reads/updates only leads, visits, deals, and tasks where `assignedTo == uid` / `agentUid == uid`.
  - `accountant` manages commissions and deal payment milestones only.
  - `receptionist` creates leads and site visits; cannot delete records or approve commissions.
- [x] **Aadhaar & Secret Isolation (DPDP Act)**: Plaintext 12-digit Aadhaar numbers are rejected by regex (`^XXXX-XXXX-[0-9]{4}$`); TOTP secrets live in `/users/{uid}/private/security`.
- [x] **Immutable Audit Logs**: `auditLogs` and `activities` forbid `update` and `delete`.
- [x] **Storage Rules**: Scoped to `/companies/{companyId}/{folder}/...`, restricted to `image/*` and `application/pdf`, max 10 MB.

## 2. Running Rules Lint & Emulator Verification
1. Lint rules syntax and security checks:
   ```bash
   npx eslint firestore.rules storage.rules
   ```
2. Run the Dirty Dozen security test scenarios against the Firebase Emulator:
   ```bash
   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
   ```
3. Verify `security_spec.md` Dirty Dozen items #1–#12 all return `PERMISSION_DENIED`.

## 3. Manual QA Verification Checklist
1. **Landing & Auth**: Visit `/`, switch monthly/annual pricing, register a new company with optional GST/RERA, verify redirect to `/pending-approval`.
2. **Super Admin**: Sign in as Super Admin, seed demo data, approve a pending company, impersonate a company admin (check audit log entry), suspend/reactivate company.
3. **Leads**: Create lead with `+91` duplicate check, move stages in real-time Kanban, log call/note, click WhatsApp template button, bulk import CSV, export Excel.
4. **Properties & Projects**: Create property in INR (Lakhs/Crores), toggle sq ft / sq m, inspect builder project tower/unit grid.
5. **Customers**: Add buyer with 12-digit Aadhaar input -> verify automatic masking to `XXXX-XXXX-1234` before Firestore write.
6. **Site Visits, Deals & Commissions**: Schedule visit in calendar, calculate Maharashtra/Karnataka/Delhi stamp duty on Deal, close deal, approve & pay commission with 5% TDS and download PDF statement.
7. **DPDP & 2FA**: Enable TOTP 2FA in Settings, export personal JSON data, verify dark/light mode and EN/HI/MR language switching.
