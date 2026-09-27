const { join } = require('node:path');

process.argv.push(`--plugins=local-dir:${join(process.resourcesPath, 'app/plugins')}`);
require('../lib/backend/electron-main.js');
