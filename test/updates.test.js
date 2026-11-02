const test = require('node:test');
const assert = require('node:assert/strict');
const { createUpdates, CHECK_EVERY_MS } = require('../src/main/updates');

// A stand-in for electron-updater's autoUpdater: counts checks, returns or throws what the test says.
function fakeUpdater(outcome) {
  return {
    calls: 0,
    autoInstallOnAppQuit: false,
    async checkForUpdatesAndNotify() {
      this.calls++;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
}

function fakeTimers() {
  const t = { started: [], cleared: [] };
  t.setInterval = (fn, ms) => {
    const id = t.started.length + 1;
    t.started.push({ fn, ms, id });
    return id;
  };
  t.clearInterval = (id) => t.cleared.push(id);
  return t;
}

const make = (updater, { isPackaged = true } = {}) => {
  const timers = fakeTimers();
  return { timers, updates: createUpdates({ updater, isPackaged, timers }) };
};

test('nothing is available from an unpackaged dev checkout and the updater is never touched', async () => {
  const updater = fakeUpdater({ isUpdateAvailable: true });
  const { updates } = make(updater, { isPackaged: false });
  assert.equal(updates.available, false);
  assert.deepEqual(await updates.checkNow(), { state: 'unavailable' });
  updates.setAuto(true);
  assert.equal(updater.calls, 0);
});

test('nothing is available without an updater', async () => {
  const { updates } = make(null);
  assert.equal(updates.available, false);
  assert.deepEqual(await updates.checkNow(), { state: 'unavailable' });
});

test('a manual check reports available, current or unavailable', async () => {
  assert.deepEqual(await make(fakeUpdater({ isUpdateAvailable: true })).updates.checkNow(), { state: 'available' });
  assert.deepEqual(await make(fakeUpdater({ isUpdateAvailable: false })).updates.checkNow(), { state: 'current' });
  assert.deepEqual(await make(fakeUpdater(null)).updates.checkNow(), { state: 'unavailable' });
});

test('a failing check reports an error and never throws', async () => {
  const { updates } = make(fakeUpdater(new Error('offline')));
  assert.deepEqual(await updates.checkNow(), { state: 'error' });
});

test('an update is installed when the app quits', () => {
  const updater = fakeUpdater(null);
  make(updater);
  assert.equal(updater.autoInstallOnAppQuit, true);
});

test('automatic checking is off until it is switched on: no check and no timer', () => {
  const updater = fakeUpdater({ isUpdateAvailable: false });
  const { timers, updates } = make(updater);
  updates.setAuto(false);
  assert.equal(updater.calls, 0);
  assert.equal(timers.started.length, 0);
});

test('switching it on checks now and then on a timer', async () => {
  const updater = fakeUpdater({ isUpdateAvailable: false });
  const { timers, updates } = make(updater);
  updates.setAuto(true);
  assert.equal(updater.calls, 1);
  assert.equal(timers.started.length, 1);
  assert.equal(timers.started[0].ms, CHECK_EVERY_MS);
  await timers.started[0].fn();
  assert.equal(updater.calls, 2);
});

test('switching it on twice does not start a second timer', () => {
  const { timers, updates } = make(fakeUpdater({ isUpdateAvailable: false }));
  updates.setAuto(true);
  updates.setAuto(true);
  assert.equal(timers.started.length, 1);
});

test('switching it off stops the timer', () => {
  const { timers, updates } = make(fakeUpdater({ isUpdateAvailable: false }));
  updates.setAuto(true);
  updates.setAuto(false);
  assert.deepEqual(timers.cleared, [1]);
});

test('an automatic check that fails is swallowed', async () => {
  const { timers, updates } = make(fakeUpdater(new Error('offline')));
  updates.setAuto(true);
  await assert.doesNotReject(async () => timers.started[0].fn());
});
