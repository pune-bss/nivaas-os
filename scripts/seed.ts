/**
 * Standalone Firebase Admin Seed Script
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json npx tsx scripts/seed.ts
 *
 * Note: For AI Studio Starter Tier projects without IAM service accounts,
 * sign in as Super Admin in the web app and click "Seed Demo Ecosystem" on the Super Admin dashboard.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json';

initializeApp({ projectId: config.projectId });
const db = config.firestoreDatabaseId
  ? getFirestore(config.firestoreDatabaseId)
  : getFirestore();

async function seed() {
  console.log(`Seeding NivaasOS data into project ${config.projectId}...`);

  const plans = [
    {
      planId: 'free',
      name: 'Free Sandbox',
      priceMonthlyInr: 0,
      priceAnnualInr: 0,
      userLimit: 5,
      propertyLimit: 25,
      features: ['Up to 5 team members', '25 active properties', 'Lead Kanban & WhatsApp templates'],
    },
    {
      planId: 'starter',
      name: 'Starter Agency',
      priceMonthlyInr: 2499,
      priceAnnualInr: 23990,
      userLimit: 15,
      propertyLimit: 150,
      features: ['15 team members', '150 properties & 3 projects', 'Site visits calendar & CSV import'],
    },
    {
      planId: 'pro',
      name: 'Pro Developer',
      priceMonthlyInr: 6999,
      priceAnnualInr: 67190,
      userLimit: 50,
      propertyLimit: 1000,
      features: ['50 team members', '1,000 properties & tower grids', 'Commissions, TDS & Stamp Duty engine'],
    },
    {
      planId: 'enterprise',
      name: 'Enterprise Realty',
      priceMonthlyInr: 18999,
      priceAnnualInr: 182390,
      userLimit: 500,
      propertyLimit: 25000,
      features: ['500+ users', 'Unlimited projects', 'Dedicated audit logs, 2FA & DPDP exports'],
    },
  ];

  for (const plan of plans) {
    await db.doc(`platform/subscriptionPlans/items/${plan.planId}`).set({
      ...plan,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const companies = [
    {
      companyId: 'sahyadri_realty',
      name: 'Sahyadri Realty Pvt Ltd',
      businessType: 'builder',
      ownerUid: 'demo_owner_sahyadri',
      ownerEmail: 'admin@sahyadrirealty.in',
      phone: '+919820112233',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400051',
      gstNumber: '27AABCS1429B1ZS',
      reraNumber: 'P51900048210',
      status: 'active',
      planId: 'pro',
      userLimit: 50,
      propertyLimit: 1000,
    },
    {
      companyId: 'deccan_skyline',
      name: 'Deccan Skyline Advisory',
      businessType: 'broker',
      ownerUid: 'demo_owner_deccan',
      ownerEmail: 'founder@deccanskyline.in',
      phone: '+919845077889',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      gstNumber: '29AABCD8812K1Z4',
      reraNumber: 'PRM/KA/RERA/1251/446/AG/240112',
      status: 'active',
      planId: 'starter',
      userLimit: 15,
      propertyLimit: 150,
    },
  ];

  for (const c of companies) {
    await db.doc(`companies/${c.companyId}`).set({
      ...c,
      createdBy: 'seed_script',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });
  }

  console.log('Seed completed.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
