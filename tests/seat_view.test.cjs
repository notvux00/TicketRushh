const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const helper = import(pathToFileURL(resolve(__dirname, '../frontend/src/utils/seatView.js')).href);

const zone = {
  positionX: 40,
  positionY: 20,
  visualWidth: 260,
  visualHeight: 120,
  matrixRow: 4,
  matrixCol: 8,
};

test('cinema row labels continue past Z', async () => {
  const { rowLabelFromIndex } = await helper;
  assert.equal(rowLabelFromIndex(1), 'A');
  assert.equal(rowLabelFromIndex(26), 'Z');
  assert.equal(rowLabelFromIndex(27), 'AA');
  assert.equal(rowLabelFromIndex(53), 'BA');
  assert.equal(rowLabelFromIndex(703), 'AAA');
});

test('seat labels fall back to grid coordinates when missing', async () => {
  const { splitSeatLabel } = await helper;
  assert.deepEqual(splitSeatLabel('B12', 2, 12), { rowLabel: 'B', seatNumber: '12' });
  assert.deepEqual(splitSeatLabel('', 3, 5), { rowLabel: 'C', seatNumber: '5' });
});

test('seat centre maps into the zone geometry and clamps invalid grid values', async () => {
  const { seatCanvasPosition } = await helper;
  assert.deepEqual(seatCanvasPosition(zone, { gridRow: 1, gridCol: 1 }), { x: 56.25, y: 35 });
  assert.deepEqual(seatCanvasPosition(zone, { gridRow: 99, gridCol: 99 }), { x: 283.75, y: 125 });
});

test('view metrics move the screen opposite to an off-centre seat', async () => {
  const { seatViewMetrics } = await helper;
  const centredZone = {
    positionX: 320,
    positionY: 140,
    visualWidth: 260,
    visualHeight: 180,
    matrixRow: 5,
    matrixCol: 9,
  };
  const left = seatViewMetrics(centredZone, { seatLabel: 'A1', gridRow: 1, gridCol: 1 });
  const centre = seatViewMetrics(centredZone, { seatLabel: 'C5', gridRow: 3, gridCol: 5 });
  const right = seatViewMetrics(centredZone, { seatLabel: 'E9', gridRow: 5, gridCol: 9 });

  assert.ok(left.lateralMeters < 0);
  assert.ok(right.lateralMeters > 0);
  assert.ok(left.screenShiftXPct > 0);
  assert.ok(right.screenShiftXPct < 0);
  assert.ok(left.yawDegrees > 0);
  assert.ok(right.yawDegrees < 0);
  assert.ok(left.distanceMeters < right.distanceMeters);
  assert.ok(centre.screenScale > right.screenScale);
  assert.equal(centre.quality, 'Gần trục giữa');
});
