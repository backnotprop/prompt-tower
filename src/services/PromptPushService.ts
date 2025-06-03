import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Supported AI providers for prompt pushing
 */
export type AIProvider = "chatgpt" | "claude" | "gemini" | "aistudio";

/**
 * Provider configuration for URL mapping and submit behavior
 */
interface ProviderConfig {
  url: string;
  submitKey: string; // AppleScript keystroke command
  displayName: string;
}

/**
 * Result of a prompt push attempt
 */
export interface PushResult {
  success: boolean;
  provider: AIProvider;
  error?: string;
  requiresPermissions?: boolean;
  fallbackToClipboard?: boolean;
}

/**
 * Service for pushing prompts to AI providers via browser automation
 */
export class PromptPushService {
  private readonly providers: Record<AIProvider, ProviderConfig> = {
    chatgpt: {
      url: "https://chat.openai.com",
      submitKey: "keystroke return", // Enter key for ChatGPT
      displayName: "ChatGPT"
    },
    claude: {
      url: "https://claude.ai",
      submitKey: "keystroke return", // Enter key for Claude
      displayName: "Claude"
    },
    gemini: {
      url: "https://gemini.google.com/app",
      submitKey: "keystroke return", // Enter key for Gemini
      displayName: "Gemini"
    },
    aistudio: {
      url: "https://aistudio.google.com",
      submitKey: "keystroke return using command down", // Cmd+Enter for AI Studio
      displayName: "AI Studio"
    }
  };

  private readonly AUTOMATION_DELAY = 1.5; // Seconds to wait before automation
  private readonly FOCUS_DELAY = 0.3; // Seconds for focus settling

  constructor() {}

  /**
   * Get automation settings from VS Code configuration
   */
  private getAutomationSettings() {
    const config = vscode.workspace.getConfiguration("promptTower.automation");
    return {
      defaultBrowser: config.get<string>("defaultBrowser", "chrome"),
      automationDelay: config.get<number>("automationDelay", this.AUTOMATION_DELAY),
      focusDelay: config.get<number>("focusDelay", this.FOCUS_DELAY)
    };
  }

  /**
   * Push a prompt to the specified AI provider
   */
  async pushPrompt(
    provider: AIProvider, 
    promptText: string,
    autoSubmit: boolean = true
  ): Promise<PushResult> {
    const config = this.providers[provider];
    if (!config) {
      return {
        success: false,
        provider,
        error: `Unsupported provider: ${provider}`
      };
    }

    // Check platform support
    if (process.platform !== "darwin") {
      return {
        success: false,
        provider,
        error: "Automated prompt pushing is currently only supported on macOS",
        fallbackToClipboard: true
      };
    }

    try {
      // Get current settings
      const settings = this.getAutomationSettings();
      
      // First, copy prompt to clipboard (VS Code API is more reliable)
      await vscode.env.clipboard.writeText(promptText);
      
      // Open the provider URL in browser
      await this.openProviderInBrowser(config.url, settings.defaultBrowser);
      
      // Wait for page load, then automate paste and optionally submit
      await this.automatePromptSubmission(config.submitKey, autoSubmit, settings);
      
      return {
        success: true,
        provider
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for permission-related errors
      const isPermissionError = errorMessage.includes("not authorized") || 
                               errorMessage.includes("accessibility") ||
                               errorMessage.includes("permission");
      
      return {
        success: false,
        provider,
        error: errorMessage,
        requiresPermissions: isPermissionError,
        fallbackToClipboard: true
      };
    }
  }

  /**
   * Open the provider URL in the specified browser
   */
  private async openProviderInBrowser(url: string, browserChoice: string): Promise<void> {
    try {
      let command: string;
      
      if (browserChoice === "chrome") {
        command = `open -a "Google Chrome" "${url}"`;
      } else {
        command = `open "${url}"`;
      }
      
      await execAsync(command);
    } catch (error) {
      // Fallback to default browser if specified browser isn't available
      const fallbackCommand = `open "${url}"`;
      await execAsync(fallbackCommand);
    }
  }

  /**
   * Automate the paste and submit actions using AppleScript
   */
  private async automatePromptSubmission(
    submitKey: string, 
    autoSubmit: boolean = true, 
    settings?: { automationDelay: number, focusDelay: number, defaultBrowser: string }
  ): Promise<void> {
    const automationDelay = settings?.automationDelay ?? this.AUTOMATION_DELAY;
    const focusDelay = settings?.focusDelay ?? this.FOCUS_DELAY;
    const browserChoice = settings?.defaultBrowser ?? "chrome";
    
    const appleScript = `
      tell application "System Events"
        -- Wait for browser and page to load
        delay ${automationDelay}
        
        -- Ensure browser is frontmost
        try
          ${browserChoice === "chrome" ? 'activate application "Google Chrome"' : 'tell application "System Events" to set frontApp to name of first process whose frontmost is true\n          activate application frontApp'}
        on error
          -- Fallback to any browser
          tell application "System Events" to set frontApp to name of first process whose frontmost is true
          activate application frontApp
        end try
        
        -- Wait for focus to settle
        delay ${focusDelay}
        
        -- Paste from clipboard (Cmd+V)
        keystroke "v" using command down
        
        ${autoSubmit ? `
        -- Brief pause before submit
        delay ${focusDelay}
        
        -- Submit (Enter or Cmd+Enter depending on provider)
        ${submitKey}
        ` : '-- Auto-submit disabled, only pasting'}
      end tell
    `;

    await execAsync(`osascript -e '${appleScript}'`);
  }

  /**
   * Check if the current platform supports automation
   */
  isPlatformSupported(): boolean {
    return process.platform === "darwin";
  }

  /**
   * Get the display name for a provider
   */
  getProviderDisplayName(provider: AIProvider): string {
    return this.providers[provider]?.displayName || provider;
  }

  /**
   * Get all supported providers
   */
  getSupportedProviders(): AIProvider[] {
    return Object.keys(this.providers) as AIProvider[];
  }

  /**
   * Test if automation permissions are available (macOS only)
   */
  async testAutomationPermissions(): Promise<boolean> {
    if (process.platform !== "darwin") {
      return false;
    }

    try {
      // Simple test: try to get frontmost application
      const testScript = `
        tell application "System Events"
          set frontApp to name of first process whose frontmost is true
          return frontApp
        end tell
      `;
      
      await execAsync(`osascript -e '${testScript}'`);
      return true;
    } catch (error) {
      return false;
    }
  }
}