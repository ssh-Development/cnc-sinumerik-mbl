// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

let diagnosticCollection: vscode.DiagnosticCollection;
const config = vscode.workspace.getConfiguration('cnc-sinumerik-mbl');

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

	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('sinumerik', {
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

				const infoPattern = /^.*;\s*(.*)/i;
				const msgPattern = /^.*MSG\s*\(\s*"\s*(.*)\s*"\s*\)/i;

				const toolCallPattern = /\s+(L9920|L9923|L9930)/i;

				var tNo = 0;
				var attNo = 0;
				var seNo = 0;

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
							var symbol = new vscode.DocumentSymbol('T ' + match[2], '', vscode.SymbolKind.Property, line.range, line.range);
							toolCallSymbols.push(symbol);
							var last = arcFileSymbols.at(-1);
							if (last) {
								last.children.push(symbol);
							}
						}

						if (match[3] && match[4]) {
							var symbol = new vscode.DocumentSymbol('T ' + match[3], match[4], vscode.SymbolKind.Property, line.range, line.range);
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

						if (match[1].toUpperCase() == 'L9920' || match[1].toUpperCase() == 'L9923') {
							var symbol = new vscode.DocumentSymbol('T ' + tNo, '- ' + attNo + ' - ' + seNo.toString().replace('9999999', '') + ' - (Hand)', vscode.SymbolKind.Property, line.range, line.range);
						}
						else {
							var symbol = new vscode.DocumentSymbol('T ' + tNo, '- ' + attNo + ' - ' + seNo.toString().replace('9999999', ''), vscode.SymbolKind.Property, line.range, line.range);
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
						var spfInfo = null;
						if (document.lineCount >= i + 2) {
							match = infoPattern.exec(document.lineAt(i + 2).text);
							if (match) { spfInfo = match[1]; }
						}

						if (!spfInfo) {
							if (document.lineCount >= i + 2) {
								match = msgPattern.exec(document.lineAt(i + 2).text);
								if (match) { spfInfo = match[1]; }
							}
						}

						if (!spfInfo) {
							if (document.lineCount >= i + 3) {
								match = msgPattern.exec(document.lineAt(i + 3).text);
								if (match) { spfInfo = match[1]; }
							}
						}

						if (spfInfo) {
							var symbol = new vscode.DocumentSymbol(spfName.replaceAll('_', ' '), spfInfo, vscode.SymbolKind.Module, line.range, line.range)
							symbols.push(symbol);
							arcFileSymbols.push(symbol);
						}
						else {
							var symbol = new vscode.DocumentSymbol(spfName.replaceAll('_', ' '), '', vscode.SymbolKind.Module, line.range, line.range)
							symbols.push(symbol);
							arcFileSymbols.push(symbol);
						}
					}

				}

				resolve(symbols);
			});
		}
	}));

	context.subscriptions.push(vscode.languages.registerDefinitionProvider('sinumerik', {
		provideDefinition(document: vscode.TextDocument,
			position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
			return new Promise((resolve, reject) => {
				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);

				if (/L\d+/i.test(word)) {
					const pattern = new RegExp('^%_N_' + word.toUpperCase() + '_SPF', 'i');
					for (var i = 0; i < document.lineCount; i++) {
						var line = document.lineAt(i);

						if (line.text.match(pattern)) {
							resolve(new vscode.Location(document.uri, line.range))
						}
					}
				}

			})
		}
	}));

	diagnosticCollection = vscode.languages.createDiagnosticCollection('go');
	context.subscriptions.push(diagnosticCollection);

	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
	}

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, diagnosticCollection);
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor => {
		if (editor) {
			updateDiagnostics(editor.document, diagnosticCollection);
		}
	}));

}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	if (document)
		if (document.languageId == 'sinumerik') {
			collection.clear();
			var diagnostics: vscode.Diagnostic[] = [];
			var spfs: string[] = [];
			var spfDefinitions =new Map<string, vscode.Range>();

			var includedSpfs = config.get<string[]>('includedSpfs');
			if (includedSpfs) {
				spfs = includedSpfs;
			}

			const spfPattern = /^%_N_(.*)_SPF/i;
			const spfCallPattern = /^\s*(N\d+|)\s*(MCALL|)\s*(L\d+)/i

			for (var i = 0; i < document.lineCount; i++) {
				var line = document.lineAt(i);
				var text = line.text.toUpperCase();

				var match = spfPattern.exec(text)
				if (match) {
					if (spfs.includes(match[1])) {
						diagnostics.push({
							code: undefined,
							message: 'Unterprogramm ist schon deklariert!',
							range: line.range,
							severity: vscode.DiagnosticSeverity.Error,
							source: undefined,
							relatedInformation: undefined
						});
					}
					else {
						spfs.push(match[1]);
						spfDefinitions.set(match[1], line.range);
					}
				}
			}

			for (var i = 0; i < document.lineCount; i++) {
				var line = document.lineAt(i);
				var text = line.text.toUpperCase();

				var match = spfCallPattern.exec(text)
				if (match) {
					spfDefinitions.delete(match[3])
					if (!spfs.includes(match[3])) {
						diagnostics.push({
							code: undefined,
							message: 'Unterprogramm ist nicht vorhanden!',
							range: line.range,
							severity: vscode.DiagnosticSeverity.Warning,
							source: undefined,
							relatedInformation: undefined
						});
					}
				}
			}

			spfDefinitions.forEach(element => {
				diagnostics.push({
					code: undefined,
					message: 'Unterprogramm wird nie verwendet!',
					range: element,
					severity: vscode.DiagnosticSeverity.Information,
					source: undefined,
					relatedInformation: undefined
				});
			});

			collection.set(document.uri, diagnostics);
		} else {
			collection.clear();
		}
}

// This method is called when your extension is deactivated
export function deactivate() { }
