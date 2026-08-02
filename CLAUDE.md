# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HostRunner is a VS Code **UI extension** (`extensionKind: ["ui"]`) that adds a status bar button to launch a native host application from inside a Dev Container. The entire implementation is one file: `src/extension.ts`.

Because it's UI-mode, its code runs on the machine hosting the VS Code client (not inside the container), which is what lets it read `process.platform` as the *client* OS and shell out to a host process. This is the whole reason the extension exists — see README.md "Why this exists" for the full rationale.

## Commands

- `npm run compile` — type-check, lint, and build to `dist/extension.js` (this is what `check-types` + `lint` + `esbuild` do together)
- `npm run watch` — parallel watch (esbuild + tsc) for development, used by the `watch` VS Code task
- `npm run check-types` — `tsc --noEmit`
- `npm run lint` — `eslint src`
- `npm test` — runs `pretest` (compile-tests, compile, lint) then `vscode-test`, executing `out/test/**/*.test.js`
- `npm run package` — production build (minified, no sourcemaps) for packaging

To run/debug the extension interactively: use the "Run Extension" launch config (F5) — it builds via the default task and opens a second VS Code window with `test-workspace` loaded as the workspace. That launch config sets `HOSTRUNNER_SCRIPT` and `HOSTRUNNER_CMD` env vars directly, which is a convenient way to exercise the env-var-override path without touching real settings.

There is currently only one placeholder test in `src/test/extension.test.ts`; `detectTopology`/`describeTopology`/`isSupported` are not exported from `extension.ts`; if adding real unit tests for them, export what's needed first.

## Architecture

Everything happens in `activate()` in `src/extension.ts`, in this order:

1. **Topology detection** (`detectTopology`): combines `process.platform` with `vscode.env.remoteName` into a discriminated union (`SupportedTopology | unsupported`). Only two combinations are supported: `win32` + `dev-container` (→ `wsl-devcontainer`) and `linux` + `dev-container` (→ `linux-devcontainer`). Everything else — no container, SSH remote, attached (not cloned) container, macOS — is `unsupported`. On unsupported topology the extension logs a fatal message, shows an error notification, and returns early: **no command or status bar item is registered**. It stays inert rather than half-working.
2. **Host path flavour** follows from topology: `wsl-devcontainer` uses `path.win32` (UNC paths, e.g. `\\wsl.localhost\<distro>\...`) and shells out via `powershell.exe` (`cmd.exe` cannot `chdir` into a UNC path); `linux-devcontainer` uses `path.posix` and the default shell.
3. **Config resolution**, done fresh on every button press inside the `hostrunner.runScript` command handler: for each of `root`, `scriptPath`, `scriptRunner`, the corresponding host env var (`HOSTRUNNER_ROOT` / `HOSTRUNNER_SCRIPT` / `HOSTRUNNER_CMD`) always wins over the VS Code setting, uniformly, with no per-variable exceptions. `root` must be absolute (in the platform-appropriate flavour); `scriptPath` must be relative to `root` and is joined onto it. Both violations produce a user-facing error and abort before exec.
4. **Execution**: `child_process.exec` with `cwd: root` and the topology-appropriate shell. The command blocks until the process exits — there's no streaming, and output is buffered in memory (a documented known limitation for long-lived GUI apps).

All diagnostics go to the `HostRunner` output channel, including which source (`env` vs `settings`) each resolved value came from — that's the first place to check when something misbehaves.

### Key invariants to preserve when editing

- The container path (`/workspaces/...`) is never consulted — `root` is host-only.
- Env var override is uniform across all three variables (no special-casing one of them).
- Unsupported topologies must remain fully inert (no command registration), not degraded.
- `scriptPath` absolute-path rejection and `root` absolute-path requirement use `hostPath` (the topology-selected `path.win32`/`path.posix`), not the bare Node `path` module, since the host flavour can differ from the flavour Node itself is running on (WSL topology: Node runs in the container/Linux-like context but paths are Windows/UNC).
