// Optional update checks. A check asks GitHub whether a newer release exists, which is the
// only network request the app can make, so automatic checking is OFF until the user turns it on.
// A manual "Check for updates" is an explicit action and always allowed in a packaged app.
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;

// `updater` is electron-updater's autoUpdater (or null); `timers` is injectable for tests.
function createUpdates({ updater, isPackaged, timers = { setInterval, clearInterval } }) {
  const available = Boolean(updater && isPackaged);
  let timer = null;

  if (available) updater.autoInstallOnAppQuit = true;

  // Never throws: an offline or failing check reports 'error'.
  async function checkNow() {
    if (!available) return { state: 'unavailable' };
    try {
      const result = await updater.checkForUpdatesAndNotify();
      if (!result) return { state: 'unavailable' };
      return { state: result.isUpdateAvailable ? 'available' : 'current' };
    } catch {
      return { state: 'error' };
    }
  }

  function setAuto(enabled) {
    if (!available) return;
    if (enabled && !timer) {
      void checkNow(); // never rejects, so nothing to catch
      timer = timers.setInterval(() => void checkNow(), CHECK_EVERY_MS);
      if (timer && typeof timer.unref === 'function') timer.unref();
    } else if (!enabled && timer) {
      timers.clearInterval(timer);
      timer = null;
    }
  }

  return { available, checkNow, setAuto };
}

module.exports = { createUpdates, CHECK_EVERY_MS };
