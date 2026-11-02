// Checks that every credential a signed release needs is present. Used by the Release workflow
// as its first step; it exits 1 with one readable error per problem. See docs/releasing.md.
const has = (env, k) => typeof env[k] === 'string' && env[k].trim() !== '';
const missing = (env, keys) => keys.filter((k) => !has(env, k));

const AZURE = [
  'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET',
  'AZURE_SIGNING_ENDPOINT', 'AZURE_SIGNING_ACCOUNT', 'AZURE_SIGNING_PROFILE', 'AZURE_PUBLISHER_NAME',
];
const PFX = ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'];
const MAC_CERT = ['MAC_CSC_LINK', 'MAC_CSC_KEY_PASSWORD'];
const APPLE_ID = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
const APPLE_API = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];

// Returns a list of problems; an empty list means a signed release can go ahead.
function missingSigning(env) {
  const problems = [];

  const azureGaps = missing(env, AZURE);
  const pfxGaps = missing(env, PFX);
  if (azureGaps.length && pfxGaps.length) {
    // report against whichever option is closest to complete
    const useAzure = azureGaps.length / AZURE.length <= pfxGaps.length / PFX.length && azureGaps.length < AZURE.length;
    problems.push(
      useAzure
        ? `Windows signing is incomplete. Azure Artifact Signing is missing: ${azureGaps.join(', ')}.`
        : `Windows signing is not set up. Provide either Azure Artifact Signing (${AZURE.join(', ')}) or a certificate file (${PFX.join(', ')}).`
    );
  }

  const certGaps = missing(env, MAC_CERT);
  if (certGaps.length) problems.push(`macOS signing is missing: ${certGaps.join(', ')}.`);
  if (missing(env, APPLE_ID).length && missing(env, APPLE_API).length) {
    problems.push(
      `macOS notarization needs either ${APPLE_ID.join(', ')} or ${APPLE_API.join(', ')}.`
    );
  }
  return problems;
}

if (require.main === module) {
  const problems = missingSigning(process.env);
  if (problems.length) {
    for (const p of problems) console.log(`::error title=Releases are signed builds only::${p} See docs/releasing.md.`);
    process.exit(1);
  }
  console.log('All signing credentials are present.');
}

module.exports = { missingSigning };
