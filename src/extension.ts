import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // 1. Create an Output Channel for production-visible logging
    const outputChannel = vscode.window.createOutputChannel('HostRunner');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('HostRunner is active!');

    // --- One-Time Environment Variable Evaluation ---
    if (process.env.HOSTRUNNER_CMD) {
        outputChannel.appendLine(`[Info] Found host environment variable: HOSTRUNNER_CMD = "${process.env.HOSTRUNNER_CMD}"`);
    } else {
        outputChannel.appendLine(`[Info] Host environment variable HOSTRUNNER_CMD not found.`);
    }

    if (process.env.HOSTRUNNER_SCRIPT) {
        outputChannel.appendLine(`[Info] Found host environment variable: HOSTRUNNER_SCRIPT = "${process.env.HOSTRUNNER_SCRIPT}"`);
    } else {
        outputChannel.appendLine(`[Info] Host environment variable HOSTRUNNER_SCRIPT not found.`);
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

    // Initialize button text and show it
    updateButtonText();
    runButton.show();
    context.subscriptions.push(runButton);

    // Listen for configuration changes to update the button text in real-time
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
        
        // 1. Read Script Runner (Env Var overrides VS Code settings)
        let scriptRunner = config.get<string>('scriptRunner') || '';
        
        if (process.env.HOSTRUNNER_CMD) {
            scriptRunner = process.env.HOSTRUNNER_CMD;
        }
        
        // The relative path of the script inside the repo (e.g., "./scripts/build.sh")
        let scriptPath = config.get<string>('scriptPath');
        const scriptArgs = config.get<string>('scriptArgs') || '';

        if (!scriptPath) {
            vscode.window.showErrorMessage('HostRunner: scriptPath is not defined in settings.');
            outputChannel.appendLine('Error: scriptPath is not defined in settings.');
            return;
        }

        // 2. Resolve the Target CWD
        let targetCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // If the container path doesn't exist on the host, check for a host environment variable!
        if (!fs.existsSync(targetCwd)) {
            const envHostPath = process.env.HOSTRUNNER_SCRIPT;

            if (envHostPath) {
                if (fs.existsSync(envHostPath)) {
                    targetCwd = envHostPath;
                } else {
                    vscode.window.showErrorMessage(
                        `HostRunner: The path defined in HOSTRUNNER_SCRIPT (${envHostPath}) does not exist.`
                    );
                    outputChannel.appendLine(`Error: HOSTRUNNER_SCRIPT is set to '${envHostPath}', but the path does not exist on the host.`);
                    return;
                }
            } else {
                vscode.window.showErrorMessage(
                    'HostRunner: Cannot resolve host path. Please set the HOSTRUNNER_SCRIPT environment variable on your Host OS.'
                );
                outputChannel.appendLine(`Error: Workspace path '${targetCwd}' not found on host OS, and HOSTRUNNER_SCRIPT environment variable is not set.`);
                return;
            }
        }

        // 3. Resolve the script path relative to the newly found host targetCwd
        if (!path.isAbsolute(scriptPath)) {
            scriptPath = path.join(targetCwd, scriptPath);
        }

        // 4. Construct and execute the command
        const fullCommand = scriptRunner 
            ? `${scriptRunner} "${scriptPath}" ${scriptArgs}`.trim()
            : `"${scriptPath}" ${scriptArgs}`.trim();

        // Log the execution details to the Output channel
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