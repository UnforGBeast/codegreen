const test = require('node:test');
const assert = require('node:assert/strict');
const { missingSigning } = require('../scripts/signing-gate');

const AZURE = {
  AZURE_TENANT_ID: 't', AZURE_CLIENT_ID: 'c', AZURE_CLIENT_SECRET: 's',
  AZURE_SIGNING_ENDPOINT: 'https://eus.codesigning.azure.net', AZURE_SIGNING_ACCOUNT: 'acct',
  AZURE_SIGNING_PROFILE: 'prof', AZURE_PUBLISHER_NAME: 'Someone',
};
const PFX = { WIN_CSC_LINK: 'base64', WIN_CSC_KEY_PASSWORD: 'pw' };
const MAC_CERT = { MAC_CSC_LINK: 'base64', MAC_CSC_KEY_PASSWORD: 'pw' };
const APPLE_ID = { APPLE_ID: 'a@b.c', APPLE_APP_SPECIFIC_PASSWORD: 'pw', APPLE_TEAM_ID: 'TEAM' };
const APPLE_API = { APPLE_API_KEY: 'k', APPLE_API_KEY_ID: 'i', APPLE_API_ISSUER: 'u' };

test('no credentials: both platforms are reported', () => {
  const problems = missingSigning({});
  assert.equal(problems.filter((p) => /Windows/.test(p)).length, 1);
  assert.ok(problems.some((p) => /macOS signing is missing/.test(p)));
  assert.ok(problems.some((p) => /notariz/i.test(p)));
});

test('Azure Artifact Signing is enough for Windows', () => {
  assert.deepEqual(missingSigning({ ...AZURE, ...MAC_CERT, ...APPLE_ID }), []);
});

test('a certificate file is also enough for Windows', () => {
  assert.deepEqual(missingSigning({ ...PFX, ...MAC_CERT, ...APPLE_ID }), []);
});

test('a half-filled Azure setup names exactly what is missing', () => {
  const env = { ...AZURE, ...MAC_CERT, ...APPLE_ID };
  delete env.AZURE_CLIENT_SECRET;
  delete env.AZURE_SIGNING_PROFILE;
  const problems = missingSigning(env);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /AZURE_CLIENT_SECRET/);
  assert.match(problems[0], /AZURE_SIGNING_PROFILE/);
  assert.doesNotMatch(problems[0], /AZURE_TENANT_ID/);
});

test('empty and whitespace values count as missing', () => {
  const problems = missingSigning({ ...PFX, WIN_CSC_KEY_PASSWORD: '   ', ...MAC_CERT, ...APPLE_ID });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Windows/);
});

test('macOS needs the certificate and one notarization credential set', () => {
  assert.deepEqual(missingSigning({ ...AZURE, ...MAC_CERT, ...APPLE_API }), []);
  const noNotarize = missingSigning({ ...AZURE, ...MAC_CERT });
  assert.equal(noNotarize.length, 1);
  assert.match(noNotarize[0], /notariz/i);
  const noCert = missingSigning({ ...AZURE, ...APPLE_ID });
  assert.equal(noCert.length, 1);
  assert.match(noCert[0], /MAC_CSC_LINK/);
});

test('a partial Apple ID set is not enough', () => {
  const problems = missingSigning({ ...AZURE, ...MAC_CERT, APPLE_ID: 'a@b.c' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /notariz/i);
});
