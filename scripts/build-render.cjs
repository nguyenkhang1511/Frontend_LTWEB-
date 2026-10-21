const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBaseUrl = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+\/api$/.test(apiBaseUrl)) {
    throw new Error('Set API_BASE_URL to https://<backend>.onrender.com/api');
}

const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const entry of ['index.html', 'register.html', 'css', 'js', 'admin', 'student', 'lecturer']) {
    fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
const configPath = path.join(output, 'js', 'config.js');
const config = fs.readFileSync(configPath, 'utf8');
if (!/^const API_BASE_URL = .*;/m.test(config)) {
    throw new Error('Cannot find API_BASE_URL in js/config.js');
}
fs.writeFileSync(configPath, config.replace(/^const API_BASE_URL = .*;/m,
    () => `const API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`));
console.log('Static site prepared in dist');
