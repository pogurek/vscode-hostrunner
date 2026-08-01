// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
// Import the exec function from Node.js to run system commands
import { exec } from 'child_process';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "hostrunner" is now active!');

    // 1. Create a "Button" in the Status Bar (bottom left of VS Code)
    const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    runButton.text = "$(play) Run HostRunner Script"; // $(play) adds a standard VS Code triangle icon
    runButton.tooltip = "Click to run the script defined in HostRunner settings";
    runButton.command = 'hostrunner.runScript';
    runButton.show();
    
    // Ensure the button is cleaned up when the extension is deactivated
    context.subscriptions.push(runButton);

    // 2. Register the command that the button triggers
    const disposable = vscode.commands.registerCommand('hostrunner.runScript', () => {
        
        // Read settings from the user's settings.json
        const config = vscode.workspace.getConfiguration('hostrunner');
        const scriptPath = config.get<string>('scriptPath');
        const scriptArgs = config.get<string>('scriptArgs');

        // Check if the user has provided a script path
        if (!scriptPath) {
            vscode.window.showErrorMessage('HostRunner: Please define a script path in your VS Code settings (hostrunner.scriptPath).');
            return;
        }

        // Combine the path and arguments (wrapping path in quotes in case of spaces)
        const fullCommand = `"${scriptPath}" ${scriptArgs || ''}`.trim();
        
        vscode.window.showInformationMessage('HostRunner: Executing script...');

        // 3. Execute the script
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`HostRunner Error: ${error.message}`);
                return;
            }
            
            if (stderr) {
                vscode.window.showWarningMessage(`HostRunner Warning: ${stderr}`);
            }
            
            // Print the final output as an information message as requested
            if (stdout) {
                vscode.window.showInformationMessage(`HostRunner Output: ${stdout}`);
            } else {
                vscode.window.showInformationMessage('HostRunner: Script finished successfully (no output).');
            }
        });
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}