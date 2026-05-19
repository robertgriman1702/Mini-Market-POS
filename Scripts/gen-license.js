#!/usr/bin/env node
/**
 * ============================================================
 * Generador de Licencias — POS MiniMarket
 * ============================================================
 *
 * Uso:
 *   node scripts/gen-license.js <HWID> <cliente> [dias]
 *
 * Ejemplos:
 *   node scripts/gen-license.js 97E7-DF66-88AB "Bodega Don Juan"
 *   node scripts/gen-license.js 97E7-DF66-88AB "Bodega Don Juan" 365
 *   node scripts/gen-license.js 97E7-DF66-88AB "Bodega Don Juan" trial
 *
 * 'trial' genera exactamente 7 días de prueba.
 * ============================================================
 */

const crypto = require('crypto');
const fs     = require('fs');

const SECRET = 'pos-minimarket-license-secret-2024';

function sign(hwid, cliente, expira_at) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${hwid}|${cliente}|${expira_at ?? 'permanent'}`)
    .digest('hex');
}

function generate(hwid, cliente, dias) {
  // Calcular expiración
  let expira_at = null;
  let vigenciaLabel = 'Permanente';

  if (dias !== null) {
    const fecha = new Date(Date.now() + dias * 86_400_000);
    expira_at = fecha.toISOString();
    vigenciaLabel = `${dias} días (hasta ${fecha.toLocaleDateString('es', {
      day: '2-digit', month: 'long', year: 'numeric'
    })})`;
  }

  const payload = {
    hwid,
    cliente,
    expira_at,
    signature: sign(hwid, cliente, expira_at),
  };

  const encoded  = Buffer.from(JSON.stringify(payload)).toString('base64');
  const filename = `license_${hwid.replace(/-/g, '')}.key`;

  fs.writeFileSync(filename, encoded, 'utf8');

  const isTrial = dias === 7;

  console.log('\n' + (isTrial ? '🔶 LICENCIA DE PRUEBA' : '✅ Licencia generada'));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Cliente   : ${cliente}`);
  console.log(`  HWID      : ${hwid}`);
  console.log(`  Vigencia  : ${vigenciaLabel}`);
  console.log(`  Archivo   : ${filename}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (isTrial) {
    console.log('\n  ⚠️  Esta es una licencia de PRUEBA de 7 días.');
    console.log('  El cliente debe contactarte antes de que expire para adquirir');
    console.log('  la licencia completa.\n');
  } else {
    console.log('\n  Envía este archivo al cliente.');
    console.log(`  El cliente lo coloca en:`);
    console.log(`  %APPDATA%\\@pos\\electron\\license.key\n`);
  }
}

// ── Leer argumentos ──────────────────────────────────────────────────────────
const [,, hwid, cliente, diasArg] = process.argv;

if (!hwid || !cliente) {
  console.log('\n  Uso: node scripts/gen-license.js <HWID> <cliente> [dias|trial]\n');
  console.log('  Ejemplos:');
  console.log('    node scripts/gen-license.js 97E7-DF66-88AB "Mi Bodega"');
  console.log('    node scripts/gen-license.js 97E7-DF66-88AB "Mi Bodega" 365');
  console.log('    node scripts/gen-license.js 97E7-DF66-88AB "Mi Bodega" trial\n');
  process.exit(1);
}

let dias = null;
if (diasArg === 'trial') {
  dias = 7;
} else if (diasArg) {
  dias = parseInt(diasArg, 10);
  if (isNaN(dias) || dias < 1) {
    console.error('\n  ❌  Los días deben ser un número positivo o "trial"\n');
    process.exit(1);
  }
}

generate(hwid.toUpperCase(), cliente, dias);