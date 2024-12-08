// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('cnc-sinumerik-mbl.activate', () => {
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return; // No open text editor
		}

		vscode.languages.setTextDocumentLanguage(editor.document, "sinumerik");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('cnc-sinumerik-mbl.number', async () => {
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return; // No open text editor
		}

		var document = editor.document;
		let i = 0;
		const result = await vscode.window.showQuickPick(['1', '2', '5', '10'], {
			placeHolder: 'Schrittfolge...',
		});

		if (result) {
			var numberSpan = parseInt(result);
			if (Number.isNaN(numberSpan)) {
				return;
			}

			const mpfPattern = /^%_N_(.*)_MPF/i;
			const spfPattern = /^%_N_(.*)_SPF/i;
			const commentPattern = /^\s*;/;
			const emptyPattern = /^\s*$/;
			const startWhitespacePattern = /^\s*/;
			const lineNumberPattern = /^\s*N\s*[0-9]*\s*/i;

			editor.edit(eb => {
				var lineNumber = numberSpan;
				for (var i = 0; i < document.lineCount; i++) {
					var line = document.lineAt(i);

					if (line.text.match(mpfPattern)) {
						lineNumber = numberSpan;
						continue;
					}

					if (line.text.match(spfPattern)) {
						lineNumber = numberSpan;
						continue;
					}

					var match = line.text.match(lineNumberPattern);
					if (match) {
						var range = new vscode.Range(i, 0, i, match[0].length);
						eb.replace(range, 'N' + lineNumber + ' ');
						lineNumber += numberSpan;
					}
					else {
						if (!line.text.match(commentPattern) && !line.text.match(emptyPattern)) {
							var match = line.text.match(startWhitespacePattern);
							if (match) {
								var range = new vscode.Range(i, 0, i, match[0].length);
								eb.replace(range, 'N' + lineNumber + ' ');
								lineNumber += numberSpan;
							}
							else {
								var position = new vscode.Position(i, 0);
								eb.insert(position, 'N' + lineNumber + ' ');
								lineNumber += numberSpan;
							}
						}
					}
				}
			});
		}
	}));

	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider("sinumerik", {
		provideDocumentSymbols(document: vscode.TextDocument,
			token: vscode.CancellationToken): Thenable<vscode.DocumentSymbol[]> {
			return new Promise((resolve, reject) => {
				var symbols: vscode.DocumentSymbol[] = [];
				var arcFileSymbols: vscode.DocumentSymbol[] = [];
				var toolCallSymbols: vscode.DocumentSymbol[] = [];
				var nomPosCallSymbols: vscode.DocumentSymbol[] = [];

				const mpfPattern = /^%_N_(.*)_MPF/i;
				const spfPattern = /^%_N_(.*)_SPF/i;

				const toolPattern = /^.*;\s*WERKZEUG\s*:\s*(([1-9][0-9]{5})|([1-9][0-9]{5})\s+(.+))\s*$/i;

				const tNoPattern = /T_NO\s*=\s*([0-9]+)/i;
				const attNoPattern = /ATT_NO\s*=\s*([0-9]+)/i;
				const seNoPattern = /SE_NO\s*=\s*([0-9]+)/i;

				const toolCallPattern = /(L9920|L9923|L9930)/i;

				var tNo = 0;
				var attNo = 0;
				var seNo = 0;

				var nomPosC = 0;

				for (var i = 0; i < document.lineCount; i++) {
					var line = document.lineAt(i);

					var match = tNoPattern.exec(line.text);
					if (match) {
						tNo = parseInt(match[1]);
					}

					var match = attNoPattern.exec(line.text);
					if (match) {
						attNo = parseInt(match[1]);
					}

					var match = seNoPattern.exec(line.text);
					if (match) {
						seNo = parseInt(match[1]);
					}

					var match = toolPattern.exec(line.text);
					if (match) {
						var last = toolCallSymbols.at(-1);
						if (last) {
							last.range = new vscode.Range(last.range.start, line.range.start);
						}

						if (match[2]) {
							var symbol = new vscode.DocumentSymbol('T' + match[2], '', vscode.SymbolKind.Property, line.range, line.range);
							toolCallSymbols.push(symbol);
							var last = arcFileSymbols.at(-1);
							if (last) {
								last.children.push(symbol);
							}
						}

						if (match[3] && match[4]) {
							var symbol = new vscode.DocumentSymbol('T' + match[3], match[4], vscode.SymbolKind.Property, line.range, line.range);
							toolCallSymbols.push(symbol);
							var last = arcFileSymbols.at(-1);
							if (last) {
								last.children.push(symbol);
							}
						}
					}


					var match = toolCallPattern.exec(line.text);
					if (match) {
						var last = toolCallSymbols.at(-1);
						if (last) {
							last.range = new vscode.Range(last.range.start, line.range.start);
						}

						if (match[1].toUpperCase() != 'L9930') {
							var symbol = new vscode.DocumentSymbol('T' + tNo, '  ' + attNo + '  ' + seNo.toString().replace('9999999', '') + ' (Handwechsel)', vscode.SymbolKind.Property, line.range, line.range);
						}
						else {
							var symbol = new vscode.DocumentSymbol('T' + tNo, '  ' + attNo + '  ' + seNo.toString().replace('9999999', ''), vscode.SymbolKind.Property, line.range, line.range);
						}


						toolCallSymbols.push(symbol);
						var last = arcFileSymbols.at(-1);
						if (last) {
							last.children.push(symbol);
						}
					}

					var match = mpfPattern.exec(line.text);
					if (match) {
						var last = arcFileSymbols.at(-1);
						if (last) {
							last.range = new vscode.Range(last.range.start, line.range.start);
						}

						var mpfName = match[1];
						var symbol = new vscode.DocumentSymbol(mpfName.replaceAll('_', ' '), '', vscode.SymbolKind.Field, line.range, line.range)
						symbols.push(symbol);
						arcFileSymbols.push(symbol);
					}

					var match = spfPattern.exec(line.text);
					if (match) {
						var last = arcFileSymbols.at(-1);
						if (last) {
							last.range = new vscode.Range(last.range.start, line.range.start);
						}

						var spfName = match[1];
						var symbol = new vscode.DocumentSymbol(spfName.replaceAll('_', ' '), '', vscode.SymbolKind.Module, line.range, line.range)
						symbols.push(symbol);
						arcFileSymbols.push(symbol);
					}

				}

				resolve(symbols);
			});
		}
	}));

}

// This method is called when your extension is deactivated
export function deactivate() { }
