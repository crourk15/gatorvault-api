# Submit 1.0.7 (Build 34) — App Store / TestFlight

**Why this build:** Codemagic upload of Build **33** was rejected — ASC already has `cfBundleVersion` **33** (`ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE`). Upload a higher build number.

## iOS

- `MARKETING_VERSION = 1.0.7` (unchanged)
- `CURRENT_PROJECT_VERSION = 34`

## Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`** (after this bump merges)
4. **Start new build**

## App Store Connect

1. Version train **1.0.7** (create if needed)
2. Attach build **34** when processing finishes
3. Submit / TestFlight as planned

## Whats New (short)

Same 1.0.7 elite cut as Build 33 — new build number only so ASC accepts the upload.
