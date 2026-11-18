const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const helper = import(pathToFileURL(resolve(__dirname, '../frontend/src/utils/listState.js')).href);

test('updateAt patches only the target item and keeps other references', async () => {
  const { updateAt } = await helper;
  const first = { name: 'A', nested: { keep: true } };
  const second = { name: 'B', nested: { keep: true } };
  const list = [first, second];

  const next = updateAt(list, 1, { name: 'B2', visualWidth: 300 });

  assert.notEqual(next, list);
  assert.equal(next[0], first);
  assert.notEqual(next[1], second);
  assert.equal(second.name, 'B');
  assert.equal(second.visualWidth, undefined);
  assert.deepEqual(next[1], { name: 'B2', nested: { keep: true }, visualWidth: 300 });
  assert.deepEqual(list, [first, second]);
});
