// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PropertyDefenition } from './toolCallModel';

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

	context.subscriptions.push(vscode.commands.registerCommand('cnc-sinumerik-mbl.round', async () => {
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return; // No open text editor
		}

		var document = editor.document;
		var counter = 0;

		const escapeChar = /^\s*\//i;
		const digitsPattern = /[0-9]*\.[0-9]{3}[0-9]+/;

		editor.edit(eb => {
			for (var i = 0; i < document.lineCount; i++) {
				var data = document.lineAt(i).text.split(';')
				var line = document.lineAt(i);

				var pgmLine: string = data[0];
				var pgmComment: string | undefined

				if (data.length > 1) {
					pgmComment = data[data.length - 1];
				}

				if (pgmLine.match(escapeChar)) {
					continue;
				}

				var match = digitsPattern.exec(pgmLine);
				if (match) {
					var range = new vscode.Range(i, match.index, i, match.index + match[0].length);
					var number = Number.parseFloat(match[0]);
					var roundedNumber = Math.round(number * 1000) / 1000;
					eb.replace(range, roundedNumber.toString());
					counter++;
				}
			}
		});

		vscode.window.showInformationMessage(counter + ' Werte gerundet!');

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

				const mpfPattern = /^%_N_(.*)_MPF/i;
				const spfPattern = /^%_N_(.*)_SPF/i;

				const toolPattern = /^\s*WERKZEUG\s*:\s*(([1-9][0-9]{5})|([1-9][0-9]{5})\s+(.+))\s*$/i;
				const tNoPattern = /T_NO\s*=\s*([0-9]+)/i;
				const attNoPattern = /ATT_NO\s*=\s*([0-9]+)/i;
				const seNoPattern = /SE_NO\s*=\s*([0-9]+)/i;

				const infoPattern = /^.*;\s*(.*)/i;
				const msgPattern = /^.*MSG\s*\(\s*"\s*(.*)\s*"\s*\)/i;

				const toolCallPattern = /\s+(L9920|L9923|L9930)/i;

				const escapeChar = /^\s*\//i;

				var tNo = 0;
				var attNo = 0;
				var seNo = 0;

				for (var i = 0; i < document.lineCount; i++) {
					var data = document.lineAt(i).text.split(';')
					var line = document.lineAt(i);

					var pgmLine: string = data[0];
					var pgmComment: string | undefined

					if (data.length > 1) {
						pgmComment = data[data.length - 1];
					}
					else {
						pgmComment = undefined;
					}

					if (pgmLine.match(escapeChar)) {
						continue;
					}

					var match = tNoPattern.exec(pgmLine);
					if (match) {
						tNo = parseInt(match[1]);
					}

					var match = attNoPattern.exec(pgmLine);
					if (match) {
						attNo = parseInt(match[1]);
					}

					var match = seNoPattern.exec(pgmLine);
					if (match) {
						seNo = parseInt(match[1]);
					}



					if (pgmComment) {
						var match = toolPattern.exec(pgmComment);
						if (match) {
							var last = toolCallSymbols.at(-1);
							if (last) {
								last.range = new vscode.Range(last.range.start, line.range.start);
							}

							if (match[2]) {
								var name = 'T ' + match[2];
								var symbol = new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Property, line.range, line.range);
								var last = arcFileSymbols.at(-1);
								if (last) {
									if (name != 'T 0') {
										if (last.children.find(x => x.name == name)) {
											symbol.detail += ' - REP';
										}
									}
									last.children.push(symbol);
								}
								toolCallSymbols.push(symbol);
							}

							if (match[3] && match[4]) {
								var name = 'T ' + match[3];
								var symbol = new vscode.DocumentSymbol(name, match[4], vscode.SymbolKind.Property, line.range, line.range);
								var last = arcFileSymbols.at(-1);
								if (last) {
									if (name != 'T 0') {
										if (last.children.find(x => x.name == name)) {
											symbol.detail += ' - REP';
										}
									}
									last.children.push(symbol);
								}
								toolCallSymbols.push(symbol);
							}
						}
					}


					var match = toolCallPattern.exec(pgmLine);
					if (match) {
						var last = toolCallSymbols.at(-1);
						if (last) {
							last.range = new vscode.Range(last.range.start, line.range.start);
						}

						var name = 'T ' + tNo;

						if (match[1].toUpperCase() == 'L9920' || match[1].toUpperCase() == 'L9923') {
							var symbol = new vscode.DocumentSymbol(name, '- ' + attNo + ' - ' + seNo.toString().replace('9999999', '') + ' - (Hand)', vscode.SymbolKind.Property, line.range, line.range);
						}
						else {
							var symbol = new vscode.DocumentSymbol(name, '- ' + attNo + ' - ' + seNo.toString().replace('9999999', ''), vscode.SymbolKind.Property, line.range, line.range);
						}

						var last = arcFileSymbols.at(-1);
						if (last) {
							if (name != 'T 0') {
								if (last.children.find(x => x.name == name)) {
									symbol.detail += ' - REP';
								}
							}
							last.children.push(symbol);
						}
						toolCallSymbols.push(symbol);
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
			var spfDefinitions = new Map<string, vscode.Range>();

			var includedSpfs = config.get<string[]>('includedSpfs');
			if (includedSpfs) {
				spfs = includedSpfs;
			}

			const spfPattern = /^%_N_(.*)_SPF/i;
			const spfCallPattern = /^\s*(N\d+|)\s*(MCALL|)\s*(L\d+)/i

			const tNoPattern = /T_NO\s*=\s*([0-9]+)/i;
			const attNoPattern = /ATT_NO\s*=\s*([0-9]+)/i;
			const seNoPattern = /SE_NO\s*=\s*([0-9]+)/i;

			const toolCallPattern = /\s+(L9920|L9923|L9930)/i;
			const toolDefPattern = /\s+L9927/i;

			const escapeChar = /^\s*\//i;

			var tNo: PropertyDefenition | undefined;
			var attNo: PropertyDefenition | undefined;
			var seNo: PropertyDefenition | undefined;

			var definedtNo: PropertyDefenition | undefined;
			var definedattNo: PropertyDefenition | undefined;
			var definedseNo: PropertyDefenition | undefined;

			for (var i = 0; i < document.lineCount; i++) {
				var data = document.lineAt(i).text.split(';')
				var line = document.lineAt(i);
				var text = line.text.toUpperCase();
				var pgmLine = data[0].toUpperCase();

				if (pgmLine.match(escapeChar)) {
					continue;
				}

				var match = tNoPattern.exec(pgmLine);
				if (match) {
					var range = new vscode.Range(i, match.index, i, match.index + match[0].length);
					tNo = { number: parseInt(match[1]), range: range };
				}

				var match = attNoPattern.exec(pgmLine);
				if (match) {
					var range = new vscode.Range(i, match.index, i, match.index + match[0].length);
					attNo = { number: parseInt(match[1]), range: range };
				}

				var match = seNoPattern.exec(pgmLine);
				if (match) {
					var range = new vscode.Range(i, match.index, i, match.index + match[0].length);
					seNo = { number: parseInt(match[1]), range: range };
				}

				var match = toolCallPattern.exec(pgmLine);
				if (match) {
					if (definedtNo && tNo) {
						if (definedtNo.number != tNo.number) {
							diagnostics.push({
								code: undefined,
								message: 'Falsches Werkzeug vordefiniert!',
								range: definedtNo.range,
								severity: vscode.DiagnosticSeverity.Warning,
								source: 'Augerufenes Werkzeug ist ' + tNo.number + '.',
								relatedInformation: undefined
							})
						}

						definedtNo = undefined;
					}

					if (definedattNo && attNo) {
						if (definedattNo.number != attNo.number) {
							diagnostics.push({
								code: undefined,
								message: 'Falsches Aggregat vordefiniert!',
								range: definedattNo.range,
								severity: vscode.DiagnosticSeverity.Warning,
								source: 'Augerufenes Aggregat ist ' + attNo.number + '.',
								relatedInformation: undefined
							})
						}

						definedattNo = undefined;
					}

					if (definedseNo && seNo) {
						if (definedseNo.number != seNo.number) {
							diagnostics.push({
								code: undefined,
								message: 'Falscher Adapter vordefiniert!',
								range: definedseNo.range,
								severity: vscode.DiagnosticSeverity.Warning,
								source: 'Augerufener Adapter ist ' + seNo.number + '.',
								relatedInformation: undefined
							})
						}

						definedseNo = undefined;
					}
				}

				var match = toolDefPattern.exec(pgmLine);
				if (match) {
					definedtNo = tNo;
					definedattNo = attNo;
					definedseNo = seNo;
				}

				var match = spfPattern.exec(text)
				if (match) {
					if (spfs.includes(match[1])) {
						if (includedSpfs) {
							if (!includedSpfs.includes(match[1])) {
								diagnostics.push({
									code: undefined,
									message: 'Unterprogramm ist schon deklariert!',
									range: line.range,
									severity: vscode.DiagnosticSeverity.Error,
									source: undefined,
									relatedInformation: undefined
								});
							}

						}
						else {
							diagnostics.push({
								code: undefined,
								message: 'Unterprogramm ist schon deklariert!',
								range: line.range,
								severity: vscode.DiagnosticSeverity.Error,
								source: undefined,
								relatedInformation: undefined
							});
						}
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
