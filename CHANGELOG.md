# Changelog

All notable changes to the "hostrunner" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8] - 2026-08-02

### Added
- Topology detection combining the client OS (`process.platform`) with `vscode.env.remoteName` to distinguish the two supported setups: **WSL → Dev Container** (Windows client) and **Linux → Dev Container** (native Linux client). The detected topology is reported at startup and on every execution.
- Hard activation guard: in any other environment the extension logs a fatal diagnostic, shows an error notification, and registers no command, status bar item, or configuration listener.
- Setting `hostrunner.root` (overridable by the `HOSTRUNNER_ROOT` environment variable) defining the host-side repository root. It serves as both the working directory of the launched process and the base for script path resolution.
- Platform-aware path handling driven by the detected topology: UNC paths (`\\wsl.localhost\<distro>\...`) on a Windows client, POSIX paths on a Linux client. Forward slashes in `hostrunner.scriptPath` are normalised for the host, so the same value works in both topologies.
- Workspace URI and decoded remote authority logging at startup to expose the host-side path behind a Dev Container workspace.

### Changed
- **Breaking:** `hostrunner.scriptPath` and `HOSTRUNNER_SCRIPT` must now be relative to `hostrunner.root`; absolute paths are rejected. The former rule requiring `HOSTRUNNER_SCRIPT` to be absolute is reversed.
- **Breaking:** the working directory is now always `hostrunner.root`. The workspace folder is no longer consulted, and the CWD fallback heuristic from 0.0.6 has been removed.
- Uniform precedence for all inputs: environment variable wins over workspace setting, for the runner, the root, and the script path alike. The path-source tracking introduced in 0.0.6 is no longer needed.
- PowerShell is used as the execution shell on a Windows client, since `cmd.exe` cannot change directory into a UNC path and would silently start the process in `C:\Windows`.
- Settings descriptions rewritten with per-topology path examples and cross-links; `hostrunner.root`, `hostrunner.scriptRunner`, and `hostrunner.buttonLabel` are now `machine-overridable` in scope.

### Fixed
- Spurious warning notification when a script wrote only a newline to stderr, and trailing blank lines in output notifications; stdout and stderr are now trimmed before reporting.
- Host filesystem existence check removed. It could never succeed on a Windows client inspecting a Linux path, so the CWD fallback it guarded fired unconditionally in the WSL topology.

## [0.0.7] - 2026-08-02

### Added
- Remote context logging at startup using `vscode.env.remoteName` to immediately identify if the extension is running locally, in a Dev Container, or another remote environment.

## [0.0.6] - 2026-08-02

### Added
- Smart Current Working Directory (CWD) fallback logic: If the VS Code workspace path does not exist on the host OS (e.g., when running inside a Dev Container), the extension safely defaults to the script's parent directory.
- Path source tracking to independently handle routing rules for environment variables versus workspace settings.

### Changed
- Enforced strict absolute paths for the `HOSTRUNNER_SCRIPT` environment variable to prevent host/container pathing conflicts.
- Preserved relative path support for workspace settings, resolving them directly against the workspace root.

### Fixed
- Resolved `spawn /bin/sh ENOENT` execution errors that occurred when the extension attempted to run host commands within container-specific workspace directories (like `/workspace`).

## [0.0.5] - 2026-08-02

### Added
- Dedicated "HostRunner" Output Channel for production-visible background logging.
- One-time startup evaluation and logging of `HOSTRUNNER_CMD` and `HOSTRUNNER_SCRIPT` environment variables to simplify debugging.
- Detailed execution logging, which records the resolved working directory, the full command, and standard output/errors into the Output Channel upon every button press.

## [0.0.4] - 2026-08-02

### Added
- Support for host environment variables (`HOSTRUNNER_SCRIPT` and `HOSTRUNNER_CMD`) to allow per-user path resolution and script runner overrides, specifically fixing host path targeting when running inside Dev Containers.

## [0.0.3] - 2026-08-02

### Added
- Explicitly set `"extensionKind": ["ui"]` in `package.json` to ensure the extension runs on the local host machine. This allows the extension to execute scripts locally even when the workspace is open inside a Dev Container or a remote environment.

## [0.0.2] - 2026-08-02

### Added
- Configuration setting `hostrunner.buttonLabel` to allow users to override the default status bar button text (updates dynamically without requiring a window reload).

## [0.0.1] - 2026-08-02

### Added
- A status bar button (`▶ Run HostRunner Script`) to easily trigger external scripts or applications directly from the editor.
- Configuration settings `hostrunner.scriptPath` and `hostrunner.scriptArgs` to define the target executable and its arguments via `settings.json`.
- Native VS Code notification popups to display script execution results (stdout), warnings (stderr), and system errors.