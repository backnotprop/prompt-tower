import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Supported editor types for automation
 */
export type EditorType = "cursor" | "vscode";

/**
 * Automation targets within editors
 */
export type AutomationTarget = "agent" | "ask" | "copilot";

/**
 * Result of an editor automation attempt
 */
export interface AutomationResult {
  success: boolean;
  editorType: EditorType;
  target: AutomationTarget;
  error?: string;
  requiresPermissions?: boolean;
}

/**
 * Configuration for individual automation steps
 */
interface AutomationCommand {
  type: "command" | "paste" | "submit" | "delay";
  command?: string;
  delay?: number;
  keystroke?: string;
}

/**
 * Editor configuration for automation
 */
interface EditorConfig {
  editorType: EditorType;
  target: AutomationTarget;
  openCommand: string;
  pasteCommand: string;
  submitKeystroke: string;
  openDelay: number;
  pasteDelay: number;
}

/**
 * Service for automating interactions with code editors (Cursor, VS Code)
 */
export class EditorAutomationService {
  private readonly AUTOMATION_DELAY = 375; // Default delay for UI settling
  private readonly PASTE_DELAY = 750; // Default delay after paste

  constructor() {}

  /**
   * Send content to specified editor and target
   */
  async sendToEditor(
    editorType: EditorType,
    target: AutomationTarget,
    content: string
  ): Promise<AutomationResult> {
    if (!this.isPlatformSupported()) {
      return {
        success: false,
        editorType,
        target,
        error: "Editor automation is currently only supported on macOS",
      };
    }

    try {
      // Copy content to clipboard first
      await vscode.env.clipboard.writeText(content);

      // Get editor configuration
      const config = this.getEditorConfig(editorType, target);
      if (!config) {
        return {
          success: false,
          editorType,
          target,
          error: `Unsupported editor/target combination: ${editorType}/${target}`,
        };
      }

      // Generate and execute automation commands
      const commands = this.generateCommands(config);
      await this.executeCommands(commands);

      return {
        success: true,
        editorType,
        target,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for permission-related errors
      const isPermissionError =
        errorMessage.includes("not authorized") ||
        errorMessage.includes("accessibility") ||
        errorMessage.includes("permission");

      return {
        success: false,
        editorType,
        target,
        error: errorMessage,
        requiresPermissions: isPermissionError,
      };
    }
  }

  /**
   * Check if the current platform supports automation
   */
  isPlatformSupported(): boolean {
    return process.platform === "darwin";
  }

  /**
   * Detect which editors are likely available (future enhancement)
   */
  detectAvailableEditors(): EditorType[] {
    // TODO: Implement editor detection logic
    // For now, assume both are potentially available
    return ["cursor", "vscode"];
  }

  /**
   * Get editor configuration based on type and target
   */
  private getEditorConfig(
    editorType: EditorType,
    target: AutomationTarget
  ): EditorConfig | null {
    if (editorType === "cursor") {
      switch (target) {
        case "agent":
          return {
            editorType,
            target,
            openCommand: "composer.newAgentChat",
            pasteCommand: "editor.action.clipboardPasteAction",
            submitKeystroke: "return",
            openDelay: this.AUTOMATION_DELAY,
            pasteDelay: this.PASTE_DELAY,
          };
        case "ask":
          return {
            editorType,
            target,
            openCommand: "composer.newAsk", // TODO: Verify this command
            pasteCommand: "editor.action.clipboardPasteAction",
            submitKeystroke: "return",
            openDelay: this.AUTOMATION_DELAY,
            pasteDelay: this.PASTE_DELAY,
          };
        default:
          return null;
      }
    }

    if (editorType === "vscode") {
      switch (target) {
        case "copilot":
          return {
            editorType,
            target,
            openCommand: "workbench.action.chat.open", // TODO: Verify this command
            pasteCommand: "editor.action.clipboardPasteAction",
            submitKeystroke: "return",
            openDelay: this.AUTOMATION_DELAY,
            pasteDelay: this.PASTE_DELAY,
          };
        default:
          return null;
      }
    }

    return null;
  }

  /**
   * Generate automation commands based on configuration
   */
  private generateCommands(config: EditorConfig): AutomationCommand[] {
    return [
      {
        type: "command",
        command: config.openCommand,
      },
      {
        type: "delay",
        delay: config.openDelay,
      },
      {
        type: "command",
        command: config.pasteCommand,
      },
      {
        type: "delay",
        delay: config.pasteDelay,
      },
      {
        type: "submit",
        keystroke: config.submitKeystroke,
      },
    ];
  }

  /**
   * Execute a series of automation commands
   */
  private async executeCommands(commands: AutomationCommand[]): Promise<void> {
    for (const command of commands) {
      switch (command.type) {
        case "command":
          if (command.command) {
            console.log(`Executing VS Code command: ${command.command}`);
            await vscode.commands.executeCommand(command.command);
          }
          break;

        case "delay":
          if (command.delay) {
            console.log(`Waiting ${command.delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, command.delay));
          }
          break;

        case "paste":
          console.log("Executing paste command...");
          await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
          break;

        case "submit":
          if (command.keystroke) {
            console.log(`Sending keystroke: ${command.keystroke}`);
            await this.sendKeystroke(command.keystroke);
          }
          break;
      }
    }
  }

  /**
   * Send a keystroke using platform-specific automation
   */
  private async sendKeystroke(keystroke: string): Promise<void> {
    if (process.platform === "darwin") {
      await this.macOSKeystroke(keystroke);
    } else {
      throw new Error("Keystroke automation not implemented for this platform");
    }
  }

  /**
   * Send keystroke on macOS using AppleScript
   */
  private async macOSKeystroke(keystroke: string): Promise<void> {
    const script = `
      tell application "System Events"
        keystroke ${keystroke}
      end tell
    `;

    await execAsync(`osascript -e '${script}'`);
  }

  /**
   * Future: Windows keystroke implementation
   */
  private async windowsKeystroke(keystroke: string): Promise<void> {
    // TODO: Implement Windows automation using PowerShell or other method
    throw new Error("Windows automation not yet implemented");
  }

  /**
   * Get display name for editor type
   */
  getEditorDisplayName(editorType: EditorType): string {
    switch (editorType) {
      case "cursor":
        return "Cursor";
      case "vscode":
        return "VS Code";
      default:
        return editorType;
    }
  }

  /**
   * Get display name for automation target
   */
  getTargetDisplayName(target: AutomationTarget): string {
    switch (target) {
      case "agent":
        return "Agent Chat";
      case "ask":
        return "Ask";
      case "copilot":
        return "Copilot Chat";
      default:
        return target;
    }
  }
}