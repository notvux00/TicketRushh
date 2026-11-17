const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

for (const timezone of ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo']) {
  test(`venue form time and showtime expiry remain correct in ${timezone}`, () => {
    const helper = pathToFileURL(resolve(__dirname, '../frontend/src/utils/eventTime.js')).href;
    const policy = pathToFileURL(resolve(__dirname, '../frontend/src/utils/eventUtils.js')).href;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { toEventDateTimeLocal } from ${JSON.stringify(helper)};
      import { isShowtimeExpired } from ${JSON.stringify(policy)};
      const fixed = Date.parse('2030-01-01T10:00:00+07:00');
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
      console.log(JSON.stringify({
        offsetInput: toEventDateTimeLocal('2030-01-02T00:30:00+07:00'),
        utcInput: toEventDateTimeLocal('2030-01-01T17:30:00Z'),
        localDraft: toEventDateTimeLocal('2030-01-02T00:30'),
        closed: isShowtimeExpired({ startTime: '2030-01-01T09:00:00+07:00' }),
        open: isShowtimeExpired({ startTime: '2030-01-01T11:00:00+07:00' }),
      }));
    `], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), {
      offsetInput: '2030-01-02T00:30',
      utcInput: '2030-01-02T00:30',
      localDraft: '2030-01-02T00:30',
      closed: true,
      open: false,
    });
  });
}
