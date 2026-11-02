// Menu entry for starting at login, or null when it cannot work.
// Electron can set a login item on Windows and macOS only, and an unpackaged dev checkout
// would register the bare Electron binary instead of this app.
function loginItem(platform, isPackaged) {
  if (!isPackaged) return null;
  if (platform === 'win32') return { label: 'Start with Windows' };
  if (platform === 'darwin') return { label: 'Start at login' };
  return null;
}

module.exports = { loginItem };
