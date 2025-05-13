import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 定义文件标记类型
enum FileMarkType {
  READ = 'read',
  PARTIAL = 'partial',
  UNREAD = 'unread'
}

// 文件标记数据结构
interface FileMark {
  type: FileMarkType;
  note: string;
  timestamp: number;
}

// 存储文件标记的全局映射
let fileMarks: Map<string, FileMark> = new Map();

// 存储和加载标记数据的路径
let storageFile: string | undefined;

// 文件装饰器提供者
class FileDecorationsProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  updateDecorations(uri?: vscode.Uri) {
    if (uri) {
      this._onDidChangeFileDecorations.fire(uri);
    } else {
      // 更新所有标记的文件
      const markedUris = Array.from(fileMarks.keys()).map(file => vscode.Uri.file(file));
      if (markedUris.length > 0) {
        this._onDidChangeFileDecorations.fire(markedUris);
      }
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const filePath = uri.fsPath;
    const mark = fileMarks.get(filePath);
    if (!mark) {
      return undefined;
    }

    let badge = '';
    let tooltip = '';
    let color: vscode.ThemeColor | undefined;

    switch (mark.type) {
      case FileMarkType.READ:
        // 使用更鲜艳的图标 - 完成勾选
        badge = '✅';
        tooltip = '已读';
        color = new vscode.ThemeColor('fileMarker.read');
        break;
      case FileMarkType.PARTIAL:
        // 使用更鲜艳的图标 - 半圆
        badge = '🟠';
        tooltip = '部分阅读';
        color = new vscode.ThemeColor('fileMarker.partial');
        break;
      case FileMarkType.UNREAD:
        // 使用更鲜艳的图标 - 感叹号
        badge = '❗';
        tooltip = '未读';
        color = new vscode.ThemeColor('fileMarker.unread');
        break;
    }

    if (mark.note) {
      tooltip += `: ${mark.note}`;
    }

    return {
      badge,
      tooltip,
      color
    };
  }
}

// 保存标记数据到文件
function saveMarks() {
  if (!storageFile) {
    return;
  }

  const data: Record<string, FileMark> = {};
  fileMarks.forEach((value, key) => {
    data[key] = value;
  });

  try {
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2));
  } catch (e) {
    vscode.window.showErrorMessage(`无法保存文件标记: ${e}`);
  }
}

// 从文件加载标记数据
function loadMarks() {
  if (!storageFile || !fs.existsSync(storageFile)) {
    return;
  }

  try {
    const data = fs.readFileSync(storageFile, 'utf-8');
    const parsed = JSON.parse(data);
    fileMarks.clear();
    Object.entries(parsed).forEach(([key, value]) => {
      fileMarks.set(key, value as FileMark);
    });
  } catch (e) {
    vscode.window.showErrorMessage(`无法加载文件标记: ${e}`);
  }
}

// 创建侧边菜单项
class MarkAsQuickPickItem implements vscode.QuickPickItem {
  label: string;
  description: string;
  iconPath?: { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon;
  value: FileMarkType;

  constructor(label: string, description: string, value: FileMarkType, iconPath?: { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon) {
    this.label = label;
    this.description = description;
    this.value = value;
    this.iconPath = iconPath;
  }
}

// 扩展激活时的入口点
export function activate(context: vscode.ExtensionContext) {
  console.log('文件标记扩展已激活');

  // 初始化存储路径
  storageFile = path.join(context.globalStorageUri.fsPath, 'fileMarks.json');

  // 确保存储目录存在
  const storageDir = path.dirname(storageFile);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // 加载保存的标记
  loadMarks();

  // 创建文件装饰器提供者
  const decorationsProvider = new FileDecorationsProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationsProvider)
  );

  // 设置颜色主题贡献 - 更鲜艳的颜色
  vscode.workspace.getConfiguration().update('workbench.colorCustomizations', {
    "fileMarker.read": "#00E676",    // 更鲜艳的绿色
    "fileMarker.partial": "#FF9100", // 更鲜艳的橙色
    "fileMarker.unread": "#FF1744"   // 更鲜艳的红色
  }, vscode.ConfigurationTarget.Global);

  // 标记文件的命令
  const markFileCommand = vscode.commands.registerCommand('fileMarker.markFile', async (uri) => {
    // 获取选中的文件
    const fileUri = uri || (vscode.window.activeTextEditor?.document.uri);
    if (!fileUri) {
      vscode.window.showWarningMessage('未选择文件');
      return;
    }

    const filePath = fileUri.fsPath;
    
    // 创建QuickPick实例以实现侧边弹出效果
    const quickPick = vscode.window.createQuickPick<MarkAsQuickPickItem>();
    quickPick.title = "标记文件状态";
    quickPick.placeholder = "选择文件阅读状态...";
    
    // 添加图标路径
    const iconsFolderPath = context.extensionPath + '/images';
    
    // 创建带有图标的选项
    quickPick.items = [
      new MarkAsQuickPickItem(
        "✅ 已读", 
        "标记为已完成阅读", 
        FileMarkType.READ,
        new vscode.ThemeIcon("check")
      ),
      new MarkAsQuickPickItem(
        "🟠 部分阅读", 
        "标记为部分阅读", 
        FileMarkType.PARTIAL,
        new vscode.ThemeIcon("warning")
      ),
      new MarkAsQuickPickItem(
        "❗ 未读", 
        "标记为未阅读", 
        FileMarkType.UNREAD,
        new vscode.ThemeIcon("error")
      )
    ];

    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (selected) {
        quickPick.hide();
        
        // 请求用户输入笔记
        const note = await vscode.window.showInputBox({
          placeHolder: '可选: 添加备注',
          prompt: '输入关于此文件的笔记或留空'
        });

        // 保存标记
        fileMarks.set(filePath, {
          type: selected.value,
          note: note || '',
          timestamp: Date.now()
        });

        // 更新装饰器
        decorationsProvider.updateDecorations(fileUri);

        // 保存到文件
        saveMarks();
      }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  });

  // 清除文件标记的命令
  const clearMarkCommand = vscode.commands.registerCommand('fileMarker.clearMark', (uri) => {
    // 获取选中的文件
    const fileUri = uri || (vscode.window.activeTextEditor?.document.uri);
    if (!fileUri) {
      vscode.window.showWarningMessage('未选择文件');
      return;
    }

    const filePath = fileUri.fsPath;

    // 删除标记
    if (fileMarks.has(filePath)) {
      fileMarks.delete(filePath);
      decorationsProvider.updateDecorations(fileUri);
      saveMarks();
    }
  });

  // 注册命令
  context.subscriptions.push(markFileCommand, clearMarkCommand);

  // 初始更新所有装饰器
  decorationsProvider.updateDecorations();
}

// 扩展停用时的入口点
export function deactivate() {
  // 保存标记状态
  saveMarks();
}