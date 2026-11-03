# Security policy

Freshwater reads local log files from your AI coding tools, so the things that matter most here are privacy and what the app can be made to do with those files.

## Supported versions

Freshwater is pre-release and has no published release yet. Reports are accepted against `main` and, once releases exist, the latest release.

## Reporting a vulnerability

**Please do not open a public issue.** Email **atahusain123@gmail.com** with the subject `Freshwater security`, and include:

- what the problem is and what an attacker could do with it
- steps to reproduce it
- the commit or version, and your operating system

Use made-up data in your report. Do not send real conversation logs.

Freshwater has one maintainer, so replies are best effort, and there is no bounty. Once a problem is confirmed, the fix is prepared in private and then published with an advisory. You will be credited if you want to be.

## What counts

- Conversation text or other log content being stored, shown or sent anywhere. The app should only ever read usage numbers and timestamps.
- Any network request other than the opt-in update check.
- A crafted log, ledger or settings file that leads to code execution, or that gets past the renderer's isolation and Content Security Policy.
- Weaknesses in the update path, the signed installers or the release workflow.

## What does not

- Wrong or inflated figures from a hand-edited log or ledger. That is an ordinary bug.
- Disagreement with the estimate. Use the **Challenge a number** issue form.
- Problems in Electron or another dependency that cannot be reached through Freshwater. Report those upstream.
