import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    // 1. Create an Output Channel for production-visible logging
    const outputChannel = vscode.window.createOutputChannel('HostRunner');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('HostRunner is active!');

    // --- Assign Environment Variables & Report ---
    const envCmd = process.env.HOSTRUNNER_CMD;
    const envScript = process.env.HOSTRUNNER_SCRIPT;

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

        const config = vscode.workspace.getConfiguration('hostrunner');
        const settingsCmd = config.get<string>('scriptRunner') || '';
        const settingsScript = config.get<string>('scriptPath') || '';
        const scriptArgs = config.get<string>('scriptArgs') || '';

        // 1. Resolve Command
        let finalCmd = '';
        if (envCmd) {
            finalCmd = envCmd;
            outputChannel.appendLine(`[Config] Using script runner from HOSTRUNNER_CMD: "${finalCmd}"`);
        } else if (settingsCmd) {
            finalCmd = settingsCmd;
            outputChannel.appendLine(`[Config] Using script runner from settings: "${finalCmd}"`);
        }

        // 2. Resolve Script Path & Track Source
        let rawScriptPath = '';
        let isFromEnv = false;

        if (envScript) {
            rawScriptPath = envScript;
            isFromEnv = true;
            outputChannel.appendLine(`[Config] Using script path from HOSTRUNNER_SCRIPT: "${rawScriptPath}"`);
        } else if (settingsScript) {
            rawScriptPath = settingsScript;
            isFromEnv = false;
            outputChannel.appendLine(`[Config] Using script path from settings: "${rawScriptPath}"`);
        }

        if (!rawScriptPath) {
            vscode.window.showErrorMessage('HostRunner: Script path is not defined in environment variables or settings.');
            outputChannel.appendLine('Error: Script path is not defined.');
            return;
        }

        // 3. Process Path based on Source
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        let finalScriptPath = '';

        if (isFromEnv) {
            // Environment variable MUST be absolute
            if (!path.isAbsolute(rawScriptPath)) {
                vscode.window.showErrorMessage(`HostRunner: HOSTRUNNER_SCRIPT must be an absolute path. Provided: "${rawScriptPath}"`);
                outputChannel.appendLine(`[Error] Env var script path is not absolute: "${rawScriptPath}"`);
                return;
            }
            finalScriptPath = rawScriptPath;
            outputChannel.appendLine(`[Path] Env var path is absolute. Used as is: "${finalScriptPath}"`);
        } else {
            // Settings path can be relative or absolute
            if (path.isAbsolute(rawScriptPath)) {
                finalScriptPath = rawScriptPath;
                outputChannel.appendLine(`[Path] Settings path is absolute. Used as is: "${finalScriptPath}"`);
            } else {
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage('HostRunner: Cannot resolve relative settings path because no workspace folder is open.');
                    outputChannel.appendLine('Error: Relative settings path provided, but no workspace is open.');
                    return;
                }
                finalScriptPath = path.join(workspaceRoot, rawScriptPath);
                outputChannel.appendLine(`[Path] Settings path is relative. Concatenated with workspace: "${finalScriptPath}"`);
            }
        }

        // 4. Define Working Directory (CWD)
        let targetCwd = workspaceRoot;
        
        // If there is no workspace, or it's a container path that doesn't exist on the host OS
        if (!targetCwd || !fs.existsSync(targetCwd)) {
            targetCwd = path.dirname(finalScriptPath);
            outputChannel.appendLine(`[Path] Workspace root not found on host OS. Falling back to script directory for CWD: "${targetCwd}"`);
        }

        // 5. Construct and execute the command
        const fullCommand = finalCmd 
            ? `${finalCmd} "${finalScriptPath}" ${scriptArgs}`.trim()
            : `"${finalScriptPath}" ${scriptArgs}`.trim();

        // Log the execution details
        outputChannel.appendLine(`Working Directory: ${targetCwd}`);
        outputChannel.appendLine(`Executing Command: ${fullCommand}`);
        
        exec(fullCommand, { cwd: targetCwd }, (error, stdout, stderr) => {
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