# Dope Pi runtime foundation (P12/P1)

This directory is a separate npm package because Pi 1.4.0 is ESM, while the
Theia backend compiles to CommonJS. `package-lock.json` pins the official Pi
release and every transitive tarball. `npm run prepare:pi-runtime` performs an
app-owned, script-free `npm ci` during build preparation. Electron packaging
copies this directory to `process.resourcesPath/app/pi-runtime`; the backend
resolves that exact path or the repository path during development. Nothing is
installed when Dope starts, and the host never searches `PATH` for `pi`.

The supervised ESM worker imports the SDK inside a separate process rather
than importing it into Theia's CommonJS backend. This makes Pi import or
runtime failure fail the worker without taking down Theia. The host rejects
pending requests on exit and requires an explicit new host to recover. The
worker uses in-memory settings and session storage, an empty resource loader,
and no tools. It requires an explicit loopback model descriptor before it can
construct a session. P2 owns exact AI Center model mapping; P3–P6 own live
routing, brokered tools, transcript and recovery. P7 must verify a pristine
AppImage, including native and asset loading from `extraResources`.

See `NOTICE.md` and `LICENSE.pi` for provenance and license review.
