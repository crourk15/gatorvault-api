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

## What is already updated in the product

| Surface | Change |
|---------|--------|
| Privacy + Terms | Operate as **GatorVault Media, LLC** |
| App Store Connect paste sheet | Copyright → `2026 GatorVault Media, LLC` |
| iOS `Info.plist` | `NSHumanReadableCopyright` |
| Welcome / onboarding emails | Footer credit → LLC |

---

## EIN status (read this)

An EIN was issued, but the IRS confirmation lists the **legal name as a person** (not **GatorVault Media, LLC**).

That means the EIN is an **individual / sole-proprietor** EIN, **not** an LLC EIN.

**Do not use that personal EIN for:**
- D‑U‑N‑S registration for the LLC
- Apple Individual → Organization conversion
- Anything that must match **GatorVault Media, LLC** as the legal entity

### What to do instead

1. Apply for a **new EIN for the LLC**:
   - https://sa.www4.irs.gov/modiein/individual/index.jsp
2. On the form, choose entity type **Limited Liability Company (LLC)** (not sole proprietor / individual).
3. **Legal name** must be exactly: **GATORVAULT MEDIA LLC** / **GatorVault Media, LLC** (match Sunbiz).
4. You can still be the **responsible party** (your name as owner) — that is fine.
5. Download and save the new LLC EIN confirmation PDF.
6. Keep the personal EIN for personal tax use if needed; do **not** mix them.

Never paste EINs into chat or commit them to the repo.

---

## Charles checklist (in order)

### 1. Confirm Sunbiz
1. Open https://search.sunbiz.org/Inquiry/CorporationSearch/ByName  
2. Search **GATORVAULT MEDIA**  
3. Confirm active LLC + document **L26000377317**

### 2. Get EIN for the **LLC** (not personal)
See **EIN status** above. You need a confirmation letter whose **Legal name** is the LLC.

### 3. Get a D‑U‑N‑S Number (required by Apple for Organization)
1. Apple’s D‑U‑N‑S lookup: https://developer.apple.com/enroll/duns-lookup/  
2. Or D&B: https://www.dnb.com/duns-number/get-a-duns.html  
3. Use **exact** legal name: **GatorVault Media, LLC** (as on Sunbiz)  
4. Use the LLC’s mailing address + the **LLC EIN** when asked  
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
- Annual report will ask for the **LLC FEI/EIN**

---

## Do not do

- Do **not** create a second Apple Developer account and try to “move” the app unless Apple Support tells you to — convert the existing membership.  
- Do **not** paste EIN / D‑U‑N‑S / passwords into chat.  
- Do **not** change IAP product IDs or bundle id as part of the seller rename.  
- Do **not** register D‑U‑N‑S / Apple org under a personal EIN.

---

## Status tracker

| Step | Status |
|------|--------|
| FL Articles of Organization filed | **DONE** (L26000377317) |
| Product legal / copyright strings → LLC | **DONE** (repo) |
| Sunbiz visible | Confirm on sunbiz.org |
| EIN | **Personal EIN obtained — LLC EIN still needed** |
| D‑U‑N‑S | Pending (after LLC EIN) |
| Apple Individual → Organization | Pending (Charles + Apple) |
| App Store seller name shows LLC | Pending (after Apple) |
