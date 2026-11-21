export const INDIAN_STATES = [
  { name: 'Maharashtra', stampDutyMalePct: 6, stampDutyFemalePct: 5, regFeePct: 1, regCapInr: 30000 },
  { name: 'Karnataka', stampDutyMalePct: 5, stampDutyFemalePct: 5, regFeePct: 1, regCapInr: 0 },
  { name: 'Delhi', stampDutyMalePct: 6, stampDutyFemalePct: 4, regFeePct: 1, regCapInr: 0 },
  { name: 'Haryana', stampDutyMalePct: 7, stampDutyFemalePct: 5, regFeePct: 0, regCapInr: 50000 },
  { name: 'Uttar Pradesh', stampDutyMalePct: 7, stampDutyFemalePct: 6, regFeePct: 1, regCapInr: 0 },
  { name: 'Telangana', stampDutyMalePct: 5.5, stampDutyFemalePct: 5.5, regFeePct: 0.5, regCapInr: 0 },
  { name: 'Tamil Nadu', stampDutyMalePct: 7, stampDutyFemalePct: 7, regFeePct: 4, regCapInr: 0 },
  { name: 'Gujarat', stampDutyMalePct: 4.9, stampDutyFemalePct: 4.9, regFeePct: 1, regCapInr: 0 },
  { name: 'West Bengal', stampDutyMalePct: 6, stampDutyFemalePct: 6, regFeePct: 1, regCapInr: 0 },
  { name: 'Rajasthan', stampDutyMalePct: 6, stampDutyFemalePct: 5, regFeePct: 1, regCapInr: 0 },
  { name: 'Goa', stampDutyMalePct: 4.5, stampDutyFemalePct: 4.5, regFeePct: 3.5, regCapInr: 0 },
  { name: 'Kerala', stampDutyMalePct: 8, stampDutyFemalePct: 8, regFeePct: 2, regCapInr: 0 },
] as const;

export function formatINR(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatINRCompact(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return formatINR(num);
}

export function sqFtToSqM(sqFt: number): number {
  return Number((sqFt * 0.092903).toFixed(2));
}

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (raw.startsWith('+91') && /^\+91[6-9]\d{9}$/.test(raw.trim())) {
    return raw.trim();
  }
  return raw.trim();
}

export function isValidIndianPhone(raw: string): boolean {
  const normalized = normalizeIndianPhone(raw);
  return /^\+91[6-9]\d{9}$/.test(normalized);
}

export function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '';
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function estimateStampDutyAndReg(
  dealValueInr: number,
  stateName: string,
  buyerGender: 'male' | 'female' = 'male'
): { stampDutyInr: number; registrationFeeInr: number; totalChargesInr: number } {
  const state = INDIAN_STATES.find((s) => s.name === stateName) || INDIAN_STATES[0];
  const stampPct = buyerGender === 'female' ? state.stampDutyFemalePct : state.stampDutyMalePct;
  const stampDutyInr = Math.round((dealValueInr * stampPct) / 100);
  let registrationFeeInr = Math.round((dealValueInr * state.regFeePct) / 100);
  if (state.regCapInr > 0) {
    registrationFeeInr = Math.min(registrationFeeInr || state.regCapInr, state.regCapInr);
  }
  return {
    stampDutyInr,
    registrationFeeInr,
    totalChargesInr: stampDutyInr + registrationFeeInr,
  };
}

export const WHATSAPP_TEMPLATES = [
  {
    name: 'Intro & Brochure',
    body: 'Namaste {{name}}, thank you for your interest in {{location}}. Sharing project floor plans, RERA details & pricing sheet. When is a good time for a quick call?',
  },
  {
    name: 'Site Visit Confirmation',
    body: 'Namaste {{name}}, your site visit is scheduled! Our advisor will meet you at the Experience Centre. Please reply if you need cab pickup or Google Maps pin.',
  },
  {
    name: 'Booking & Token Follow-up',
    body: 'Namaste {{name}}, great meeting you! Sharing the unit cost sheet with stamp duty & GST breakdown so you can lock the preferred floor before price revision.',
  },
];

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = normalizeIndianPhone(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function evaluatePasswordStrength(password: string): { score: number; label: string; checks: { ok: boolean; text: string }[] } {
  const checks = [
    { ok: password.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password), text: 'Uppercase letter' },
    { ok: /[a-z]/.test(password), text: 'Lowercase letter' },
    { ok: /\d/.test(password), text: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(password), text: 'Special character' },
  ];
  const score = checks.filter((c) => c.ok).length;
  const label = score <= 2 ? 'Weak' : score <= 4 ? 'Good' : 'Strong';
  return { score, label, checks };
}
