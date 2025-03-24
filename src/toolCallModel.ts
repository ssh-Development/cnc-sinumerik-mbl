import * as vscode from 'vscode';

export class PropertyDefenition {
    number: number = 0;
    range!: vscode.Range;

    constructor(number : number, range: vscode.Range) {
        this.number = number;
        this.range = range;
    }
}