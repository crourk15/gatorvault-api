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
| Canonical entity constants | `client/lib/legal-entity.ts` (`L26000377317`) |

---

## EIN status

**LLC EIN obtained (July 22, 2026).** IRS confirmation legal name: **GATORVAULT MEDIA** (name control **GATO**). That matches the Florida LLC (IRS forms omit the `LLC` ending). Keep the confirmation PDF offline — do not commit EINs to the repo or paste them into chat unnecessarily.

Use this **LLC EIN** for:
- D‑U‑N‑S registration
- Apple Individual → Organization conversion / tax forms
- Florida annual report (FEI/EIN field)

Do **not** mix a personal/sole-prop EIN with LLC filings.

---

## Charles checklist (in order)

### 1. Confirm Sunbiz
1. Open https://search.sunbiz.org/Inquiry/CorporationSearch/ByName  
2. Search **GATORVAULT MEDIA**  
3. Confirm active LLC + document **L26000377317**

### 2. EIN for the LLC — DONE
Confirmation PDF saved offline. Legal name on letter: **GATORVAULT MEDIA**.

### 3. Get a D‑U‑N‑S Number (required by Apple for Organization) — NEXT
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

**Suggested message to Apple:**

> Please update my Apple Developer Program membership from Individual to Organization.  
> Organization legal name: GatorVault Media, LLC  
> Florida document number: L26000377317 (Articles filed July 15, 2026)  
> I am Charles W. Rourk III, Sole Member, with authority to bind the company.  
> D‑U‑N‑S: [paste after issued]  
> LLC EIN: [paste from IRS CP575G]  
> Please keep the existing apps, bundle IDs, and IAP products on this membership.

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
| EIN for LLC | **DONE** (July 22, 2026 — CP575G on file) |
| D‑U‑N‑S | **NEXT** — Charles registers with D&B |
| Apple Individual → Organization | Pending (Charles + Apple; needs D‑U‑N‑S) |
| App Store seller name shows LLC | Pending (after Apple) |
