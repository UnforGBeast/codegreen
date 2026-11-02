# Releasing

**Rule: a release is published only from signed builds.** Windows and macOS builds must be code-signed (and the macOS build notarized), and the pipeline checks this before and after building. Linux has no OS-level code signing, so Linux files are published with SHA-256 checksums instead.

Everything below is already built. What is left is a one-time account setup and adding the credentials as repository secrets.

## How a release works

1. You set the version in `package.json` (for example `0.1.0-beta.1`) and push a tag that matches it exactly (`v0.1.0-beta.1`). A mismatch stops the run.
2. The **Release** workflow (`.github/workflows/release.yml`) then:
   1. **Checks the credentials** with `scripts/signing-gate.js`. If anything is missing it stops and names what is missing. Nothing is built or published.
   2. **Runs the tests** on Windows, macOS and Linux.
   3. **Builds and signs** each platform, and notarizes the macOS app.
   4. **Verifies the signatures**: Windows must report a `Valid` Authenticode signature on the installer and the app; macOS must pass `codesign`, `spctl` and `stapler validate`. A build that fails this is never released.
   5. **Writes SHA-256 checksums** for every installer.
   6. **Creates a draft release** with the installers, update manifests and checksums. A version with a hyphen (like `-beta.1`) is marked as a pre-release.
3. **You read the draft and press Publish.** Nothing goes public until you do, and the in-app updater only ever sees published releases.

Pull requests that touch the release files, and manual runs with **Dry run** ticked, build the same installers **unsigned** and publish nothing. That is how the pipeline is kept honest without credentials.

## One-time setup

### Windows: Azure Artifact Signing (recommended)

New code-signing certificates from commercial certificate authorities now have to keep their private key on approved hardware (since the CA/Browser Forum change of 1 June 2023). That means you generally cannot download a `.pfx` file to put in a CI secret, and a USB token cannot be plugged into a hosted GitHub runner. The practical route for GitHub-hosted builds is a cloud signing service. This pipeline supports **Azure Artifact Signing** (Microsoft's service, previously called Trusted Signing).

What the research found, which you should confirm on Microsoft's own pages before paying:

- It needs a paid Azure subscription (free, trial and sponsored subscriptions are not supported), and billing starts when the account is created, even if identity validation then fails.
- A vendor blog puts the Basic tier at about $9.99 a month. Verify the current price on Microsoft's pricing page.
- Eligibility is not clear from the sources. Microsoft's Windows guidance says organisations in the USA, Canada, the EU and the UK; other sources say individuals in the USA or Canada can also apply. Check Microsoft's current FAQ for your country and status.

Steps (names change, so follow Microsoft's current documentation):

1. Create an Azure subscription and an **Artifact Signing account**, then complete identity validation.
2. Create a **certificate profile** (public trust).
3. In Microsoft Entra ID, register an application, create a client secret, and give that application the certificate-profile signer role on your signing account.
4. Add the values below to the repository.

| Kind | Name | Value |
|---|---|---|
| Secret | `AZURE_TENANT_ID` | Directory (tenant) ID of the Entra app |
| Secret | `AZURE_CLIENT_ID` | Application (client) ID |
| Secret | `AZURE_CLIENT_SECRET` | The client secret |
| **Variable** | `AZURE_SIGNING_ENDPOINT` | The account's regional endpoint, for example `https://eus.codesigning.azure.net` |
| **Variable** | `AZURE_SIGNING_ACCOUNT` | Artifact Signing account name |
| **Variable** | `AZURE_SIGNING_PROFILE` | Certificate profile name |
| **Variable** | `AZURE_PUBLISHER_NAME` | The publisher name exactly as in the certificate |

The last four are repository **variables** (Settings, Secrets and variables, Actions, Variables), not secrets.

### Windows: a certificate file (only if you can get one)

If your certificate authority still lets you export a key, add `WIN_CSC_LINK` (the base64 of the `.pfx`, or a download link) and `WIN_CSC_KEY_PASSWORD` as secrets instead. The pipeline uses the Azure route whenever `AZURE_SIGNING_ACCOUNT` is set.

### macOS

You need an Apple Developer Program membership (paid annually).

1. Create a **Developer ID Application** certificate and export it from Keychain Access as a `.p12` file. Base64-encode it and add it as `MAC_CSC_LINK`, with its password as `MAC_CSC_KEY_PASSWORD`.
2. For notarization, add **one** of these sets:
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (made at appleid.apple.com) and `APPLE_TEAM_ID`; or
   - an App Store Connect API key: `APPLE_API_KEY` (the `.p8` contents, base64), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`. electron-builder recommends this one for CI.

The app is built with the hardened runtime on, which notarization requires. A stock Electron app needs no extra entitlements.

### Secrets summary

| Needed | For |
|---|---|
| The four Azure variables and three Azure secrets, **or** `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` | Windows |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, and one notarization set | macOS |
| Nothing | Linux (checksums only) |

## Launch checklist

- [ ] Credentials above are added, and **Rehearsal** below passes.
- [ ] A person has run the app by eye on Windows, macOS and Linux (see the manual QA issue, #11, and the cross-platform issue, #1). CI proves it builds and the tests pass; it does not prove the widget looks and behaves right.
- [ ] The Gemini CLI adapter has been checked against a real install, or the README keeps saying it has not (#31).
- [ ] `package.json` version is set and `README.md` / `docs/methodology.md` are current.
- [ ] Tag `v<version>`, wait for the draft release, read it, and press Publish.

### Rehearsal (signed, nothing published)

Run the **Release** workflow by hand from the Actions tab on `main` with **Dry run unticked**. With credentials it does a complete signed build and signature verification but publishes nothing, because it is not on a tag. Without credentials it stops at the first step and tells you exactly what is missing, which is also how you can check the gate.

## Updates for people who install it

The app can check GitHub for a newer release, but that is the only network request it can ever make, so it is **off by default**. In an installed copy, right-click the widget: **Check for updates now** is always available, and **Check for updates automatically** is an opt-in checkbox. A dev checkout never checks. Automatic checks run at start and every 12 hours.

Updates install when the app quits. They only work for **published** releases, and macOS updating needs the app to be signed.

## What is and is not verified

Verified in CI and locally: the tests; the unsigned builds on all three systems; that `electron-updater` and all its dependencies are bundled in the packaged app; the update manifest (`latest.yml`) and the checksums script; the signing gate logic (unit tested); the workflow's syntax and job wiring.

**Not verified, because it needs real credentials or a published release:** an actual Windows signature, an actual macOS notarization, the signature-verification steps against a genuinely signed build, the draft-release step, and an update being found, downloaded and installed by an installed copy. The first rehearsal with real credentials is where these get proven, so expect to fix small things then.
