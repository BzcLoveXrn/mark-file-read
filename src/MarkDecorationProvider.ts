import MarkManager from "./MarkManager";
import * as vscode from 'vscode';

class MarkDecorationProvider implements vscode.FileDecorationProvider {
  private markManager: MarkManager;

  constructor(markManager: MarkManager) {
    this.markManager = markManager;
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const mark = this.markManager.getMark(uri.fsPath);
    if (!mark) return;

    return {
      badge: mark.label,
      tooltip: mark.note || mark.label,
      color: new vscode.ThemeColor('editorGutter.modifiedBackground')
    };
  }
}
