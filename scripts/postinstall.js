/**
 * Postinstall: aplica patches e depois o fix do Baileys (fallback).
 * O fallback roda sempre para garantir ANDROID -> SMB_ANDROID mesmo se o patch não aplicar.
 */
const { execSync } = require('child_process');

try {
  execSync('npx patch-package', { stdio: 'inherit' });
} catch (e) {
  // patch-package pode falhar (ex.: versão diferente no servidor); continuamos para o fallback
}

require('./apply-baileys-android-patch.js');
