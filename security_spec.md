# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document inside `/companies/{companyId}/...` MUST carry `companyId == companyId` (matching the path segment) and can ONLY be read or written by active members of that exact `companyId` (or Super Admin).
2. **Company Approval Gate**: A newly registered company starts with `status == "pending_approval"`. Non-Super-Admin users cannot read/write operational subcollections (`leads`, `properties`, `deals`, `commissions`, etc.) until `companies/{companyId}.status == "active"`.
3. **No Self-Privilege Escalation**: A user creating or updating their own `/users/{uid}` document can NEVER set `role = "super_admin"` or swap their `companyId` to another tenant. Joining an existing company requires a matching pending invitation in `/companies/{companyId}/invitations/{inviteId}`.
4. **Role-Bound Operational Access**:
   - `sales_executive`: Can read/update only `leads`, `siteVisits`, `deals`, and `tasks` assigned to their own `uid` (`assignedTo == request.auth.uid` / `agentUid == request.auth.uid`). Cannot read/write `commissions` payout approvals or `settings`.
   - `accountant`: Can read/write `commissions` and `deals` payment milestones; cannot mutate `leads` or `settings`.
   - `receptionist`: Can create `leads` and `siteVisits`; cannot delete records or modify `commissions` / `settings`.
   - `sales_manager`: Can read/write all team `leads`, `properties`, `projects`, `customers`, `siteVisits`, `deals`, `tasks`.
   - `company_admin`: Full tenant administration within their `companyId`, excluding platform-level fields (`planId`, `userLimit`, `propertyLimit`, `status` approval).
5. **Immutable Audit & Ownership Fields**: `companyId`, `createdBy`, and `createdAt` are immutable after document creation. `updatedAt` MUST equal `request.time` (or valid timestamp on creation).
6. **PII & DPDP Isolation**: TOTP secrets live strictly in `/users/{uid}/private/security` (owner-only). Plaintext 12-digit Aadhaar numbers are blocked (`maskedAadhaar` pattern `^XXXX-XXXX-\d{4}$`).
7. **Storage Hardening**: `/companies/{companyId}/...` storage objects are restricted to active company members, allow only `image/*` or `application/pdf`, and enforce a strict `10 MB` (`10 * 1024 * 1024` bytes) ceiling.

## 2. The "Dirty Dozen" Attack Payloads (Verified Denied)
1. **Cross-Tenant Read**: User in `company_a` attempts `get(/companies/company_b/leads/lead_1)`.
2. **Cross-Tenant Write Spoof**: User in `company_a` attempts `create(/companies/company_b/leads/lead_2)` with `companyId: "company_a"`.
3. **Self-Promotion to Super Admin**: Normal user attempts `set(/users/{uid}, { role: "super_admin", status: "active" })`.
4. **Tenant Hopping Update**: Company Admin in `company_a` attempts `update(/users/{uid}, { companyId: "company_b" })`.
5. **Unapproved Company Bypass**: Owner of a `pending_approval` company attempts to create a lead before Super Admin approval.
6. **Sales Executive Accessing Other Agent's Lead**: `sales_executive` `uid_1` attempts to update `leads/lead_2` where `assignedTo == "uid_2"`.
7. **Sales Executive Approving Own Commission**: `sales_executive` attempts `update(/companies/company_a/commissions/comm_1, { status: "paid" })`.
8. **Shadow Field Injection ("Ghost Field")**: Authenticated user submits lead create payload with extra undocumented field `isAdminBypass: true`.
9. **Resource Exhaustion ("Denial of Wallet")**: User attempts to create a lead with a 50KB `notes` string or 2KB document ID.
10. **Plaintext Aadhaar Storage Violation**: User attempts to save `maskedAadhaar: "123456789012"` instead of masked `XXXX-XXXX-9012`.
11. **Unverified Email Bypass**: Unverified email user (`email_verified == false`) attempts to write to `/companies/{companyId}/leads`.
12. **Company Admin Mutating Subscription Plan**: `company_admin` attempts `update(/companies/company_a, { planId: "enterprise", userLimit: 9999 })`.
