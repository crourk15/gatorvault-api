import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FALLBACK_APPLE_TIERS,
  membershipBillingNotice,
  membershipIapUnlocked,
  resolveMembershipTiers,
} from './membership-billing';

describe('membership billing gates', () => {
  it('shows Apple IAP on native when StoreKit is ready even if the catalog flag is missing', () => {
    assert.equal(
      membershipBillingNotice({
        native: true,
        billingReady: true,
        iosPurchaseReady: false,
        webCheckoutReady: false,
        loaded: true,
      }),
      'iap'
    );
    assert.equal(membershipIapUnlocked({ native: true, billingReady: true }), true);
  });

  it('does not say billing is unavailable while membership is still loading', () => {
    assert.equal(
      membershipBillingNotice({
        native: true,
        billingReady: false,
        iosPurchaseReady: false,
        webCheckoutReady: false,
        loaded: false,
      }),
      'loading'
    );
  });

  it('tells web users to open the iOS app when Apple IAP is live', () => {
    assert.equal(
      membershipBillingNotice({
        native: false,
        billingReady: false,
        iosPurchaseReady: true,
        webCheckoutReady: false,
        loaded: true,
      }),
      'open-app'
    );
  });

  it('falls back to hardcoded Apple product IDs when the catalog never lands', () => {
    const tiers = resolveMembershipTiers(null);
    assert.equal(tiers, FALLBACK_APPLE_TIERS);
    assert.equal(tiers[0].products.monthly, 'com.gatorvaultinsider.locker.monthly');
    assert.equal(tiers[1].products.monthly, 'com.gatorvaultinsider.film.monthly');
  });
});
