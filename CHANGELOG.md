# Changelog

All notable changes to the "hostrunner" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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