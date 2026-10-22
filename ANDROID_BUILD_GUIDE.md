# ZapBasket · Mobile & Android Play Store Publishing Guide

ZapBasket is fully optimized for mobile devices and ready to deploy as a native Android App on the Google Play Store or install directly as a high-performance Progressive Web App (PWA).

---

## Table of Contents
1. [Push to Your GitHub Repository](#1-push-to-your-github-repository)
2. [Project Architecture for Mobile](#2-project-architecture-for-mobile)
3. [Building for Android with Capacitor (Native App)](#3-building-for-android-with-capacitor-native-app)
4. [Generating a Signed Release AAB / APK for Google Play](#4-generating-a-signed-release-aab--apk-for-google-play)
5. [Publishing to the Google Play Console](#5-publishing-to-the-google-play-console)
6. [Alternative: Trusted Web Activity (TWA) via Bubblewrap](#6-alternative-trusted-web-activity-twa-via-bubblewrap)
7. [Progressive Web App (PWA) Direct Installation](#7-progressive-web-app-pwa-direct-installation)
8. [Android Permissions Reference](#8-android-permissions-reference)

---

## 1. Push to Your GitHub Repository

Your project is already initialized as a local Git repository with a complete `main` branch and secure `.gitignore` (safeguarding all secrets, build caches, and node_modules).

### Quick Push via Helper Script:
Create a new empty repository on your GitHub account (e.g. `zapbasket-mobile`), then run:
```bash
npm run git:push https://github.com/Prasantsing/zapbasket-mobile.git
```
*(Or use SSH: `npm run git:push git@github.com:Prasantsing/zapbasket-mobile.git`)*

### Or Standard Git Commands:
```bash
git remote add origin https://github.com/Prasantsing/zapbasket-mobile.git
git branch -M main
git push -u origin main
```

---

## 2. Project Architecture for Mobile

- **`frontend/`**: Angular 19 client application with responsive bottom navigation bar, safe-area viewport insets (`viewport-fit=cover`), touch-friendly targets, and live shopping cart badge.
- **`frontend/public/manifest.webmanifest`**: Complete PWA manifest containing high-resolution icons (192px, 512px, 512px maskable with safe-margins), shortcuts for quick orders, and standalone display mode.
- **`frontend/public/sw.js`**: Background service worker providing fast asset precaching and network-first offline resilience.
- **`capacitor.config.json`**: Capacitor bridge configuration targeting `com.zapbasket.app` and routing built assets into the native Android Gradle project.
- **`android/`**: Full Android Studio project with preconfigured Gradle wrapper, `AndroidManifest.xml` permissions, and launcher mipmaps.
- **`twa-manifest.json`**: Trusted Web Activity manifest ready for Google's official Bubblewrap CLI.

---

## 3. Building for Android with Capacitor (Native App)

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Android Studio Iguana / Jellyfish / Ladybug or newer](https://developer.android.com/studio)
- Android SDK Platform 34 or 35 + Android SDK Build-Tools

### Step 1: Install Dependencies & Build Frontend
```bash
npm install
npm run cap:sync
```
This builds the Angular production bundle and synchronizes it into `android/app/src/main/assets/public`.

### Step 2: Open in Android Studio
```bash
npm run cap:open
# Or open Android Studio manually and select the "android/" folder
```

### Step 3: Run on an Android Emulator or Physical Device
1. Connect your Android phone via USB and enable **USB Debugging** (in Developer Options).
2. In Android Studio, select your device from the dropdown menu and click **Run (Green Play Icon)** (or `Shift + F10`).
3. ZapBasket will install and launch with full hardware camera access and native performance!

---

## 4. Generating a Signed Release AAB / APK for Google Play

Google Play requires an **Android App Bundle (.aab)** signed with a release keystore.

### Step 1: Generate an Upload Keystore (One-Time)
Run this command in your terminal (keep this file safe and never commit it to public git!):
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias zapbasket-key
```

### Step 2: Generate the Signed Bundle via Android Studio
1. Open the project in **Android Studio**.
2. Go to **Build** > **Generate Signed Bundle / APK...**
3. Select **Android App Bundle** and click **Next**.
4. Choose your `my-release-key.jks` file, enter your password and key alias.
5. Select destination folder and build variant **release**.
6. Check **V1 and V2 (Full APK Signature)** and click **Finish**.
7. Your production bundle will be created at:
   `android/app/release/app-release.aab`

---

## 5. Publishing to the Google Play Console

1. **Create Developer Account**: Sign in to [Google Play Console](https://play.google.com/console).
2. **Create New App**:
   - App Name: `ZapBasket · 12-Minute Grocery Delivery`
   - Default language: `English (United States)`
   - App or Game: `App`
   - Free or Paid: `Free`
3. **App Content & Declarations**:
   - **Privacy Policy**: Link to your privacy policy (e.g., `https://yourdomain.com/privacy`).
   - **App Access**: Provide demo credentials (Customer: `customer@zapbasket.com` / `pass123`).
   - **Target Audience**: 18+ (Grocery & Quick Commerce).
   - **Data Safety**: Declare that email and delivery addresses are collected for order fulfillment and encrypted in transit.
4. **Store Listing Assets**:
   - App Icon: 512 x 512 PNG (`frontend/public/icon-512.png`).
   - Feature Graphic: 1024 x 500 PNG.
   - Screenshots: At least 2 phone screenshots (e.g. Home Store, Product View, Checkout).
5. **Release Track**:
   - Go to **Production** (or **Closed Testing**) > **Create New Release**.
   - Upload `app-release.aab`.
   - Add release notes (e.g., `Initial release of ZapBasket grocery delivery app`).
   - Click **Save** and **Review Release**, then **Start rollout to Production**!

---

## 6. Alternative: Trusted Web Activity (TWA) via Bubblewrap

If you prefer Google's lightweight Trusted Web Activity (TWA) without maintaining Android Java code:

1. Install Google's Bubblewrap CLI:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. Build your TWA using the included `twa-manifest.json`:
   ```bash
   bubblewrap build
   ```
3. Bubblewrap will download Android build tools and output a verified `.aab` ready for the Play Store.

---

## 7. Progressive Web App (PWA) Direct Installation

ZapBasket works as a full-featured PWA out of the box:
- **Android / Chrome**: Visitors see an in-app **"Install App"** button at the top header or browser install prompt. Once added, it runs in standalone full-screen mode without browser UI.
- **iPhone / Safari**: Tap the **Share** button in Safari and select **"Add to Home Screen"**. The in-app modal guides iOS users step-by-step.
- **Offline Resilience**: The included `sw.js` precaches shell assets and provides graceful offline fallback.

---

## 8. Android Permissions Reference

Configured in `android/app/src/main/AndroidManifest.xml`:
| Permission | Reason |
| :--- | :--- |
| `android.permission.INTERNET` | Live grocery catalog, user authentication, order placement |
| `android.permission.ACCESS_NETWORK_STATE` | Offline detection and network reconnection |
| `android.permission.CAMERA` | AI Packaging Scanner (Gemini vision extraction) & UPI receipt uploads |
| `android.hardware.camera.autofocus` | Crisp product barcode and label photography |
