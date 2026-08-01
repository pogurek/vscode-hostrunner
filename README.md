# HostRunner

HostRunner is a lightweight VS Code extension that adds a convenient status bar button to execute an external script or application directly from your editor. It reads the script's location and arguments from your workspace settings and displays the output in VS Code notifications.

## Features

* **One-Click Execution:** Adds a `▶ Run HostRunner Script` button to the bottom-left status bar.
* **Workspace Configurable:** Easily switch scripts or arguments on a per-project basis using your workspace `settings.json`.
* **Output Integration:** Captures standard output (stdout) and standard error (stderr) and displays them natively in VS Code information and warning messages.

## Requirements

To ensure the extension can successfully run your script:
1. The script must be executable by your operating system (e.g., `chmod +x /path/to/script` on Linux/macOS).
2. If your script uses a shebang (like `#!/usr/bin/env python`), ensure the executing environment has access to that binary, or use an absolute path in the shebang (e.g., `#!/absolute/path/to/uv run`).

## Extension Settings

For the status bar button to work, you **must** configure the following attributes in your VS Code settings (either globally or in your workspace's `.vscode/settings.json`):

* `hostrunner.scriptPath`: The absolute path to the script or application you want to execute.
  * *Example:* `"/opt/hostapp/app"` or `"/usr/bin/echo"`
* `hostrunner.scriptArgs`: A string containing the arguments to pass to the script when executed.
  * *Example:* `"Pete"` or `"--verbose --all"`

**Example `.vscode/settings.json`:**
```json
{
    "hostrunner.scriptPath": "/opt/hostapp/app",
    "hostrunner.scriptArgs": "Pete"
}