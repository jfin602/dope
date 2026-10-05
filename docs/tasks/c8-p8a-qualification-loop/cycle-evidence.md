# Phase 8A qualification loop evidence

Date: 2026-10-05. Version remains `0.8.6`.

## Baseline before Cycle 1

- The supplied task names `4e73b6b41eec76658353e6500ee63d5c223f3fa5` plus an uncommitted `0.8.6` candidate. That commit exists in the local object store on a parallel history, but is not the current HEAD.
- Actual checkout: clean `7748afde503683fb4005150271663b91779a6a12` (`p8a qual not green`). Its committed source contains the coherent `0.8.6` manifests and the bounded App Server read-only wire repair described in the retained closeout. No candidate files were reset, checked out, discarded, or recreated.
- Starting uncommitted `git diff` SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty diff). There were no untracked files before this evidence log.
- All root/workspace versions and internal `@dope` references inspected as `0.8.6`; no root `package-lock.json`; `git diff --check` passed. Installed reference executable: `codex-cli 0.155.1`.
- Existing retained P6 closeout: `docs/tasks/p8/closeout.md`, Not Green — Evidence Gap. Its 92 initial focused tests, earlier `npm run check`, 58 post-wire-repair focused tests and direct App Server scratch turn are historical evidence, not an exact-final-candidate Green claim.
- Current official OpenAI documentation checked: `https://developers.openai.com/siwc/token-sharing-open-source/sign-in`, `profiles-and-sessions`, `token-reference`, `codex-app-server`, and `errors-and-recovery`.

## Cycle 1

- Pre-cycle candidate: `7748afde503683fb4005150271663b91779a6a12` with only this new evidence log uncommitted.
- First gate: real Dope loopback OAuth callback and account creation, in a no-project browser Dope session with an isolated `XDG_CONFIG_HOME` and application config. The first callback returned the safe browser message `Sign-in failed. Return to Dope and try again.`; no account metadata was created.
- Initial diagnostic instrumentation was built in the extension but not yet in the browser bundle, so the second failed callback added no trustworthy stage evidence. The browser bundle was rebuilt before the next attempt.
- Direct third attempt: listener bound to HTTP `127.0.0.1` with `/auth/callback` before browser launch; authorization used that exact redirect URI. Callback contained code, state, scope, and issued client ID; no OAuth error. State and redirect URI validated, issued client ID accepted, and code exchange succeeded. No `ID token verified` event followed; browser returned the same failure message. No account metadata was created. Failure is within ID-token verification, including its OIDC/JWKS calls, before credentials are saved.
- The current official OpenAI sign-in contract confirms the loopback, issued-client, exchange, and ID-token verification requirements. Direct fetch of current OIDC discovery returned the expected issuer, an `auth.openai.com` JWKS URI, `RS256`, and four public signing keys. No token or private credential values were recorded.
- Fourth direct authorization confirmed a successful callback and token exchange. Boolean-only checks showed `alg`, key ID, issuer, nonce, subject, expiry, and not-before all valid; the token's `aud` was an array while Dope required a scalar string. The signature/JWKS stage was not reached. The browser returned failure again.
- Direct defect: scalar-only audience comparison in `CodexAuthManager.identity`. Repair accepts a string equal to the issued client ID or a nonempty string array containing that issued ID. It still rejects mismatched and malformed audiences. The current official ID-token guidance uses audience validation against the issued client ID; array audience is consistent with JWT audience semantics.
- Permanent focused regression added for a matching audience array, plus negative cases for mismatched and malformed arrays. No other ID-token check was relaxed. Extension and browser rebuilds, 11 focused auth tests, and `git diff --check` passed.
- Replay on the repaired browser bundle: callback again contained code/state/scope/issued client ID, passed state/redirect and issued-client checks, then returned the browser failure message before `authorization code exchange succeeded`. No HTTP status diagnostic was emitted and no account metadata was saved. This is a newly observed blocker at token request/response handling; the audience repair was not reached on this replay. A separate credential-free POST with an invalid grant to the same official token endpoint returned HTTP 400 JSON, proving basic endpoint reachability but not this attempt's exchange.
- Files changed this cycle: `packages/theia-extension/src/node/codex-auth-manager.ts` (safe opt-in stage diagnostics and array audience validation), `test/unit/codex-auth.test.ts` (focused positive/negative audience regression), and this evidence log. Next blocker: characterize the code-exchange failure without credential logging.
