import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('HostRunner is active!');

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

        const config = vscode.workspace.getConfiguration('hostrunner');
        
        // 1. Read Script Runner (Env Var overrides VS Code settings)
        const scriptRunner = process.env.HOSTRUNNER_CMD || config.get<string>('scriptRunner') || '';
        
        // The relative path of the script inside the repo (e.g., "./scripts/build.sh")
        let scriptPath = config.get<string>('scriptPath');
        const scriptArgs = config.get<string>('scriptArgs') || '';

        if (!scriptPath) {
            vscode.window.showErrorMessage('HostRunner: scriptPath is not defined in settings.');
            return;
        }

        // 2. Resolve the Target CWD
        let targetCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // If the container path doesn't exist on the host, check for a host environment variable!
        if (!fs.existsSync(targetCwd)) {
            const envHostPath = process.env.HOSTRUNNER_SCRIPT;

            if (envHostPath && fs.existsSync(envHostPath)) {
                targetCwd = envHostPath;
            } else {
                vscode.window.showErrorMessage(
                    'HostRunner: Cannot resolve host path. Please set the HOSTRUNNER_SCRIPT environment variable on your Host OS.'
                );
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

        console.log(`[HostRunner] Host Execution CWD: ${targetCwd}`);
        console.log(`[HostRunner] Command: ${fullCommand}`);

        exec(fullCommand, { cwd: targetCwd }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`HostRunner Error: ${error.message}`);
                return;
            }
            if (stderr) {
                vscode.window.showWarningMessage(`HostRunner Warning: ${stderr}`);
            }
            vscode.window.showInformationMessage(`HostRunner Output: ${stdout || 'Success'}`);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }