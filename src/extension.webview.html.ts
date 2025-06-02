import { getWebviewStyles } from "./extension.webview.css";

export interface WebviewParams {
  nonce: string;
  cspSource: string;
  chatgptLogo: string;
  claudeLogo: string;
  geminiLogo: string;
  aistudioLogo: string;
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

              <div class="button-container">
                <div class="button-group-left">
                  <button id="createContextButton">Create Context</button>
                  <button id="createAndCopyButton">Create & Copy to Clipboard</button>
                </div>
                
                <div class="button-group-right">
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

              <div id="preview-container">
                  <label for="context-preview">Context Preview
                  <a id="copy-preview-content" class="copy-preview-content">Copy</a>
                  <a id="expand-preview" class="expand-preview">Expand</a>
                  </label>
                  <span id="preview-status"></span>
                  <textarea id="context-preview"></textarea>
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
                        
                        vscode.postMessage({ 
                            command: "pushPrompt", 
                            provider: selectedProvider 
                        });
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
                        
                        vscode.postMessage({ command: "createContext" });
                    });
                    
                    document.getElementById('createAndCopyButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "createAndCopyToClipboard" });
                    });
                    
                    document.getElementById('clearButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "clearSelections" });
                    });
                    
                    document.getElementById('resetAllButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "resetAll" });
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
