exports.activate = context => {
    const vscode = require('vscode');
    context.subscriptions.push(vscode.commands.registerCommand('dope-evidence.uppercase', text => String(text).toUpperCase()));
};
