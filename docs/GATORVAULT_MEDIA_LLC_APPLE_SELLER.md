# GatorVault Media, LLC → Apple seller name

**Goal:** Replace your personal name as App Store **seller / developer** with **GatorVault Media, LLC**.

Florida filing (already done):
- Entity: **GATORVAULT MEDIA, LLC**
- Document number: **L26000377317**
- Filed electronically: **July 15, 2026**
- Authentication / tracking: Corporate Filing **800478293558**
- Sunbiz: allow up to **24 hours** after the DOS email before the record appears

This cannot be finished by code alone. Apple must convert the Developer Program membership from **Individual → Organization**. Until that lands, the App Store will still show your personal name as seller even if copyright text says LLC.

---

## What is already updated in the product (this PR)

| Surface | Change |
|---------|--------|
| Privacy + Terms | Operate as **GatorVault Media, LLC** |
| App Store Connect paste sheet | Copyright → `2026 GatorVault Media, LLC` |
| iOS `Info.plist` | `NSHumanReadableCopyright` |
| Welcome / onboarding emails | Footer credit → LLC |

---

## Charles checklist (in order)

### 1. Confirm Sunbiz (today / tomorrow)
1. Open https://search.sunbiz.org/Inquiry/CorporationSearch/ByName  
2. Search **GATORVAULT MEDIA**  
3. Confirm active LLC + document **L26000377317**

### 2. Get EIN (IRS) — needed for annual report + often for D‑U‑N‑S
Apply: https://sa.www4.irs.gov/modiein/individual/index.jsp  
Save the EIN PDF.

### 3. Get a D‑U‑N‑S Number (required by Apple for Organization)
1. Apple’s D‑U‑N‑S lookup: https://developer.apple.com/enroll/duns-lookup/  
2. Or D&B: https://www.dnb.com/duns-number/get-a-duns.html  
3. Use **exact** legal name: **GatorVault Media, LLC** (or as shown on Sunbiz)  
4. Use the LLC’s mailing address  
5. After D&B issues the number, wait **~2 business days** for Apple to see it

### 4. Ask Apple to convert Individual → Organization
1. Sign in at https://developer.apple.com/contact/  
2. Request: **Update membership from Individual to Organization**  
3. Provide:
   - Organization name: **GatorVault Media, LLC**
   - D‑U‑N‑S Number
   - You are founder / have authority to bind the LLC
   - Florida document number **L26000377317** (attach Articles / DOS email if asked)
4. Apple may call or ask for more docs — answer promptly

### 5. After Apple approves the conversion
1. App Store Connect → **GatorVault Insider** → App Information  
2. **Copyright** = `2026 GatorVault Media, LLC`  
3. Confirm the public App Store page shows seller **GatorVault Media, LLC** (not your personal name)  
4. Optional: Team → invite any other operators under the org account

### 6. Keep the LLC active
- Annual report with FL Division of Corporations: **Jan 1 – May 1** each year starting the year after formation  
- Late fee after May 1: **$400**  
- Update address with DOS if it changes

---

## Do not do

- Do **not** create a second Apple Developer account and try to “move” the app unless Apple Support tells you to — convert the existing membership.  
- Do **not** paste EIN / D‑U‑N‑S / passwords into chat.  
- Do **not** change IAP product IDs or bundle id as part of the seller rename.

---

## Status tracker

| Step | Status |
|------|--------|
| FL Articles of Organization filed | **DONE** (L26000377317) |
| Product legal / copyright strings → LLC | **DONE** (repo) |
| Sunbiz visible | Pending (≤24h after DOS email) |
| EIN | Pending (Charles) |
| D‑U‑N‑S | Pending (Charles) |
| Apple Individual → Organization | Pending (Charles + Apple) |
| App Store seller name shows LLC | Pending (after Apple) |
