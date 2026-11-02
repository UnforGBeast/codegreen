const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const { createAdapters } = require('../adapters');
const { createTracker } = require('../core/tracker');
const { loadSettings, saveSettings, withRatePreset } = require('../core/settings');
const { RATES } = require('../core/water');
const { sceneState } = require('../core/lake');
const { LEDGER_PATH, SETTINGS_PATH } = require('../core/paths');
const { safePosition } = require('./position');

const WINDOW_SIZE = { width: 220, height: 240 };
const TICK_MS = 3000;
const SAVE_DEBOUNCE_MS = 500;

let win = null;
let infoWin = null;
let runTick = () => {};
let settings = { ratePreset: 'default' };
let lastSnapshot = null;

// A settings file that cannot be written must never raise an uncaught error in the main process.
function persistSettings() {
  try {
    saveSettings(SETTINGS_PATH, settings);
  } catch {
    // the choice still applies for this run
  }
}

function popupMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Info', click: () => openInfo() },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
}

function openInfo() {
  if (infoWin && !infoWin.isDestroyed()) {
    infoWin.show();
    infoWin.focus();
    return;
  }
  infoWin = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'Freshwater info',
    backgroundColor: '#0a0f1f',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  infoWin.setMenu(null);
  infoWin.loadFile(path.join(__dirname, '..', 'renderer', 'info.html'));
  infoWin.webContents.on('did-finish-load', () => {
    if (lastSnapshot) infoWin.webContents.send('snapshot', lastSnapshot);
  });
  infoWin.on('closed', () => {
    infoWin = null;
  });
}

function displays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({ primary: d.id === primaryId, workArea: d.workArea }));
}

function createWindow() {
  const pos = safePosition(settings, displays(), WINDOW_SIZE);
  win = new BrowserWindow({
    ...WINDOW_SIZE,
    ...pos,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, '..', 'renderer', 'widget.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    if (lastSnapshot) win.webContents.send('snapshot', lastSnapshot);
  });

  // The canvas is a drag region, which would otherwise show the Windows system menu.
  win.on('system-context-menu', (event) => {
    event.preventDefault();
    popupMenu();
  });

  let saveTimer = null;
  win.on('move', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      const [x, y] = win.getPosition();
      settings = { ...settings, x, y };
      persistSettings();
    }, SAVE_DEBOUNCE_MS);
  });
  win.on('closed', () => {
    win = null;
  });
}

function startTracking() {
  const tracker = createTracker({
    adapters: createAdapters(),
    ledgerPath: LEDGER_PATH,
    getRate: () => RATES[settings.ratePreset] || RATES.default,
    now: Date.now,
  });
  const run = () => {
    try {
      const snapshot = tracker.tick();
      lastSnapshot = { ...snapshot, scene: sceneState(snapshot.level) };
      for (const w of [win, infoWin]) if (w && !w.isDestroyed()) w.webContents.send('snapshot', lastSnapshot);
    } catch {
      // a bad tick must never take the widget down; the next tick tries again
    }
  };
  runTick = run;
  run();
  setInterval(run, TICK_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) win.show();
  });
  app.whenReady().then(() => {
    settings = loadSettings(SETTINGS_PATH);
    ipcMain.on('open-menu', popupMenu);
    ipcMain.on('open-info', () => openInfo());
    ipcMain.handle('get-rates', () => ({ rates: RATES, preset: settings.ratePreset }));
    ipcMain.handle('set-rate-preset', (_event, preset) => {
      const next = withRatePreset(settings, preset);
      if (next !== settings) {
        settings = next;
        persistSettings();
        runTick(); // refresh every figure now rather than at the next tick
      }
      return settings.ratePreset;
    });
    createWindow();
    startTracking();
  });
  app.on('window-all-closed', () => app.quit());
}
