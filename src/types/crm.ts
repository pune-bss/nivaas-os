export type AppRole =
  | 'super_admin'
  | 'company_admin'
  | 'sales_manager'
  | 'sales_executive'
  | 'accountant'
  | 'receptionist'
  | 'pending_owner';

export type AccountStatus = 'active' | 'invited' | 'suspended' | 'pending_approval';
export type CompanyStatus = 'pending_approval' | 'active' | 'suspended';
export type BusinessType = 'agency' | 'broker' | 'builder' | 'consultant';
export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';
export type AppLanguage = 'en' | 'hi' | 'mr';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName: string;
  phone?: string;
  role: AppRole;
  companyId?: string | null;
  status: AccountStatus;
  totpEnabled?: boolean;
  preferredLanguage?: AppLanguage;
  dpdpConsentAt?: unknown;
  monthlyTargetInr?: number;
  inviteCode?: string;
  lastLoginAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface Company {
  companyId: string;
  name: string;
  businessType: BusinessType;
  ownerUid: string;
  ownerEmail?: string;
  phone?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstNumber?: string;
  reraNumber?: string;
  status: CompanyStatus;
  planId: PlanId;
  userLimit: number;
  propertyLimit: number;
  trialEndsAt?: unknown;
  logoUrl?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface Invitation {
  id: string;
  companyId: string;
  email: string;
  displayName?: string;
  role: Exclude<AppRole, 'super_admin' | 'pending_owner'>;
  inviteCode: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export const LEAD_SOURCES = [
  '99acres',
  'MagicBricks',
  'Housing.com',
  'Facebook/Instagram',
  'Website',
  'Walk-in',
  'Referral',
  'WhatsApp',
  'Cold Call',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STAGES = [
  'New',
  'Contacted',
  'Interested',
  'Site Visit Scheduled',
  'Site Visit Done',
  'Negotiation',
  'Booked',
  'Lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface Lead {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email?: string;
  source: LeadSource;
  stage: LeadStage;
  score: number;
  budgetMinInr?: number;
  budgetMaxInr?: number;
  preferredLocation?: string;
  preferredBhk?: string;
  propertyInterestId?: string;
  assignedTo: string;
  assignedToName?: string;
  notes?: string;
  lastContactedAt?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export type PropertyType = 'residential' | 'commercial' | 'plot' | 'villa' | 'farmhouse';
export type TransactionType = 'sale' | 'rent' | 'lease';
export type PropertyStatus = 'available' | 'hold' | 'booked' | 'sold';

export interface Property {
  id: string;
  companyId: string;
  projectId?: string;
  title: string;
  propertyType: PropertyType;
  transactionType: TransactionType;
  priceInr: number;
  areaSqFt: number;
  bhk?: string;
  reraId?: string;
  city?: string;
  state?: string;
  locality?: string;
  pinCode?: string;
  floor?: string;
  facing?: string;
  status: PropertyStatus;
  amenities?: string[];
  imageUrls?: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface ProjectTower {
  name: string;
  floors: number;
  unitsPerFloor: number;
  availableUnits: number;
  bookedUnits: number;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  developerName?: string;
  reraId: string;
  city: string;
  state: string;
  locality?: string;
  possessionDate?: string;
  totalUnits: number;
  towers?: ProjectTower[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export type CustomerType = 'buyer' | 'seller' | 'tenant' | 'investor';
export type KycStatus = 'pending' | 'verified' | 'rejected';

export interface Customer {
  id: string;
  companyId: string;
  fullName: string;
  customerType: CustomerType;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  maskedAadhaar?: string;
  panNumber?: string;
  kycStatus: KycStatus;
  kycDocUrls?: string[];
  linkedLeadId?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export type SiteVisitStatus = 'scheduled' | 'completed' | 'no_show' | 'rescheduled';

export interface SiteVisit {
  id: string;
  companyId: string;
  leadId: string;
  leadName?: string;
  propertyId: string;
  propertyTitle?: string;
  agentUid: string;
  agentName?: string;
  scheduledAt: string;
  status: SiteVisitStatus;
  feedback?: string;
  rating?: number;
  mapsUrl?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export const DEAL_STAGES = [
  'Token',
  'Booking',
  'Agreement',
  'Registration',
  'Closed Won',
  'Cancelled',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface PaymentMilestone {
  label: string;
  amountInr: number;
  dueDate: string;
  paid: boolean;
}

export interface Deal {
  id: string;
  companyId: string;
  title: string;
  leadId?: string;
  customerId?: string;
  customerName?: string;
  propertyId: string;
  propertyTitle?: string;
  agentUid: string;
  agentName?: string;
  stage: DealStage;
  dealValueInr: number;
  tokenAmountInr?: number;
  bookingAmountInr?: number;
  state?: string;
  stampDutyInr?: number;
  registrationFeeInr?: number;
  agreementDate?: string;
  registrationNumber?: string;
  paymentMilestones?: PaymentMilestone[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export type CommissionStatus = 'pending' | 'approved' | 'paid';

export interface Commission {
  id: string;
  companyId: string;
  dealId: string;
  dealTitle?: string;
  agentUid: string;
  agentName?: string;
  ruleType: 'percentage' | 'fixed';
  ratePercent?: number;
  grossAmountInr: number;
  tdsPercent?: number;
  tdsAmountInr?: number;
  netPayableInr: number;
  splitPercent?: number;
  status: CommissionStatus;
  paidAt?: string;
  payoutReference?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface TaskItem {
  id: string;
  companyId: string;
  title: string;
  type: 'task' | 'follow_up' | 'call' | 'payment_reminder';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  dueAt: string;
  assignedTo: string;
  assignedToName?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  entityType: 'lead' | 'deal' | 'customer' | 'property';
  entityId: string;
  action: string;
  summary: string;
  actorName?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  title: string;
  category: 'agreement_template' | 'receipt' | 'rera_certificate' | 'kyc' | 'floor_plan';
  fileName: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface AppNotification {
  id: string;
  companyId: string;
  recipientUid: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface CompanySettings {
  id: string;
  companyId: string;
  pipelineStages?: string[];
  leadSources?: string[];
  whatsappTemplates?: { name: string; body: string }[];
  autoAssignRoundRobin?: boolean;
  dailyDigestEnabled?: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface AuditLog {
  id: string;
  companyId?: string;
  actorUid: string;
  actorEmail?: string;
  eventType:
    | 'sign_in'
    | 'role_change'
    | 'soft_delete'
    | 'export'
    | 'impersonation'
    | 'company_approval'
    | 'dpdp_request'
    | 'invite';
  targetPath?: string;
  details: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
}

export interface SubscriptionPlan {
  planId: PlanId;
  name: string;
  priceMonthlyInr: number;
  priceAnnualInr: number;
  userLimit: number;
  propertyLimit: number;
  features: string[];
}
