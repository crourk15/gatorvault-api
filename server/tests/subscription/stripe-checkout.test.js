const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isWebCheckoutEnabled,
  tierFromPriceId,
  priceIdFor,
  catalogStripeBlock,
} = require('../../lib/stripe-checkout');

test('web checkout off without Stripe key', () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(isWebCheckoutEnabled(), false);
  if (prev != null) process.env.STRIPE_SECRET_KEY = prev;
});

test('price map resolves tiers from env', () => {
  process.env.STRIPE_PRICE_FILM_MONTHLY = 'price_film_m';
  process.env.STRIPE_PRICE_FILM_ANNUAL = 'price_film_a';
  assert.equal(priceIdFor('film', 'monthly'), 'price_film_m');
  assert.equal(tierFromPriceId('price_film_a'), 'film');
  const block = catalogStripeBlock();
  assert.equal(block.tiers.film.ready, true);
  delete process.env.STRIPE_PRICE_FILM_MONTHLY;
  delete process.env.STRIPE_PRICE_FILM_ANNUAL;
});
