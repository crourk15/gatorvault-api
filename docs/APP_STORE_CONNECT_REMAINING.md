# App Store Connect — Remaining Steps (10 min)

Apple requires YOUR login. Open this file beside App Store Connect and check off each step.

**Start:** https://appstoreconnect.apple.com → Apps → GatorVault Insider → **Distribution** tab

**Prep locally first:** `npm run walkthrough:app-store` (writes `docs/app-store/CONNECT_SESSION.md`)

---

## Step 1 — App Information (Age Rating + Privacy URL)

**Sidebar:** General → **App Information**

Click **Edit** (top right), then set:

| Field | Value |
|-------|--------|
| Subtitle | UF Football Intel Hub |
| Primary Category | Sports |
| Secondary Category | News (optional) |
| Privacy Policy URL | https://gatorvaultinsider.com/privacy/ |

Scroll to **Age Ratings** → **Set Up Age Ratings** (or **Edit** if already started).

### Age rating answers (GatorVault Insider)

Use these unless a question clearly does not apply — then choose None / No.

**Step A — Features / capabilities**
| Question | Answer |
|----------|--------|
| In-App Controls (Parental Controls, etc.) | None / No |
| Capabilities — Unrestricted Web Access | **Yes** (WebView loads gatorvaultinsider.com) |
| Capabilities — User-Generated Content | **Yes** |
| Capabilities — Messaging and Chat | **Yes** (community threads) |
| Capabilities — Advertising | **No** |
| Made for Kids / Age Assurance | **No** (not a kids app) |

**Step B — Mature content frequency** (all should be None / Infrequent / No)
| Content type | Answer |
|--------------|--------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | Infrequent or Mild (user posts possible) |
| Horror / Fear Themes | None |
| Mature / Suggestive Themes | None |
| Alcohol, Tobacco, Drugs | None |
| Gambling | None |
| Contests | None |
| Medical / Wellness (sensitive) | None |

**Step C — Override (optional)**
- Leave default unless Apple assigns below 13+ and you want 13+ minimum for community → use **Override to Higher Age Rating** → **13+**

Click **Save**. Note your assigned rating (likely **12+**, **13+**, or **16+** with UGC + messaging).

---

## Step 2 — App Privacy (data collection)

**Sidebar:** **App Privacy** (under General)

Click **Get Started** or **Edit**.

### Privacy Policy URL (if prompted here)
https://gatorvaultinsider.com/privacy/

### Do you or third-party partners collect data from this app?
**Yes**

### Data types to add (click + for each)

**1. Contact Info → Email Address**
- Used for: App Functionality, Account Management
- Linked to user: **Yes**
- Used for tracking: **No**

**2. User Content → Other User Content** (community posts)
- Used for: App Functionality
- Linked to user: **Yes**
- Used for tracking: **No**

**3. Identifiers → User ID** (account / session ID)
- Used for: App Functionality, Account Management
- Linked to user: **Yes**
- Used for tracking: **No**

**4. Identifiers → Email Address** (if listed separately under Identifiers, skip duplicate)

**5. Purchases → Purchase History** (ONLY if you already sell via Apple IAP)
- For v1 without StoreKit live: **Skip** — do not add Purchases yet
- After IAP live: add Purchase History, App Functionality, Linked Yes, Tracking No

**6. Usage Data → Product Interaction** (optional — only if you collect analytics)
- If unsure: **Skip** unless you use third-party analytics SDKs in the iOS app
- Capacitor shell loading your site may log server-side page views — many devs still skip if no SDK in native app

### Tracking
**No**, we do not use data for tracking across apps and websites owned by other companies.

Click **Save** → **Publish** (must publish privacy labels before submit).

---

## Step 3 — Pricing and Availability

**Sidebar:** Monetization → **Pricing and Availability**

| Field | Value |
|-------|--------|
| Price | **Free** (price tier $0.00) |
| Availability | All countries/regions (or United States only if you prefer soft launch) |
| Pre-order | Off |

**Save**

Note: Membership is sold on the website for now (StoreKit Step 3b later). Free app download is correct until IAP is wired.

---

## Step 4 — App Review contact (Version 1.0 page)

**Sidebar:** iOS App → **1.0 Prepare for Submission** → scroll to **App Review Information**

| Field | Value |
|-------|--------|
| First name | Charles |
| Last name | Rourk |
| Phone | (your mobile) |
| Email | support@gatorvaultinsider.com |
| Sign-in required | Yes |
| Username | appreview@gatorvaultinsider.com |
| Password | (already set) |

**Notes** — paste full block from docs/APP_STORE_REVIEW.md (see APP_STORE_CONNECT_PASTE.txt)

**Save**

---

## Step 5 — Build (cannot skip — engineering)

Version 1.0 → **Build** section → empty until first iOS upload.

1. Build on Mac (Xcode) or Codemagic — see docs/MOBILE_IOS.md
2. Upload to App Store Connect / TestFlight
3. Return to Version 1.0 → **+** next to Build → select build
4. Answer export compliance: Uses encryption **Yes** → qualifies for exemption **Yes** (HTTPS only)

---

## Step 6 — Submit

When Version 1.0 shows no yellow warnings:
- Build selected
- App Privacy **Published**
- Age rating set
- Pricing set
- Contact info filled

Click **Add for Review**

---

## If sidebar items are missing

- You are on Version 1.0 only → click **GatorVault Insider** breadcrumb to see full sidebar
- **Limited Access** role → need Admin/App Manager on the team
- Enrollment still processing → wait for Apple approval email

---

## Quick checklist

- [ ] App Information: subtitle, category, privacy URL
- [ ] Age Ratings questionnaire complete
- [ ] App Privacy published
- [ ] Pricing and Availability: Free
- [ ] App Review contact info + full notes
- [ ] Build uploaded and selected
- [ ] Add for Review