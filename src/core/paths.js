const os = require('node:os');
const path = require('node:path');

const DATA_DIR = path.join(os.homedir(), '.freshwater');

module.exports = {
  DATA_DIR,
  LEDGER_PATH: path.join(DATA_DIR, 'ledger.json'),
  SETTINGS_PATH: path.join(DATA_DIR, 'settings.json'),
};
