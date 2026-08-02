import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

// --- Topology ---
type SupportedTopology =
    | { kind: 'wsl-devcontainer'; platform: NodeJS.Platform; remoteName: string }
    | { kind: 'linux-devcontainer'; platform: NodeJS.Platform; remoteName: string };

type Topology =
    | SupportedTopology
    | { kind: 'unsupported'; platform: NodeJS.Platform; remoteName?: string };

function detectTopology(platform: NodeJS.Platform, remoteName: string | undefined): Topology {
    // NOTE: UI-mode extension => platform is the *client* OS, not the container's.
    if (remoteName === 'dev-container') {
        // Assumption: Windows client + devcontainer => docker daemon in WSL.
        if (platform === 'win32') {
            return { kind: 'wsl-devcontainer', platform, remoteName };
        }
        if (platform === 'linux') {
            return { kind: 'linux-devcontainer', platform, remoteName };
        }
    }
    return { kind: 'unsupported', platform, remoteName };
}

function describeTopology(t: Topology): string {
    switch (t.kind) {
        case 'wsl-devcontainer':
            return `WSL → devcontainer (platform=${t.platform}, remote=${t.remoteName})`;
        case 'linux-devcontainer':
            return `Linux → devcontainer (platform=${t.platform}, remote=${t.remoteName})`;
        case 'unsupported':
            return `unsupported (platform=${t.platform}, remote=${t.remoteName ?? 'none'})`;
        default:
            return absurd(t);
    }
}

function isSupported(t: Topology): t is SupportedTopology {
    return t.kind !== 'unsupported';
}

// --- Exhaustiveness helper ---
// Statically unreachable: if this fails to compile, a union variant is unhandled.
function absurd(x: never): never {
    throw new Error(`unreachable: ${JSON.stringify(x)}`);
}

export function activate(context: vscode.ExtensionContext) {
    // 1. Create an Output Channel for production-visible logging
    const outputChannel = vscode.window.createOutputChannel('HostRunner');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('HostRunner is active!');

    // --- Log Execution Context ---
    const topology = detectTopology(process.platform, vscode.env.remoteName);
    outputChannel.appendLine(`[Environment] Detected topology: ${describeTopology(topology)}`);

    // --- Guard: refuse to operate outside the two supported topologies ---
    if (!isSupported(topology)) {
        const message =
            'HostRunner: unsupported environment. This extension requires a dev container ' +
            'opened from a Windows (WSL) or Linux client. ' +
            `Detected: ${describeTopology(topology)}.`;
        outputChannel.appendLine(`[Fatal] ${message}`);
        outputChannel.appendLine('[Fatal] Extension disabled — no commands or UI registered.');
        vscode.window.showErrorMessage(message);
        return; // nothing else is registered; the extension is inert
    }

    // From here on, `topology` is narrowed to SupportedTopology.
    outputChannel.appendLine(`[Environment] Supported topology confirmed: ${topology.kind}`);

    // Host path flavour depends on the client OS:
    //   wsl-devcontainer   -> Windows client, root is \\wsl.localhost\<distro>\... (UNC)
    //   linux-devcontainer -> Linux client,   root is /home/... (POSIX)
    const isWindowsHost = topology.kind === 'wsl-devcontainer';
    const hostPath = isWindowsHost ? path.win32 : path.posix;

    // cmd.exe cannot chdir into a UNC path; PowerShell can.
    const execShell = isWindowsHost ? 'powershell.exe' : undefined;
    outputChannel.appendLine(`[Environment] Host path flavour: ${isWindowsHost ? 'win32 (UNC)' : 'posix'}`);
    outputChannel.appendLine(`[Environment] Exec shell: ${execShell ?? 'default'}`);

    // --- Assign Environment Variables & Report ---
    const envCmd = process.env.HOSTRUNNER_CMD;
    const envScript = process.env.HOSTRUNNER_SCRIPT;
    const envRoot = process.env.HOSTRUNNER_ROOT;

    if (envCmd) {
        outputChannel.appendLine(`[Info] Found host env var: HOSTRUNNER_CMD = "${envCmd}"`);
    } else {
        outputChannel.appendLine(`[Info] Host env var HOSTRUNNER_CMD not found.`);
    }

    if (envScript) {
        outputChannel.appendLine(`[Info] Found host env var: HOSTRUNNER_SCRIPT = "${envScript}"`);
    } else {
        outputChannel.appendLine(`[Info] Host env var HOSTRUNNER_SCRIPT not found.`);
    }

    if (envRoot) {
        outputChannel.appendLine(`[Info] Found host env var: HOSTRUNNER_ROOT = "${envRoot}"`);
    } else {
        outputChannel.appendLine(`[Info] Host env var HOSTRUNNER_ROOT not found.`);
    }
    outputChannel.appendLine('--------------------------------------------------');

    const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    runButton.command = 'hostrunner.runScript';

    // Function to update the button text based on configuration
    const updateButtonText = () => {
        const config = vscode.workspace.getConfiguration('hostrunner');
        const customLabel = config.get<string>('buttonLabel')?.trim();

        if (customLabel) {
            runButton.text = `$(play) ${customLabel}`;
        } else {
            runButton.text = `$(play) Run HostRunner Script`;
        }
    };

    updateButtonText();
    runButton.show();
    context.subscriptions.push(runButton);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('hostrunner.buttonLabel')) {
                updateButtonText();
            }
        })
    );

    const disposable = vscode.commands.registerCommand('hostrunner.runScript', () => {
        outputChannel.appendLine(`\n--- Button Pressed ---`);
        outputChannel.appendLine(`[Environment] Topology: ${topology.kind}`);

        const config = vscode.workspace.getConfiguration('hostrunner');
        const settingsCmd = config.get<string>('scriptRunner') || '';
        const settingsScript = config.get<string>('scriptPath') || '';
        const settingsRoot = config.get<string>('root') || '';
        const scriptArgs = config.get<string>('scriptArgs') || '';

        // 1. Resolve runner command (env wins over settings; optional)
        const finalCmd = envCmd || settingsCmd;
        if (finalCmd) {
            outputChannel.appendLine(`[Config] Script runner: "${finalCmd}" (${envCmd ? 'env' : 'settings'})`);
        } else {
            outputChannel.appendLine(`[Config] No script runner; script is executed directly.`);
        }

        // 2. Resolve root (env wins over settings; required, absolute host path)
        const root = envRoot || settingsRoot;
        if (!root) {
            const msg = 'HostRunner: root is not defined (HOSTRUNNER_ROOT or hostrunner.root).';
            vscode.window.showErrorMessage(msg);
            outputChannel.appendLine(`[Error] ${msg}`);
            return;
        }
        if (!hostPath.isAbsolute(root)) {
            const msg = isWindowsHost
                ? `HostRunner: root must be an absolute Windows/UNC path (e.g. \\\\wsl.localhost\\<distro>\\home\\...). Provided: "${root}"`
                : `HostRunner: root must be an absolute POSIX path. Provided: "${root}"`;
            vscode.window.showErrorMessage(msg);
            outputChannel.appendLine(`[Error] ${msg}`);
            return;
        }
        outputChannel.appendLine(`[Config] Root: "${root}" (${envRoot ? 'env' : 'settings'})`);

        // 3. Resolve script path (env wins over settings; always relative to root)
        const rawScriptPath = envScript || settingsScript;
        if (!rawScriptPath) {
            const msg = 'HostRunner: script path is not defined (HOSTRUNNER_SCRIPT or hostrunner.scriptPath).';
            vscode.window.showErrorMessage(msg);
            outputChannel.appendLine(`[Error] ${msg}`);
            return;
        }
        if (hostPath.isAbsolute(rawScriptPath)) {
            const msg = `HostRunner: script path must be relative to root. Provided: "${rawScriptPath}"`;
            vscode.window.showErrorMessage(msg);
            outputChannel.appendLine(`[Error] ${msg}`);
            return;
        }
        const finalScriptPath = hostPath.join(root, rawScriptPath);
        outputChannel.appendLine(`[Config] Script: "${rawScriptPath}" (${envScript ? 'env' : 'settings'}) -> "${finalScriptPath}"`);

        // 4. Construct and execute the command; CWD is always the root
        const fullCommand = finalCmd
            ? `${finalCmd} "${finalScriptPath}" ${scriptArgs}`.trim()
            : `"${finalScriptPath}" ${scriptArgs}`.trim();

        outputChannel.appendLine(`Working Directory: ${root}`);
        outputChannel.appendLine(`Executing Command: ${fullCommand}`);

        exec(fullCommand, { cwd: root, shell: execShell }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`HostRunner Error: ${error.message}`);
                outputChannel.appendLine(`Execution Error: ${error.message}`);
                return;
            }
            if (stderr) {
                vscode.window.showWarningMessage(`HostRunner Warning: ${stderr}`);
                outputChannel.appendLine(`Stderr Warning:\n${stderr}`);
            }

            vscode.window.showInformationMessage(`HostRunner Output: ${stdout || 'Success'}`);
            outputChannel.appendLine(`Stdout: ${stdout || 'Success'}`);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }