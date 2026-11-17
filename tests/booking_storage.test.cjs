const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const helper = import(pathToFileURL(resolve(__dirname, '../frontend/src/utils/bookingStorage.js')).href);

function reset() {
  const data = new Map();
  global.localStorage = {
    get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key),
  };
}

test('finishing A repeatedly preserves the newer pending B and its cart', async () => {
  reset(); const store = await helper;
  const a = store.saveCart('owner', 'show', [{ id: 'seat-A' }]);
  store.rememberCheckout('owner', 'show', 'A', a);
  const b = store.saveCart('owner', 'show', [{ id: 'seat-B' }]);
  store.rememberCheckout('owner', 'show', 'B', b);
  store.finishCheckout('owner', 'show', 'A'); store.finishCheckout('owner', 'show', 'A');
  assert.deepEqual(['B'], store.checkoutReferences('owner', 'show').map(x => x.orderId));
  assert.deepEqual([{ id: 'seat-B' }], store.readCart('owner', 'show').seats);
});

test('account namespaces and exact order cleanup do not affect another account', async () => {
  reset(); const store = await helper;
  for (const owner of ['one', 'two']) {
    const revision = store.saveCart(owner, 'show', [{ id: owner }]);
    store.rememberCheckout(owner, 'show', 'same-order-id', revision);
  }
  store.finishCheckout('one', 'show', 'same-order-id');
  assert.deepEqual([], store.readCart('one', 'show').seats);
  assert.deepEqual([{ id: 'two' }], store.readCart('two', 'show').seats);
  assert.equal(1, store.checkoutReferences('two', 'show').length);
});

test('old order cleanup never compare-deletes the current cart pointer', async () => {
  reset(); const store = await helper;
  const a = store.saveCart('owner', 'show', [{ id: 'A' }]);
  store.rememberCheckout('owner', 'show', 'A', a);
  const b = store.saveCart('owner', 'show', [{ id: 'B' }], a);
  store.finishCheckout('owner', 'show', 'A');
  assert.equal(b, store.readCart('owner', 'show').revision);
  assert.deepEqual([{ id: 'B' }], store.readCart('owner', 'show').seats);
});

test('legacy references are read-only and unowned legacy carts are not borrowed', async () => {
  reset(); const store = await helper;
  localStorage.setItem('checkout_order_show', 'legacy-A');
  localStorage.setItem('cart_show', JSON.stringify([{ id: 'unknown-owner' }]));
  assert.equal('legacy-A', store.checkoutReferences('new-owner', 'show')[0].orderId);
  assert.deepEqual([], store.readCart('new-owner', 'show').seats);
  store.finishCheckout('new-owner', 'show', 'legacy-A');
  assert.equal('legacy-A', localStorage.getItem('checkout_order_show'));
});

test('expired response without showtime clears only its own account and order', async () => {
  reset(); const store = await helper;
  store.rememberCheckout('owner', 'show', 'A');
  store.rememberCheckout('owner', 'show', 'B');
  store.rememberCheckout('other', 'show', 'A');
  store.finishCheckout('owner', undefined, 'A');
  assert.deepEqual(['B'], store.checkoutReferences('owner', 'show').map(x => x.orderId));
  assert.deepEqual(['A'], store.checkoutReferences('other', 'show').map(x => x.orderId));
});

test('latest checkout is deterministic even when timestamps tie', async () => {
  reset(); const store = await helper;
  store.rememberCheckout('owner', 'show', 'A'); store.rememberCheckout('owner', 'show', 'B');
  assert.equal('B', store.checkoutReferences('owner', 'show')[0].orderId);
  store.finishCheckout('owner', 'show', 'A');
  assert.equal('B', store.checkoutReferences('owner', 'show')[0].orderId);
});
