# Phase 00X: Implement Automated Prompt Pushing (macOS MVP)

Created: 2025-06-02T23:00:00Z <!-- PST is UTC-7; 4 PM PST on June 2 is 11 PM UTC -->
Depends: none <!-- Assuming core context generation and webview UI are in place -->
Enables: phase-PromptPushWindows, future-PromptPushAdvancedFeatures

## Goal

Enable users on macOS to send their generated prompt from the Prompt Tower webview to a selected AI service (ChatGPT, Claude, Gemini, AI Studio) in their default browser (Chrome targeted) with a single click. The prompt should be automatically pasted into the AI service's input field and then submitted.

## Success Criteria

**For macOS Users:**

1.  **One-Click Push:** A "Push Prompt" button in the webview, when clicked:
    - Copies the fully generated prompt (including prefix/suffix and selected files/issues context) to the system clipboard.
    - Opens the selected AI service (ChatGPT, Claude, Gemini, or AI Studio) in a new tab in Google Chrome.
    - The new tab/browser window comes into focus.
    - The copied prompt is automatically pasted into the AI service's primary text input field.
    - The appropriate submit action (Enter or Cmd+Enter, depending on the service) is automatically simulated.
2.  **Provider Selection:** User can select the target AI service (ChatGPT, Claude, Gemini, AI Studio) from a dropdown in the webview, and the push action targets the correct URL and uses the correct submit keystroke.
3.  **Works with Existing Browser Session:** The new tab opens within the user's existing Google Chrome session, utilizing their current logins for the AI services.
4.  **No Browser Restart Required:** The feature functions without requiring the user to restart Chrome or manually launch it with special debugging flags.
5.  **User Feedback:** Clear notifications are provided in VS Code for:
    - Copying to clipboard.
    - Opening the browser.
    - The attempt to paste/submit.
    - Errors encountered during the process.
6.  **Permissions Guidance:** If an action fails in a way that suggests macOS Accessibility/Automation permissions are needed for VS Code, the user is informed and guided on how to grant them (e.g., via a notification with a link to documentation or a modal dialog).

## Context & Learnings from SPIKE

- This feature directly addresses GitHub Issue #19 ("Automated prompt pushing").
- The goal is to streamline the workflow of getting context from VS Code into an AI chat interface.
- **SPIKE Learnings (macOS):**
  - Confirmed feasibility using `pbcopy` (or `vscode.env.clipboard.writeText`), `open -a "Google Chrome" <URL>`, and `osascript` to execute AppleScript for keystroke simulation (Cmd+V, Enter/Cmd+Enter).
  - macOS Accessibility and Automation permissions are **mandatory** for VS Code to control Chrome via AppleScript. User guidance for this one-time setup is essential.
  - The `open` command generally brings the new tab/browser to focus, and target AI sites often auto-focus their input fields.
  - A short, fixed internal delay in the AppleScript (after opening the URL and activating Chrome) is a pragmatic necessity to allow the page to load and input field to focus before simulating keystrokes. This delay should be optimized for a "good enough for most" experience without being user-configurable initially.
- Windows and Linux implementations are deferred to subsequent phases due to requiring different OS-level automation techniques. This phase focuses on delivering a functional MVP for macOS users.
