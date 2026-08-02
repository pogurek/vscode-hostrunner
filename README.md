# HostRunner

HostRunner is a lightweight VS Code extension that adds a convenient status bar button to execute an external script or application directly from your editor. Built with Dev Containers and remote workspaces in mind, it guarantees execution on your local host machine, reading script locations and arguments from your workspace settings while displaying output natively in VS Code notifications.

## Features

* **One-Click Execution:** Adds a status bar button (default: `▶ Run HostRunner Script`) to trigger your commands.
* **Customizable UI:** Dynamically change the button text without reloading the window.
* **Workspace Configurable:** Easily switch scripts, runners, or arguments on a per-project basis using your workspace `settings.json`.
* **Dev Container / Remote Ready:** Runs strictly as a UI extension, meaning it always executes commands on your local host machine, even when connected to a Dev Container or remote workspace.
* **Environment Variable Overrides:** Allows per-user path and command overrides via host environment variables (`HOSTRUNNER_SCRIPT` and `HOSTRUNNER_CMD`), solving path mismatch issues in containerized environments.
* **Output Integration & Logging:** Captures stdout/stderr via native VS Code popup notifications and logs complete execution details to a dedicated Output Channel for debugging.

## Requirements

To ensure the extension can successfully run your script:
1. The script must be executable by your operating system (e.g., `chmod +x /path/to/script` on Linux/macOS).
2. If your script uses a shebang (like `#!/usr/bin/env python`), ensure the executing environment has access to that binary, or use an absolute path in the shebang (e.g., `#!/absolute/path/to/uv run`).

## Extension Settings

You can configure the following attributes in your VS Code settings (either globally or in your workspace's `.vscode/settings.json`):

* `hostrunner.scriptPath` **(Required)**: The path to the script or application you want to execute. Can be absolute or relative to the workspace root.
  * *Example:* `"/opt/hostapp/app"`, `"./scripts/build.sh"`
* `hostrunner.scriptArgs` *(Optional)*: A string containing the arguments to pass to the script when executed.
  * *Example:* `"--verbose --all"`
* `hostrunner.scriptRunner` *(Optional)*: The executable used to run the script.
  * *Example:* `"bash"`, `"python3"`, `"sh"`
* `hostrunner.buttonLabel` *(Optional)*: Custom text for the status bar button. 
  * *Example:* `"Build Firmware"` or `"Deploy to Dev"`

**Example `.vscode/settings.json`:**
```json
{
    "hostrunner.scriptPath": "./scripts/deploy.sh",
    "hostrunner.scriptArgs": "--force",
    "hostrunner.scriptRunner": "bash",
    "hostrunner.buttonLabel": "Deploy Project"
}