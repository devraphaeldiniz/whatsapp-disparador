const test = require('node:test');
const assert = require('node:assert');

test('Validação de ambiente e dependências básicas', () => {
  const db = require('../src/database/db');
  assert.ok(db, 'Módulo de banco de dados deve existir');
});
