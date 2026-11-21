import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './config';

export const DEFAULT_PLANS = [
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
] as const;

export async function seedDemoEcosystem(): Promise<{ companiesCreated: number; recordsCreated: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Must be signed in as Super Admin to seed demo ecosystem.');

  let recordsCreated = 0;

  // 1. Subscription Plans
  for (const plan of DEFAULT_PLANS) {
    await setDoc(doc(db, 'platform/subscriptionPlans/items', plan.planId), {
      ...plan,
      updatedAt: serverTimestamp(),
    });
    recordsCreated++;
  }

  // 2. Two Demo Indian Real Estate Companies
  const demoCompanies = [
    {
      companyId: 'sahyadri_realty',
      name: 'Sahyadri Realty Pvt Ltd',
      businessType: 'builder',
      ownerUid: uid,
      ownerEmail: auth.currentUser?.email || 'admin@sahyadrirealty.in',
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

  for (const company of demoCompanies) {
    await setDoc(doc(db, 'companies', company.companyId), {
      ...company,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 3. Seed Sahyadri Realty Team Users (demo roster)
  const demoTeam = [
    {
      uid: 'agent_rohan_deshmukh',
      displayName: 'Rohan Deshmukh',
      email: 'rohan@sahyadrirealty.in',
      phone: '+919820445566',
      role: 'sales_manager',
      companyId: 'sahyadri_realty',
      status: 'active',
      monthlyTargetInr: 50000000,
    },
    {
      uid: 'agent_priya_kulkarni',
      displayName: 'Priya Kulkarni',
      email: 'priya@sahyadrirealty.in',
      phone: '+919820778899',
      role: 'sales_executive',
      companyId: 'sahyadri_realty',
      status: 'active',
      monthlyTargetInr: 25000000,
    },
    {
      uid: 'agent_vikram_nair',
      displayName: 'Vikram Nair',
      email: 'vikram@sahyadrirealty.in',
      phone: '+919819334455',
      role: 'sales_executive',
      companyId: 'sahyadri_realty',
      status: 'active',
      monthlyTargetInr: 25000000,
    },
    {
      uid: 'finance_sneha_joshi',
      displayName: 'Sneha Joshi',
      email: 'accounts@sahyadrirealty.in',
      phone: '+919820990011',
      role: 'accountant',
      companyId: 'sahyadri_realty',
      status: 'active',
      monthlyTargetInr: 0,
    },
  ];

  for (const member of demoTeam) {
    await setDoc(doc(db, 'users', member.uid), {
      ...member,
      preferredLanguage: 'en',
      totpEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 4. Projects (Builder Towers)
  const projects = [
    {
      id: 'proj_sahyadri_zenith',
      companyId: 'sahyadri_realty',
      name: 'The Zenith at Bandra Kurla',
      developerName: 'Sahyadri Realty Pvt Ltd',
      reraId: 'P51900048210',
      city: 'Mumbai',
      state: 'Maharashtra',
      locality: 'BKC Annexe, Bandra East',
      possessionDate: 'Dec 2027',
      totalUnits: 168,
      towers: [
        { name: 'Tower A (Emerald)', floors: 28, unitsPerFloor: 3, availableUnits: 34, bookedUnits: 50 },
        { name: 'Tower B (Sapphire)', floors: 28, unitsPerFloor: 3, availableUnits: 42, bookedUnits: 42 },
      ],
    },
    {
      id: 'proj_lakefront_villas',
      companyId: 'sahyadri_realty',
      name: 'Sahyadri Lakefront Villas',
      developerName: 'Sahyadri Realty Pvt Ltd',
      reraId: 'P52100051109',
      city: 'Pune',
      state: 'Maharashtra',
      locality: 'Bavdhan Hills',
      possessionDate: 'Jun 2026',
      totalUnits: 48,
      towers: [{ name: 'Phase 1 Enclave', floors: 2, unitsPerFloor: 24, availableUnits: 14, bookedUnits: 34 }],
    },
    {
      id: 'proj_deccan_nexus',
      companyId: 'deccan_skyline',
      name: 'Nexus Business Park',
      developerName: 'Deccan Skyline Advisory',
      reraId: 'PRM/KA/RERA/1251/446/PR/240201',
      city: 'Bengaluru',
      state: 'Karnataka',
      locality: 'Outer Ring Road, Bellandur',
      possessionDate: 'Ready to Move',
      totalUnits: 64,
      towers: [{ name: 'Commercial Block 1', floors: 16, unitsPerFloor: 4, availableUnits: 22, bookedUnits: 42 }],
    },
  ];

  for (const p of projects) {
    const { id, ...rest } = p;
    await setDoc(doc(db, `companies/${p.companyId}/projects`, id), {
      ...rest,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 5. Properties
  const properties = [
    {
      id: 'prop_zenith_1402',
      companyId: 'sahyadri_realty',
      projectId: 'proj_sahyadri_zenith',
      title: '3 BHK Sky Deck Residence - Unit 1402',
      propertyType: 'residential',
      transactionType: 'sale',
      priceInr: 42500000,
      areaSqFt: 1680,
      bhk: '3 BHK',
      reraId: 'P51900048210',
      city: 'Mumbai',
      state: 'Maharashtra',
      locality: 'Bandra East',
      pinCode: '400051',
      floor: '14th Floor',
      facing: 'East',
      status: 'available',
      amenities: ['Infinity Pool', 'Clubhouse', 'EV Charging', '2 Covered Parking', 'Vastu Compliant'],
      imageUrls: ['/src/assets/images/property_luxury_apartment_1795006021918.jpg'],
    },
    {
      id: 'prop_villa_12',
      companyId: 'sahyadri_realty',
      projectId: 'proj_lakefront_villas',
      title: '4 BHK Corner Stone Villa #12',
      propertyType: 'villa',
      transactionType: 'sale',
      priceInr: 34500000,
      areaSqFt: 3200,
      bhk: '4 BHK',
      reraId: 'P52100051109',
      city: 'Pune',
      state: 'Maharashtra',
      locality: 'Bavdhan Hills',
      pinCode: '411021',
      floor: 'G+1',
      facing: 'North-East',
      status: 'hold',
      amenities: ['Private Lawn', 'Plunge Pool', 'Solar Roof', '24x7 Security'],
      imageUrls: ['/src/assets/images/property_villa_enclave_1795006022169.jpg'],
    },
    {
      id: 'prop_zenith_901',
      companyId: 'sahyadri_realty',
      projectId: 'proj_sahyadri_zenith',
      title: '2 BHK Smart Suite - Unit 901',
      propertyType: 'residential',
      transactionType: 'sale',
      priceInr: 26500000,
      areaSqFt: 1080,
      bhk: '2 BHK',
      reraId: 'P51900048210',
      city: 'Mumbai',
      state: 'Maharashtra',
      locality: 'Bandra East',
      pinCode: '400051',
      floor: '9th Floor',
      facing: 'North',
      status: 'booked',
      amenities: ['Gymnasium', 'Sky Lounge', '1 Covered Parking'],
      imageUrls: ['/src/assets/images/property_luxury_apartment_1795006021918.jpg'],
    },
    {
      id: 'prop_nexus_804',
      companyId: 'deccan_skyline',
      projectId: 'proj_deccan_nexus',
      title: 'Grade-A IT Office Floorplate - Suite 804',
      propertyType: 'commercial',
      transactionType: 'lease',
      priceInr: 580000,
      areaSqFt: 4800,
      bhk: 'Bare Shell',
      reraId: 'PRM/KA/RERA/1251/446/PR/240201',
      city: 'Bengaluru',
      state: 'Karnataka',
      locality: 'Bellandur ORR',
      pinCode: '560103',
      floor: '8th Floor',
      facing: 'East',
      status: 'available',
      amenities: ['100% DG Backup', 'LEED Gold', 'Metro Shuttle', 'Cafeteria'],
      imageUrls: ['/src/assets/images/property_commercial_tower_1795006022694.jpg'],
    },
  ];

  for (const prop of properties) {
    const { id, ...rest } = prop;
    await setDoc(doc(db, `companies/${prop.companyId}/properties`, id), {
      ...rest,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 6. Leads across Kanban pipeline
  const leads = [
    {
      id: 'lead_101',
      companyId: 'sahyadri_realty',
      fullName: 'Siddharth Malhotra',
      phone: '+919820312345',
      email: 'siddharth.m@outlook.com',
      source: '99acres',
      stage: 'New',
      score: 78,
      budgetMinInr: 35000000,
      budgetMaxInr: 45000000,
      preferredLocation: 'Bandra East / BKC',
      preferredBhk: '3 BHK',
      propertyInterestId: 'prop_zenith_1402',
      assignedTo: 'agent_priya_kulkarni',
      assignedToName: 'Priya Kulkarni',
      notes: 'Looking for East-facing higher floor unit with 2 car parks.',
    },
    {
      id: 'lead_102',
      companyId: 'sahyadri_realty',
      fullName: 'Ananya Deshpande',
      phone: '+919823456789',
      email: 'ananya.d@gmail.com',
      source: 'MagicBricks',
      stage: 'Site Visit Scheduled',
      score: 88,
      budgetMinInr: 30000000,
      budgetMaxInr: 38000000,
      preferredLocation: 'Bavdhan, Pune',
      preferredBhk: '4 BHK Villa',
      propertyInterestId: 'prop_villa_12',
      assignedTo: 'agent_vikram_nair',
      assignedToName: 'Vikram Nair',
      notes: 'Family visit confirmed for Saturday 11 AM.',
    },
    {
      id: 'lead_103',
      companyId: 'sahyadri_realty',
      fullName: 'Rajeshwar Rao',
      phone: '+919819001122',
      email: 'r.rao@corpindia.in',
      source: 'Referral',
      stage: 'Negotiation',
      score: 94,
      budgetMinInr: 25000000,
      budgetMaxInr: 28000000,
      preferredLocation: 'BKC Annexe',
      preferredBhk: '2 BHK',
      propertyInterestId: 'prop_zenith_901',
      assignedTo: 'agent_rohan_deshmukh',
      assignedToName: 'Rohan Deshmukh',
      notes: 'Requested flexi payment schedule 30:40:30.',
    },
    {
      id: 'lead_104',
      companyId: 'sahyadri_realty',
      fullName: 'Meera Kapoor',
      phone: '+919821556677',
      email: 'meera.kapoor@yahoo.co.in',
      source: 'Facebook/Instagram',
      stage: 'Interested',
      score: 71,
      budgetMinInr: 24000000,
      budgetMaxInr: 32000000,
      preferredLocation: 'Bandra East',
      preferredBhk: '2 BHK',
      propertyInterestId: 'prop_zenith_901',
      assignedTo: 'agent_priya_kulkarni',
      assignedToName: 'Priya Kulkarni',
      notes: 'Downloaded floor plan brochure via Instagram ad.',
    },
    {
      id: 'lead_105',
      companyId: 'sahyadri_realty',
      fullName: 'Karanveer Singh',
      phone: '+919833221144',
      email: 'karan.singh@techventures.in',
      source: 'Housing.com',
      stage: 'Booked',
      score: 98,
      budgetMinInr: 40000000,
      budgetMaxInr: 45000000,
      preferredLocation: 'Bandra East',
      preferredBhk: '3 BHK',
      propertyInterestId: 'prop_zenith_1402',
      assignedTo: 'agent_rohan_deshmukh',
      assignedToName: 'Rohan Deshmukh',
      notes: 'Token cheque cleared. Proceeding to allotment.',
    },
    {
      id: 'lead_201',
      companyId: 'deccan_skyline',
      fullName: 'Prashant Hegde (FinStack Labs)',
      phone: '+919845112200',
      email: 'ops@finstack.in',
      source: 'Website',
      stage: 'Contacted',
      score: 84,
      budgetMinInr: 500000,
      budgetMaxInr: 700000,
      preferredLocation: 'Bellandur ORR',
      preferredBhk: 'Office 5000 sq ft',
      propertyInterestId: 'prop_nexus_804',
      assignedTo: uid,
      assignedToName: 'Founder Admin',
      notes: 'Needs 65 workstations fit-out option.',
    },
  ];

  for (const l of leads) {
    const { id, ...rest } = l;
    await setDoc(doc(db, `companies/${l.companyId}/leads`, id), {
      ...rest,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 7. Customers (with masked Aadhaar)
  const customers = [
    {
      id: 'cust_karanveer',
      companyId: 'sahyadri_realty',
      fullName: 'Karanveer Singh',
      customerType: 'buyer',
      phone: '+919833221144',
      email: 'karan.singh@techventures.in',
      city: 'Mumbai',
      state: 'Maharashtra',
      maskedAadhaar: 'XXXX-XXXX-4821',
      panNumber: 'ABCPS4921K',
      kycStatus: 'verified',
      linkedLeadId: 'lead_105',
    },
    {
      id: 'cust_rajeshwar',
      companyId: 'sahyadri_realty',
      fullName: 'Rajeshwar Rao',
      customerType: 'investor',
      phone: '+919819001122',
      email: 'r.rao@corpindia.in',
      city: 'Hyderabad',
      state: 'Telangana',
      maskedAadhaar: 'XXXX-XXXX-7734',
      panNumber: 'AAEPR8810M',
      kycStatus: 'pending',
      linkedLeadId: 'lead_103',
    },
  ];

  for (const c of customers) {
    const { id, ...rest } = c;
    await setDoc(doc(db, `companies/${c.companyId}/customers`, id), {
      ...rest,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 8. Site Visits
  const todayIso = new Date().toISOString().slice(0, 10);
  const visits = [
    {
      id: 'visit_101',
      companyId: 'sahyadri_realty',
      leadId: 'lead_102',
      leadName: 'Ananya Deshpande',
      propertyId: 'prop_villa_12',
      propertyTitle: '4 BHK Corner Stone Villa #12',
      agentUid: 'agent_vikram_nair',
      agentName: 'Vikram Nair',
      scheduledAt: `${todayIso}T11:30:00`,
      status: 'scheduled',
      mapsUrl: 'https://maps.google.com/?q=Bavdhan+Pune+Maharashtra',
    },
    {
      id: 'visit_102',
      companyId: 'sahyadri_realty',
      leadId: 'lead_101',
      leadName: 'Siddharth Malhotra',
      propertyId: 'prop_zenith_1402',
      propertyTitle: '3 BHK Sky Deck Residence - Unit 1402',
      agentUid: 'agent_priya_kulkarni',
      agentName: 'Priya Kulkarni',
      scheduledAt: `${todayIso}T16:00:00`,
      status: 'scheduled',
      mapsUrl: 'https://maps.google.com/?q=Bandra+Kurla+Complex+Mumbai',
    },
  ];

  for (const v of visits) {
    const { id, ...rest } = v;
    await setDoc(doc(db, `companies/${v.companyId}/siteVisits`, id), {
      ...rest,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    recordsCreated++;
  }

  // 9. Deals & Commissions
  await setDoc(doc(db, 'companies/sahyadri_realty/deals', 'deal_zenith_901'), {
    companyId: 'sahyadri_realty',
    title: 'Unit 901 Booking — Karanveer Singh',
    leadId: 'lead_105',
    customerId: 'cust_karanveer',
    customerName: 'Karanveer Singh',
    propertyId: 'prop_zenith_901',
    propertyTitle: '2 BHK Smart Suite - Unit 901',
    agentUid: 'agent_rohan_deshmukh',
    agentName: 'Rohan Deshmukh',
    stage: 'Closed Won',
    dealValueInr: 26500000,
    tokenAmountInr: 500000,
    bookingAmountInr: 2650000,
    state: 'Maharashtra',
    stampDutyInr: 1590000,
    registrationFeeInr: 30000,
    agreementDate: todayIso,
    registrationNumber: 'MUM/BDR/2026/88412',
    paymentMilestones: [
      { label: 'Token Advance', amountInr: 500000, dueDate: todayIso, paid: true },
      { label: '10% Booking Allotment', amountInr: 2150000, dueDate: todayIso, paid: true },
      { label: 'Plinth & Slab Milestone', amountInr: 5300000, dueDate: '2027-01-15', paid: false },
    ],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  });
  recordsCreated++;

  await setDoc(doc(db, 'companies/sahyadri_realty/commissions', 'comm_zenith_901'), {
    companyId: 'sahyadri_realty',
    dealId: 'deal_zenith_901',
    dealTitle: 'Unit 901 Booking — Karanveer Singh',
    agentUid: 'agent_rohan_deshmukh',
    agentName: 'Rohan Deshmukh',
    ruleType: 'percentage',
    ratePercent: 2,
    grossAmountInr: 530000,
    tdsPercent: 5,
    tdsAmountInr: 26500,
    netPayableInr: 503500,
    splitPercent: 100,
    status: 'approved',
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  });
  recordsCreated++;

  // 10. Tasks / Follow-ups
  await setDoc(doc(db, 'companies/sahyadri_realty/tasks', 'task_followup_1'), {
    companyId: 'sahyadri_realty',
    title: 'Send revised 30:40:30 payment sheet to Rajeshwar Rao',
    type: 'follow_up',
    priority: 'high',
    status: 'pending',
    dueAt: `${todayIso}T17:30:00`,
    assignedTo: uid,
    assignedToName: auth.currentUser?.displayName || 'Admin',
    linkedEntityType: 'lead',
    linkedEntityId: 'lead_103',
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  });
  recordsCreated++;

  // 11. Settings for Sahyadri Realty
  await setDoc(doc(db, 'companies/sahyadri_realty/settings', 'default'), {
    companyId: 'sahyadri_realty',
    autoAssignRoundRobin: true,
    dailyDigestEnabled: true,
    pipelineStages: ['New', 'Contacted', 'Interested', 'Site Visit Scheduled', 'Site Visit Done', 'Negotiation', 'Booked', 'Lost'],
    leadSources: ['99acres', 'MagicBricks', 'Housing.com', 'Facebook/Instagram', 'Website', 'Walk-in', 'Referral', 'WhatsApp', 'Cold Call'],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  });
  recordsCreated++;

  return { companiesCreated: demoCompanies.length, recordsCreated };
}
