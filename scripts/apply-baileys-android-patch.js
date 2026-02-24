/**
 * Fallback: aplica a alteração ANDROID -> SMB_ANDROID no Baileys
 * quando o patch-package não conseguir aplicar (ex.: versão diferente, line endings).
 * Roda após o patch-package no postinstall.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@whiskeysockets',
  'baileys',
  'lib',
  'Utils',
  'validate-connection.js'
);

if (!fs.existsSync(filePath)) {
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');
const needFix = content.includes('Platform.ANDROID') && content.includes("includes('android')");
if (!needFix) {
  process.exit(0);
}

// Troca apenas a ocorrência no getUserAgent (linha do ternary android)
content = content.replace(
  /proto\.ClientPayload\.UserAgent\.Platform\.ANDROID/,
  'proto.ClientPayload.UserAgent.Platform.SMB_ANDROID'
);

if (content.includes('Platform.SMB_ANDROID')) {
  fs.writeFileSync(filePath, content);
  console.log('apply-baileys-android-patch: alteração ANDROID -> SMB_ANDROID aplicada (fallback).');
}
