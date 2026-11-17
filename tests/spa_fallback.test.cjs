const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../infra/terraform/modules/edge/spa_fallback.js'), 'utf8'), context);

test('SPA navigation and refresh use the root index with or without trailing slash', () => {
  for (const uri of ['/', '/profile', '/profile/', '/my-tickets/', '/payment-success/', '/event/id/book/showtime/']) {
    const querystring = { orderId: { value: 'issued-order' } };
    const request = context.handler({ request: { uri, querystring } });
    assert.equal(request.uri, '/index.html', uri);
    assert.equal(request.querystring, querystring);
  }
});

test('versioned scripts, styles and assets retain their S3 object paths', () => {
  for (const uri of ['/assets/index-hash.js', '/assets/index-hash.css', '/favicon.ico', '/media/avatar.png']) {
    assert.equal(context.handler({ request: { uri } }).uri, uri);
  }
});
