// src/models/FileItem.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class FileItem extends vscode.TreeItem {
    public isChecked: boolean;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly filePath: string,
        isChecked: boolean = false
    ) {
        super(label, collapsibleState);
        this.isChecked = isChecked;
        this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.None ? 'file' : 'folder';
        this.updateCheckState(isChecked);

        // Set file icons based on file extension
        if (this.contextValue === 'file') {
            this.resourceUri = vscode.Uri.file(filePath);
            this.iconPath = vscode.ThemeIcon.File;
        } else {
            this.iconPath = new vscode.ThemeIcon('folder');
        }

        // Add tooltip with file path
        this.tooltip = filePath;

        // Add description showing file extension for files
        if (this.contextValue === 'file') {
            const ext = path.extname(filePath);
            if (ext) {
                this.description = ext;
            }
        }
    }

    updateCheckState(checked: boolean) {
        this.isChecked = checked;
        this.checkboxState = {
            state: checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked
        };
    }
}