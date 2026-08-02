# HostRunner

HostRunner adds a status bar button that launches a **native host application** from inside a Dev Container workspace.

## Why this exists

When you develop inside a Dev Container, everything VS Code does happens in the container: the terminal, the tasks, the debugger. That is usually what you want — but not always.

Some tools cannot live in the container. Vendor GUI applications (debuggers, flash tools, IDE front-ends), licence-dongle software, and anything that needs direct USB or driver access has to run on the host, and on Windows hosts it is frequently a Windows binary. Launching such a tool means leaving the editor, finding the right window, and pointing the application at a source tree that lives somewhere entirely different from the `/workspaces/...` path the container sees.

HostRunner closes that gap. It runs as a **UI extension**, so its code executes on the machine where the VS Code client runs — not in the container — and it launches a host process with a host working directory. One button, no window switching, no manual path translation.

The concrete case it was built for: a Windows client attached to a Dev Container whose Docker daemon lives in WSL, launching a Windows application that reads the project sources through the `\\wsl.localhost\` share.

## Supported topologies

The extension deliberately supports exactly two arrangements, determined at startup by combining the client OS with the remote context:

| Client OS (`process.platform`) | `vscode.env.remoteName` | Topology |
|---|---|---|
| `win32` | `dev-container` | **WSL → Dev Container** |
| `linux` | `dev-container` | **Linux → Dev Container** |

Anything else — a local window with no container, an SSH remote, a WSL window without a container, a macOS client — is rejected. The extension logs a fatal diagnostic, shows an error notification, and registers no button and no command. It stays inert rather than half-working.

The detection is possible precisely because the extension is UI-mode: `process.platform` reports the *client* OS, not the container's. `remoteName` alone cannot distinguish the two supported cases, since it reads `dev-container` in both.

## Requirements

* VS Code 1.125.0 or newer, with the Dev Containers extension.
* A workspace opened in a Dev Container (not "Attach to Running Container").
* On a Windows client: the project tree reachable at `\\wsl.localhost\<distro>\...`, which is the default for a Docker daemon running inside WSL.
* The target application must exist **on the host**, resolvable via the host `PATH` or given as an absolute host path.
* If you launch a script rather than a binary, the host interpreter must be able to read it over the share. On a Windows client that means a Windows interpreter reading a `\\wsl.localhost\` path — the script is *not* executed inside WSL.

## Path model

Three ideas, and they are simpler than in previous versions of this extension:

1. **`root` is an absolute host path.** It is the working directory of the launched process and the base for everything else.
2. **`scriptPath` is always relative to `root`.** Absolute values are rejected.
3. **The container path is never used.** `/workspaces/...` means nothing to a host process, so the workspace folder is not consulted at all.

The path flavour follows from the topology. On a Windows client, `root` is a UNC path and joining uses Windows rules; on a Linux client, both are POSIX. Forward slashes in `scriptPath` are normalised either way, so `./scripts/app.py` is correct on both.

## Settings

| Setting | Required | Description |
|---|---|---|
| `hostrunner.root` | yes | Absolute host path to the repository root. Working directory and resolution base. |
| `hostrunner.scriptPath` | yes | Script path, relative to `root`. |
| `hostrunner.scriptRunner` | no | Host executable used to launch the script. Empty runs the script directly. |
| `hostrunner.scriptArgs` | no | Arguments appended after the script path, passed through the host shell unquoted. |
| `hostrunner.buttonLabel` | no | Status bar text. Empty gives `▶ Run HostRunner Script`. |

All settings default to an empty string; there is no implicit fallback for `root` or `scriptPath`, and the command reports an error if either is missing.

`root`, `scriptRunner`, and `buttonLabel` are `machine-overridable` in scope, because they describe the host rather than the project. `scriptPath` and `scriptArgs` are ordinary window-scoped settings and belong in the repository.

## Override strategy

Each of the three path-like inputs can come from either a setting or a host environment variable:

| Setting | Environment variable |
|---|---|
| `hostrunner.root` | `HOSTRUNNER_ROOT` |
| `hostrunner.scriptPath` | `HOSTRUNNER_SCRIPT` |
| `hostrunner.scriptRunner` | `HOSTRUNNER_CMD` |

**The environment variable always wins.** The rule is uniform across all three — there are no per-variable exceptions.

The variables are read from the environment of the **host VS Code process**, which is why they can carry host-specific values that would be wrong if committed to a repository. The intended division of labour: commit `scriptPath` and `scriptArgs` to `.vscode/settings.json` so the whole team shares them, and let each developer set `HOSTRUNNER_ROOT` (and `HOSTRUNNER_CMD`, if their tool lives elsewhere) to match their own machine. Setting the variables requires restarting VS Code, since the environment is captured at process start.

## Example configuration

### Windows client, WSL → Dev Container

```json
{
    "hostrunner.root": "\\\\wsl.localhost\\Ubuntu\\home\\pete\\github\\embedded-cmake-devcontainer",
    "hostrunner.scriptPath": "./scripts/app.py",
    "hostrunner.scriptRunner": "python.exe",
    "hostrunner.scriptArgs": "--target frdm-mcxn947",
    "hostrunner.buttonLabel": "Launch Debugger"
}
```

Backslashes are doubled because JSON escapes them — a UNC path beginning `\\` is written `\\\\` in the file. The launched process gets `\\wsl.localhost\Ubuntu\home\pete\github\embedded-cmake-devcontainer` as its working directory.

### Linux client, native → Dev Container

```json
{
    "hostrunner.root": "/home/pete/github/embedded-cmake-devcontainer",
    "hostrunner.scriptPath": "./scripts/app.py",
    "hostrunner.scriptRunner": "python3",
    "hostrunner.scriptArgs": "--target frdm-mcxn947",
    "hostrunner.buttonLabel": "Launch Debugger"
}
```

Note that `scriptPath` and `scriptArgs` are identical in both — only the host-specific settings differ, which is exactly the split the setting scopes encourage.

## Diagnostics

Everything the extension does is written to the **HostRunner** output channel (View → Output → HostRunner). At startup it records the detected topology and the resolved environment variables; on each button press it records the source of every resolved value (`env` or `settings`), the final script path, the working directory, the exact command, and the process output.

If something does not behave, that log is the first place to look — in particular the `[Config]` lines, which show whether a value came from a setting or was overridden by the environment.

## Known limitations

* **Attached containers are not supported.** `remoteName` reads `attached-container` there, which fails the topology check.
* **`scriptArgs` is not quoted for you.** It is appended verbatim, so quote arguments containing spaces yourself.
* **The command blocks until the process exits.** For a long-lived GUI application the success notification appears only when you close it, and output accumulates in memory.
* **9P share throughput is limited.** A Windows tool that scans many small files under `\\wsl.localhost\` will be noticeably slower than the same tool on NTFS.