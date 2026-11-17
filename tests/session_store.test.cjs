const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

const a = { access_token: 'A', user: { id: 'owner-A' } };
const b = { access_token: 'B', user: { id: 'owner-B' } };
let sequence = 0;
async function fresh() {
  const data = new Map([['token', 'A'], ['user', JSON.stringify(a.user)]]);
  global.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  const events = new Map();
  global.window = { addEventListener: (name, callback) => events.set(name, callback) };
  const path = pathToFileURL(resolve(__dirname, '../frontend/src/api/sessionStore.js')).href;
  return { store: await import(`${path}?test=${++sequence}`), events };
}

test('storage event changes account but requests wait for the matching rendered identity', async () => {
  const { store, events } = await fresh();
  assert.deepEqual(a, store.readSession()); store.acknowledgeSession(a);
  assert.equal(null, localStorage.getItem('token'));
  assert.equal(null, localStorage.getItem('user'));
  assert.deepEqual(a, store.requestSession());
  const changes = []; store.subscribeSession((event, session) => changes.push([event, session]));
  localStorage.setItem(store.SESSION_KEY, JSON.stringify(b));
  events.get('storage')({ key: store.SESSION_KEY });
  assert.deepEqual([['SIGNED_IN', b]], changes);
  assert.throws(() => store.requestSession(), store.SessionChangedError);
  store.acknowledgeSession(b); assert.deepEqual(b, store.requestSession());
});

test('request detects changed storage before notification and never borrows the new token', async () => {
  const { store } = await fresh(); store.acknowledgeSession(a);
  localStorage.setItem(store.SESSION_KEY, JSON.stringify(b));
  assert.throws(() => store.requestSession(), store.SessionChangedError);
  assert.equal(null, store.requestSession(true));
});

test('logout tombstone prevents legacy credentials from resurrecting a session', async () => {
  const { store } = await fresh(); store.acknowledgeSession(a);
  store.saveSession(null);
  localStorage.setItem('token', 'A'); localStorage.setItem('user', JSON.stringify(a.user));
  assert.equal(null, store.readSession());
  assert.throws(() => store.requestSession(), store.SessionChangedError);
  store.acknowledgeSession(null); assert.equal(null, store.requestSession());
});

test('mixed legacy JWT and user values fail closed instead of binding the wrong account', async () => {
  const { store } = await fresh();
  const payload = Buffer.from(JSON.stringify({ sub: 'owner-B' })).toString('base64url');
  localStorage.setItem(store.SESSION_KEY, JSON.stringify({ access_token: `header.${payload}.signature`, user: a.user }));
  assert.equal(null, store.readSession());
});
