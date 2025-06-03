# Phase 00X: Implement Automated Prompt Pushing (Cross-Platform)

Created: 2025-06-02T23:00:00Z
Depends: none
Enables: future-PromptPushAdvancedFeatures

## Goal

Enable users on **macOS and Windows** to send their generated prompt from the Prompt Tower webview to a selected AI service (ChatGPT, Claude, Gemini, AI Studio) in their default browser (Chrome targeted) with a single click. The prompt should be automatically pasted into the AI service's input field and then submitted.

## Success Criteria

**Core Functionality (Applicable to both macOS and Windows upon their respective implementation):**

1.  **One-Click Push:** A "Push Prompt" button in the webview, when clicked:
    - Copies the fully generated prompt (including prefix/suffix and selected files/issues context) to the system clipboard.
    - Opens the selected AI service (ChatGPT, Claude, Gemini, or AI Studio) in a new tab in Google Chrome (or the user's default browser if Chrome targeting is problematic).
    - The new tab/browser window comes into focus.
    - The copied prompt is automatically pasted into the AI service's primary text input field.
    - The appropriate submit action (Enter, Cmd+Enter, or Ctrl+Enter, depending on the service and OS) is automatically simulated.
2.  **Provider Selection:** User can select the target AI service (ChatGPT, Claude, Gemini, AI Studio) from a dropdown in the webview, and the push action targets the correct URL and uses the correct submit keystroke logic for the current OS.
3.  **Works with Existing Browser Session:** The new tab opens within the user's existing browser session, utilizing their current logins for the AI services.
4.  **No Browser Restart Required:** The feature functions without requiring the user to restart their browser or manually launch it with special debugging flags.
5.  **User Feedback:** Clear notifications are provided in VS Code for:
    - Copying to clipboard.
    - Opening the browser.
    - The attempt to paste/submit.
    - Errors encountered during the process.

**Platform-Specific Success Criteria & Considerations:**

- **macOS (Initial Implementation Phase):**
  - Successfully implements the "Core Functionality" using `vscode.env.clipboard.writeText`, `open -a "Google Chrome" <URL>`, and `osascript` for keystroke simulation.
  - Provides clear guidance for the one-time Accessibility/Automation permissions required by VS Code.
- **Windows (Subsequent Implementation Phase):**
  - Successfully implements the "Core Functionality" using appropriate Windows mechanisms (e.g., `vscode.env.clipboard.writeText`, `start <URL>`, and PowerShell/other for keystroke simulation).
  - Addresses potential Windows-specific focus management challenges.
  - Provides guidance if any specific Windows settings or permissions are needed (e.g., PowerShell execution policy, though unlikely for simple `SendKeys` via COM).

## Context & Learnings from SPIKE (macOS)

- This feature directly addresses GitHub Issue #19 ("Automated prompt pushing").
- The goal is to streamline the workflow of getting context from VS Code into an AI chat interface.
- **SPIKE Learnings (macOS - to be validated for Windows):**
  - Confirmed feasibility on macOS using built-in CLI tools for clipboard, URL opening, and AppleScript for keystroke simulation.
  - OS-level permissions (Accessibility/Automation on macOS) are **mandatory** for the application (VS Code) performing UI control. A similar concept might apply or be different on Windows.
  - The OS command to open a URL generally brings the new tab/browser to focus, and target AI sites often auto-focus their input fields. This behavior needs to be verified on Windows.
  - A short, fixed internal delay after opening the URL and activating the browser appears necessary before simulating keystrokes to allow for page load and input field focus. The reliability of this without user-configurable delays is a key area for testing on both platforms.
- The implementation will be phased, starting with macOS to validate the approach, followed by Windows. The feature is considered complete for production only when both macOS and Windows are supported to an acceptable level of reliability. Linux is out of scope for this initial feature.

### Reference: test script

_this ran and worked on my mac_

```bash
#!/bin/bash

# --- Configuration ---
# The text you want to send as a prompt
PROMPT_TEXT="Hello ChatGPT, this is an automated test from my Mac! What's the weather like?"

# The URL of the AI chat service
TARGET_URL="https://chat.openai.com"
# Or try: TARGET_URL="https://gemini.google.com/app"
# Or any other site where you want to test pasting into an input.

# Delay in seconds to wait after opening the URL before sending keystrokes.
# This is CRITICAL. You'll need to adjust this based on your system speed,
# network speed, and how quickly the webpage loads and focuses its input.

WAIT_SECONDS=1.0

# Submit key: "return" for Enter, or "return using command down" for Cmd+Enter
# For ChatGPT, 'return' is usually enough.
SUBMIT_KEY_APPLE_SCRIPT_COMMAND='keystroke return'
# Example for Cmd+Enter:
# SUBMIT_KEY_APPLE_SCRIPT_COMMAND='keystroke return using command down'

# --- Script Logic ---

echo "--- Starting Prompt Push Test ---"

# 1. Copy the prompt text to the clipboard
echo "Copying prompt to clipboard:"
echo "\"${PROMPT_TEXT}\""
echo "${PROMPT_TEXT}" | pbcopy
if [ $? -ne 0 ]; then
  echo "Error: Failed to copy to clipboard using pbcopy."
  exit 1
fi
echo "Prompt copied."
echo ""

# 2. Open the target URL in Google Chrome
echo "Opening URL in Google Chrome: ${TARGET_URL}"
open -a "Google Chrome" "${TARGET_URL}"
if [ $? -ne 0 ]; then
  echo "Error: Failed to open URL with Google Chrome."
  # It might have still opened if Chrome was default, but '-a' part failed.
  # You might want to proceed cautiously or exit.
fi
echo "URL opened (or command sent)."
echo ""

# 3. Wait for the specified delay, then send keystrokes
echo "Waiting for ${WAIT_SECONDS} seconds for the page to load and focus..."
# The 'osascript' itself will handle its internal delays,
# this main script delay is for the browser and page to become ready.

# Construct the AppleScript command
# Using a "here document" (<<EOF ... EOF) for multiline AppleScript
APPLE_SCRIPT_COMMAND=$(cat <<EOF
tell application "System Events"
  -- This initial delay inside AppleScript is important for focus
  delay ${WAIT_SECONDS}

  -- Try to ensure Google Chrome is the frontmost application
  -- This is crucial for the keystrokes to go to the right place.
  activate application "Google Chrome"
  delay 0.3 -- Short pause after activation to ensure focus settles

  -- Simulate Cmd+V (Paste)
  keystroke "v" using command down
  delay 0.3 -- Short pause after paste

  -- Simulate the configured submit key (Enter or Cmd+Enter)
  ${SUBMIT_KEY_APPLE_SCRIPT_COMMAND}
end tell
EOF
)

echo "Simulating paste and submit keystrokes..."
# Execute the AppleScript
osascript -e "${APPLE_SCRIPT_COMMAND}"

if [ $? -eq 0 ]; then
  echo "Keystrokes simulation command sent successfully."
  echo "Check Chrome to see if the prompt was pasted and submitted."
else
  echo "Error: AppleScript execution failed. Keystrokes might not have been sent."
fi

echo "--- Test Finished ---"
```
