# NivaasOS — Firebase & Production Setup Guide

## 1. Firebase Project & Database
This workspace is pre-configured in `firebase-applet-config.json` with:
- **Project ID**: `virtual-outrider-86pck`
- **Firestore Database ID**: `ai-studio-d4bd18c9-3143-40d5-9ba0-f177ed93d138`

## 2. Enable Authentication Providers
In the [Firebase Console](https://console.firebase.google.com/project/virtual-outrider-86pck/authentication/providers):
1. **Google Sign-In**: Enabled automatically for the AI Studio preview domain.
2. **Email/Password**: Navigate to **Authentication -> Sign-in method -> Email/Password** and toggle **Enable**.
3. **Phone (+91 OTP)**: Navigate to **Authentication -> Sign-in method -> Phone** and toggle **Enable**. Add your test phone numbers or configure production SMS quotas.
4. **Authorized Domains**: Ensure both `localhost` and your Cloud Run / Firebase Hosting domains are listed under **Authentication -> Settings -> Authorized domains**.

## 3. Enable Firebase App Check (reCAPTCHA Enterprise)
1. Go to **App Check** in the Firebase Console and register your Web App using **reCAPTCHA Enterprise**.
2. Copy the reCAPTCHA site key into `VITE_RECAPTCHA_SITE_KEY` (see `.env.example`) or `firebase-applet-config.json`.

## 4. Deploy Firestore & Storage Rules and Indexes
If deploying from your local terminal with Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase use virtual-outrider-86pck
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 5. Deploy Cloud Functions (Requires Blaze Plan)
1. Upgrade the Firebase project to the **Blaze (Pay-as-you-go)** plan if using server-side Cloud Functions (`approveCompany`, `inviteEmployee`, `setUserRole`, `onDealClosedCalculateCommission`, `dailyFollowUpDigest`).
2. Install and deploy functions:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## 6. Build & Deploy Hosting
```bash
npm run build
firebase deploy --only hosting
```

## 7. Seeding Demo Data
- **In-App (Zero-CLI)**: Sign in as the Super Admin (`shinde.amruta1@gmail.com`) and click **Seed Demo Ecosystem** in the Super Admin dashboard to create subscription plans, 2 Indian real estate companies (*Sahyadri Realty Pvt Ltd* & *Deccan Skyline Advisory*), projects, properties, leads, customers, site visits, deals, commissions, and tasks.
- **CLI (User-owned Blaze project)**: Run `npx tsx scripts/seed.ts` with `GOOGLE_APPLICATION_CREDENTIALS` configured.
