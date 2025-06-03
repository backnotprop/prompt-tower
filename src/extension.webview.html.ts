import { getWebviewStyles } from "./extension.webview.css";

export interface WebviewParams {
  nonce: string;
  cspSource: string;
  chatgptLogo: string;
  claudeLogo: string;
  geminiLogo: string;
  aistudioLogo: string;
  cursorLogo: string;
  initialPrefix: string;
  initialSuffix: string;
}

export function getWebviewHtml(params: WebviewParams): string {
  const styles = getWebviewStyles();

  return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${params.cspSource} 'unsafe-inline';
                img-src ${params.cspSource} https: data:;
                script-src 'nonce-${params.nonce}';
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Prompt Tower UI</title>
            <style nonce="${params.nonce}">${styles}</style>
        </head>
        <body>
            <div id="app">
              <h1>Prompt Tower</h1>
              <div id="token-info">
                  <span>Selected Tokens:</span>
                  <span id="token-count">0</span>
                  <div id="spinner" class="spinner"></div>
                  <span id="token-status"></span>
              </div>

              <div style="margin-bottom: 1em;">
                  <button id="clearButton">Clear Selected</button> 
                  <button id="resetAllButton">Reset All</button>
              </div>

              <div id="prompt-prefix-container" class="textarea-container">
                <label for="prompt-prefix">Prompt Prefix</label>
                <textarea id="prompt-prefix">${params.initialPrefix}</textarea>
              </div>

              <div id="prompt-suffix-container" class="textarea-container">
                <label for="prompt-suffix">Prompt Suffix</label>
                <textarea id="prompt-suffix">${params.initialSuffix}</textarea>
              </div>

              <div class="action-groups">
                <!-- Create Context Group -->
                <div class="action-group">
                  <div class="action-buttons">
                    <button id="createContextButton">Create Context</button>
                  </div>
                  <div class="action-options">
                    <label class="checkbox-container">
                      <input type="checkbox" id="copyToClipboardCheckbox" checked>
                      <span class="checkmark"></span>
                      Copy to clipboard
                    </label>
                    <div class="tree-type-selector">
                      <label for="treeTypeSelect">Tree:</label>
                      <select id="treeTypeSelect">
                        <option value="fullFilesAndDirectories">Full repo</option>
                        <option value="selectedFilesOnly">Selected files only</option>
                        <option value="fullDirectoriesOnly">Directories only</option>
                      </select>
                    </div>
                    <label class="checkbox-container disabled">
                      <input type="checkbox" id="removeCommentsCheckbox" disabled>
                      <span class="checkmark"></span>
                      Remove comments
                      <span class="feature-badge">Soon</span>
                    </label>
                  </div>
                </div>

                <!-- Send to Editor Group -->
                <div class="action-group">
                  <div class="action-buttons">
                    <div class="send-to-editor-group">
                      <button id="sendToEditorButton" class="send-to-editor-btn">
                        <img src="${params.cursorLogo}" alt="Cursor" class="editor-logo">
                        Send to Chat
                      </button>
                    </div>
                  </div>
                  <div class="action-options">
                    <div class="send-to-options">
                      <span style="margin-right: 8px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">Send to:</span>
                      <label class="radio-container">
                        <input type="radio" name="sendTarget" value="agent" checked>
                        <span class="radio-checkmark"></span>
                        Agent
                      </label>
                      <label class="radio-container disabled">
                        <input type="radio" name="sendTarget" value="ask" disabled>
                        <span class="radio-checkmark"></span>
                        Ask
                        <span class="feature-badge">Soon</span>
                      </label>
                    </div>
                    <div class="chat-target-options">
                      <span style="margin-right: 8px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">Chat:</span>
                      <label class="radio-container">
                        <input type="radio" name="chatTarget" value="new" checked>
                        <span class="radio-checkmark"></span>
                        New
                      </label>
                      <label class="radio-container disabled">
                        <input type="radio" name="chatTarget" value="current" disabled>
                        <span class="radio-checkmark"></span>
                        Current
                        <span class="feature-badge">Soon</span>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Push Prompt Group -->
                <div class="action-group">
                  <div class="action-buttons">
                    <div class="push-prompt-group">
                      <button id="pushPromptButton" class="push-prompt-btn">Push Prompt</button>
                      <div class="provider-dropdown">
                        <button class="provider-dropdown-btn" id="providerDropdownBtn">
                          <img id="selectedProviderLogo" src="${params.geminiLogo}" alt="Selected Provider" class="selected-provider-logo">
                          <svg viewBox="0 0 16 16">
                            <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"></path>
                          </svg>
                        </button>
                        <div class="provider-dropdown-content" id="providerDropdownContent">
                          <button class="provider-option" data-provider="chatgpt">
                            <img src="${params.chatgptLogo}" alt="ChatGPT" class="provider-logo">
                            <span class="provider-name">ChatGPT</span>
                          </button>
                          <button class="provider-option" data-provider="claude">
                            <img src="${params.claudeLogo}" alt="Claude" class="provider-logo">
                            <span class="provider-name">Claude</span>
                          </button>
                          <button class="provider-option" data-provider="gemini">
                            <img src="${params.geminiLogo}" alt="Gemini" class="provider-logo">
                            <span class="provider-name">Gemini</span>
                          </button>
                          <button class="provider-option" data-provider="aistudio">
                            <img src="${params.aistudioLogo}" alt="AI Studio" class="provider-logo">
                            <span class="provider-name">AI Studio</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="action-options">
                    <label class="checkbox-container">
                      <input type="checkbox" id="autoSubmitCheckbox" checked>
                      <span class="checkmark"></span>
                      Auto-submit
                    </label>
                    <span class="option-separator">•</span>
                    <a href="#" id="helpfulInfoLink" class="helpful-info-link">helpful info</a>
                  </div>
                </div>
              </div>

              <div id="preview-container">
                  <label for="context-preview">Context Preview
                  <a id="copy-preview-content" class="copy-preview-content">Copy</a>
                  <a id="expand-preview" class="expand-preview">Expand</a>
                  </label>
                  <span id="preview-status"></span>
                  <textarea id="context-preview"></textarea>
              </div>
            </div>
            
            <!-- Modal Overlay -->
            <div id="modal-overlay" class="modal-overlay" style="display: none;">
              <div class="modal-container">
                <div class="modal-header">
                  <h2 id="modal-title">Modal Title</h2>
                  <button id="modal-close" class="modal-close">&times;</button>
                </div>
                <div class="modal-content" id="modal-content">
                  <!-- Dynamic content will be inserted here -->
                </div>
                <div class="modal-footer" id="modal-footer">
                  <!-- Optional footer buttons -->
                </div>
              </div>
            </div>
            <script nonce="${params.nonce}">
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    const tokenCountElement = document.getElementById('token-count');
                    const tokenStatusElement = document.getElementById('token-status');
                    const spinnerElement = document.getElementById('spinner');
                    const prefixTextArea = document.getElementById("prompt-prefix");
                    const suffixTextArea = document.getElementById("prompt-suffix");
                    const previewTextArea = document.getElementById("context-preview");
                    const previewContainer = document.getElementById("preview-container");
                    const previewStatusElement = document.getElementById("preview-status");
                    
                    // Create Context controls
                    const copyToClipboardCheckbox = document.getElementById('copyToClipboardCheckbox');
                    const treeTypeSelect = document.getElementById('treeTypeSelect');
                    const removeCommentsCheckbox = document.getElementById('removeCommentsCheckbox');
                    
                    // Push Prompt controls
                    const autoSubmitCheckbox = document.getElementById('autoSubmitCheckbox');
                    const helpfulInfoLink = document.getElementById('helpfulInfoLink');
                    
                    // Modal elements
                    const modalOverlay = document.getElementById('modal-overlay');
                    const modalTitle = document.getElementById('modal-title');
                    const modalContent = document.getElementById('modal-content');
                    const modalFooter = document.getElementById('modal-footer');
                    const modalClose = document.getElementById('modal-close');
                    
                    // Provider dropdown functionality
                    const providerDropdownBtn = document.getElementById('providerDropdownBtn');
                    const providerDropdownContent = document.getElementById('providerDropdownContent');
                    const pushPromptButton = document.getElementById('pushPromptButton');
                    const selectedProviderLogo = document.getElementById('selectedProviderLogo');
                    let selectedProvider = 'gemini'; // Default provider
                    
                    // Provider logo mapping
                    const providerLogos = {
                        'chatgpt': '${params.chatgptLogo}',
                        'claude': '${params.claudeLogo}',
                        'gemini': '${params.geminiLogo}',
                        'aistudio': '${params.aistudioLogo}'
                    };
                    
                    // Toggle dropdown
                    providerDropdownBtn?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        providerDropdownContent?.classList.toggle('show');
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', () => {
                        providerDropdownContent?.classList.remove('show');
                    });
                    
                    // Handle provider selection
                    document.querySelectorAll('.provider-option').forEach(option => {
                        option.addEventListener('click', (e) => {
                            const provider = e.currentTarget.getAttribute('data-provider');
                            if (provider && providerLogos[provider]) {
                                selectedProvider = provider;
                                // Update the displayed logo
                                if (selectedProviderLogo) {
                                    selectedProviderLogo.src = providerLogos[provider];
                                    selectedProviderLogo.alt = provider.charAt(0).toUpperCase() + provider.slice(1);
                                }
                                providerDropdownContent?.classList.remove('show');
                            }
                        });
                    });
                    
                    // Push Prompt button functionality
                    pushPromptButton?.addEventListener('click', () => {
                        // Add shimmer effect like create context
                        if (previewContainer) {
                            previewContainer.classList.add('cyber-generating');
                            // Remove effect after animation completes
                            setTimeout(() => {
                                previewContainer.classList.remove('cyber-generating');
                            }, 750);
                        }
                        
                        const pushRequest = { 
                            command: "pushPrompt", 
                            provider: selectedProvider,
                            autoSubmit: autoSubmitCheckbox?.checked ?? true
                        };
                        
                        // Store the request for potential onboarding flow
                        window.lastPushPromptRequest = pushRequest;
                        
                        vscode.postMessage(pushRequest);
                    });
                    
                    // Modal functionality
                    function showModal(type, title, content, footerButtons = []) {
                        if (modalOverlay && modalTitle && modalContent && modalFooter) {
                            modalTitle.textContent = title;
                            modalContent.innerHTML = content;
                            
                            // Clear and add footer buttons
                            modalFooter.innerHTML = '';
                            footerButtons.forEach(button => {
                                const btn = document.createElement('button');
                                btn.textContent = button.text;
                                btn.onclick = button.onClick;
                                if (button.primary) {
                                    btn.style.background = 'var(--vscode-button-background)';
                                    btn.style.color = 'var(--vscode-button-foreground)';
                                }
                                modalFooter.appendChild(btn);
                            });
                            
                            modalOverlay.style.display = 'flex';
                        }
                    }
                    
                    function hideModal() {
                        if (modalOverlay) {
                            modalOverlay.style.display = 'none';
                        }
                    }
                    
                    // Modal event handlers
                    modalClose?.addEventListener('click', hideModal);
                    modalOverlay?.addEventListener('click', (e) => {
                        if (e.target === modalOverlay) {
                            hideModal();
                        }
                    });
                    
                    // Helpful info link handler
                    helpfulInfoLink?.addEventListener('click', (e) => {
                        e.preventDefault();
                        showModal('help', 'Automation Help', \`
                            <h3>Prompt Pushing Settings</h3>
                            <p><strong>Auto-submit:</strong> When checked (default), prompts are automatically submitted after pasting. When unchecked, prompts are only pasted - you submit manually.</p>
                            
                            <h3>Configuration</h3>
                            <p>You can customize automation behavior in VS Code settings:</p>
                            <ul>
                                <li><code>promptTower.automation.defaultBrowser</code> - Choose Chrome or system default</li>
                                <li><code>promptTower.automation.automationDelay</code> - Delay before automation (increase if pages load slowly)</li>
                                <li><code>promptTower.automation.focusDelay</code> - Delay between automation steps</li>
                            </ul>
                            
                            <h3>macOS Permissions</h3>
                            <p>Automation requires Accessibility permissions for VS Code. If automation fails, check System Preferences → Security & Privacy → Privacy → Accessibility.</p>
                            
                            <h3>Troubleshooting</h3>
                            <p>If automation doesn't work:</p>
                            <ul>
                                <li>Increase automation delays in settings</li>
                                <li>Try unchecking auto-submit and submit manually</li>
                                <li>Ensure you're logged into the AI service</li>
                                <li>Check that the browser page loaded completely</li>
                            </ul>
                        \`, [
                            { text: 'Close', onClick: hideModal }
                        ]);
                    });
                    
                    // Event listeners
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'tokenUpdate':
                                if (message.payload && tokenCountElement && tokenStatusElement && spinnerElement) {
                                    const { count, isCounting } = message.payload;
                                    tokenCountElement.textContent = count.toLocaleString();
                                    if (isCounting) {
                                        tokenStatusElement.textContent = '(Calculating...)';
                                        spinnerElement.classList.add('visible');
                                    } else {
                                        tokenStatusElement.textContent = '';
                                        spinnerElement.classList.remove('visible');
                                    }
                                }
                                break;
                            case 'updatePrefix':
                                if (prefixTextArea && typeof message.text === 'string') {
                                    prefixTextArea.value = message.text;
                                }
                                break;
                            case 'updateSuffix':
                                if (suffixTextArea && typeof message.text === 'string') {
                                    suffixTextArea.value = message.text;
                                }
                                break;
                            case 'updatePreview':
                                if (message.payload && previewTextArea) {
                                    previewTextArea.value = message.payload.context;
                                    // Clear invalidation state when preview is updated
                                    if (previewContainer && previewStatusElement) {
                                        previewContainer.classList.remove('invalidated');
                                        previewStatusElement.textContent = '';
                                    }
                                }
                                break;
                            case 'invalidatePreview':
                                // Show visual warning that context is out of sync
                                if (previewContainer && previewStatusElement) {
                                    previewContainer.classList.add('invalidated');
                                    previewStatusElement.textContent = '⚠️ Context may be out of sync. Click "Create Context" to update.';
                                }
                                break;
                            case 'showOnboardingModal':
                                // Show the first-time onboarding modal
                                showModal('onboarding', 'Welcome to Automated Prompt Pushing!', \`
                                    <h3>🚀 Getting Started</h3>
                                    <p>You're about to use automated prompt pushing for the first time! This feature will:</p>
                                    <ul>
                                        <li>Open your selected AI provider in the browser</li>
                                        <li>Automatically paste your generated prompt</li>
                                        <li>Submit it for you (if auto-submit is enabled)</li>
                                    </ul>
                                    
                                    <h3>⚠️ macOS Permissions Required</h3>
                                    <p><strong>Important:</strong> On macOS, this feature requires Accessibility permissions for VS Code to control your browser.</p>
                                    <p>If automation fails, you'll be guided to enable these permissions in System Preferences.</p>
                                    
                                    <h3>💡 Tips</h3>
                                    <ul>
                                        <li>Make sure you're logged into your AI provider</li>
                                        <li>The "Auto-submit" checkbox controls whether prompts are submitted automatically</li>
                                        <li>Click "helpful info" anytime for more configuration options</li>
                                    </ul>
                                    
                                    <p><strong>Ready to try it?</strong> Click "Continue" to proceed with your prompt push!</p>
                                \`, [
                                    { 
                                        text: 'Continue', 
                                        primary: true,
                                        onClick: () => {
                                            hideModal();
                                            // Store the original request and send it after onboarding completion
                                            const originalRequest = window.lastPushPromptRequest;
                                            vscode.postMessage({ 
                                                command: 'completeOnboarding',
                                                originalRequest: originalRequest
                                            });
                                        }
                                    },
                                    { 
                                        text: 'Cancel', 
                                        onClick: hideModal 
                                    }
                                ]);
                                break;
                        }
                    });
                    
                    // Input event listeners
                    if (prefixTextArea) {
                        prefixTextArea.addEventListener("input", (e) => {
                            vscode.postMessage({ command: "updatePrefix", text: e.target.value });
                        });
                    }
                    if (suffixTextArea) {
                        suffixTextArea.addEventListener("input", (e) => {
                            vscode.postMessage({ command: "updateSuffix", text: e.target.value });
                        });
                    }
                    
                    // Button event listeners
                    document.getElementById('createContextButton')?.addEventListener("click", () => {
                        // Show toast notification
                        vscode.postMessage({ command: "showToast", payload: { message: "Generating context..." } });
                        
                        // Add shimmer effect
                        if (previewContainer) {
                            previewContainer.classList.add('cyber-generating');
                            // Remove effect after animation completes
                            setTimeout(() => {
                                previewContainer.classList.remove('cyber-generating');
                            }, 750);
                        }
                        
                        vscode.postMessage({ 
                            command: "createContext",
                            options: {
                                treeType: treeTypeSelect?.value || 'fullFilesAndDirectories',
                                copyToClipboard: copyToClipboardCheckbox?.checked ?? true,
                                removeComments: removeCommentsCheckbox?.checked ?? false
                            }
                        });
                    });
                    
                    
                    document.getElementById('clearButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "clearSelections" });
                    });
                    
                    document.getElementById('resetAllButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "resetAll" });
                    });
                    
                    document.getElementById('sendToEditorButton')?.addEventListener("click", () => {
                        // Add shimmer effect like other buttons
                        if (previewContainer) {
                            previewContainer.classList.add('cyber-generating');
                            // Remove effect after animation completes
                            setTimeout(() => {
                                previewContainer.classList.remove('cyber-generating');
                            }, 750);
                        }
                        
                        // Get selected target from radio buttons
                        const selectedTarget = document.querySelector('input[name="sendTarget"]:checked')?.value || 'agent';
                        vscode.postMessage({ 
                            command: "sendToEditor",
                            target: selectedTarget
                        });
                    });
                    
                    // Preview action event listeners  
                    document.getElementById('copy-preview-content')?.addEventListener("click", () => {
                        if (previewTextArea) {
                            previewTextArea.select();
                            document.execCommand("copy");
                            // Show toast notification
                            vscode.postMessage({ command: "showToast", payload: { message: "Context copied to clipboard." } });
                        }
                    });
                    
                    document.getElementById('expand-preview')?.addEventListener("click", () => {
                        if (previewContainer) {
                            const expandButton = document.getElementById('expand-preview');
                            previewContainer.classList.toggle("expanded");
                            
                            // Update button text and handle scrolling
                            if (previewContainer.classList.contains("expanded")) {
                              if (expandButton) expandButton.textContent = "Collapse";
                              setTimeout(() => {
                                window.scrollBy({
                                  top: 492, // 748-256 = height difference
                                  behavior: 'smooth'
                                });
                              }, 300); // Wait for 0.3s CSS transition to finish
                            } else {
                              if (expandButton) expandButton.textContent = "Expand";
                              window.scrollTo({
                                top: 0,
                                behavior: 'smooth'
                              });
                            }
                        }
                    });
                    
                    vscode.postMessage({ command: "webviewReady" });
                }());
              </script>
          </body>
        </html>`;
}
