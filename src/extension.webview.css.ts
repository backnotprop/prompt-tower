export function getWebviewStyles(): string {
  return `
        body {
            padding: 1em;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.4;
            box-sizing: border-box;
        }
        #app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        #header-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 0.8em;
            border-bottom: 1px solid var(--vscode-separator-foreground);
            padding-bottom: 0.3em;
        }
        h1 {
            margin: 0;
            font-size: 1.5em;
        }
        .tree-toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 14px;
            background: var(--vscode-editorWarning-background, rgba(255, 140, 0, 0.15));
            color: var(--vscode-editorWarning-foreground, #ff8c00);
            border: 1px solid var(--vscode-editorWarning-border, rgba(255, 140, 0, 0.3));
            border-radius: 4px;
            font-size: 11px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
            font-weight: 500;
        }
        .tree-toggle-btn:hover {
            background: var(--vscode-editorWarning-background, rgba(255, 140, 0, 0.25));
        }
        .tree-toggle-btn svg {
            width: 14px;
            height: 14px;
            opacity: 0.9;
        }
        #token-info {
            margin-bottom: 1em;
            padding: 10px 12px;
            border: 1px solid var(--vscode-editorWidget-border, #ccc);
            border-radius: 4px;
            background-color: var(--vscode-editorWidget-background, #f0f0f0);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        #token-count {
            font-weight: bold;
            font-size: 1.1em;
            color: var(--vscode-charts-blue);
        }
        #token-status {
            font-style: italic;
            color: var(--vscode-descriptionForeground, #777);
            flex-grow: 1;
        }
        .spinner {
            display: inline-block;
            width: 1em;
            height: 1em;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: spinner-border .75s linear infinite;
            vertical-align: middle;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            margin-left: 5px;
        }
        .spinner.visible {
            opacity: 1;
        }
        @keyframes spinner-border {
            to { transform: rotate(360deg); }
        }
        button {
             color: var(--vscode-button-foreground);
             background-color: var(--vscode-button-background);
             border: 1px solid var(--vscode-button-border, transparent);
             padding: 5px 10px;
             cursor: pointer;
             border-radius: 2px;
        }
        button:hover {
             background-color: var(--vscode-button-hoverBackground);
        }
        
        /* Modern action groups styling */
        .action-groups {
            display: flex;
            flex-direction: row;
            gap: 16px;
            margin-bottom: 20px;
        }
        
        .action-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            flex: 1;
        }
        
        .action-buttons {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .push-prompt-group {
            display: flex;
            align-items: center;
        }
        
        .action-options {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            flex-wrap: wrap;
        }
        
        /* Push Prompt button styling */
        .push-prompt-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            padding: 8px 16px;
            border-radius: 6px 0 0 6px;
            font-weight: 500;
            font-size: 0.9em;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            height: 32px;
            display: flex;
            align-items: center;
            box-sizing: border-box;
            transition: all 0.4s ease;
            font-weight: 500;
            
        }
        
        .push-prompt-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .push-prompt-btn:active {
        }
        
        /* Provider dropdown styling */
        .provider-dropdown {
            position: relative;
            display: inline-block;
        }
        
        .provider-dropdown-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            border-left: 1px solid var(--vscode-button-separator, var(--vscode-button-border));
            padding: 8px 10px;
            border-radius: 0 6px 6px 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 32px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            transition: all 0.4s ease;
        }
        
        .provider-dropdown-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .provider-dropdown-btn .selected-provider-logo {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            object-fit: contain;
            filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        }
        
        .provider-dropdown-btn svg {
            width: 12px;
            height: 12px;
            fill: currentColor;
        }
        
        .provider-dropdown-content {
            display: none;
            position: absolute;
            right: 0;
            background-color: var(--vscode-dropdown-background);
            min-width: 180px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            border-radius: 8px;
            z-index: 1000;
            border: 1px solid var(--vscode-dropdown-border);
            overflow: hidden;
            top: 100%;
            margin-top: 4px;
        }
        
        .provider-dropdown-content.show {
            display: block;
            animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .provider-option {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            transition: background-color 0.15s ease;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            color: var(--vscode-dropdown-foreground);
            font-family: inherit;
            font-size: 0.9em;
        }
        
        .provider-option:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .provider-option:active {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .provider-logo {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            border-radius: 4px;
            object-fit: contain;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.18));
        }
        
        .provider-name {
            font-weight: 500;
        }
        
        /* Action Options Styling */
        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            margin: 0;
            white-space: nowrap;
        }
        
        .checkbox-container input[type="checkbox"] {
            margin: 0;
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        
        .checkbox-container.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .checkbox-container.disabled input {
            cursor: not-allowed;
        }
        
        .tree-type-selector {
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .tree-type-selector label {
            margin: 0;
            font-weight: normal;
            color: var(--vscode-descriptionForeground);
        }
        
        .tree-type-selector select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            padding: 3px 6px;
            font-size: 0.9em;
            cursor: pointer;
        }
        
        .feature-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.75em;
            font-weight: 500;
            margin-left: 4px;
        }
        
        .option-separator {
            font-weight: bold;
            opacity: 0.5;
            margin: 0 4px;
        }
        
        .helpful-info-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
            font-size: inherit;
            margin: 0;
        }
        
        .helpful-info-link:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        
        /* Send to Editor button styling */
        .send-to-editor-group {
            display: flex;
            align-items: center;
        }
        
        .send-to-editor-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 0.9em;
            cursor: pointer;
            height: 32px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-sizing: border-box;
            transition: all 0.4s ease;
        }
        
        .send-to-editor-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .editor-logo {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            object-fit: contain;
            filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        }
        
        /* Send to options styling */
        .send-to-options {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        /* Chat target options styling */
        .chat-target-options {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 6px;
        }
        
        .radio-container {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            margin: 0;
            white-space: nowrap;
            position: relative;
        }
        
        .radio-container input[type="radio"] {
            margin: 0;
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: var(--vscode-button-background);
        }
        
        .radio-container.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .radio-container.disabled input {
            cursor: not-allowed;
        }
        
        /* Windows preview styling */
        .windows-preview {
            opacity: 0.6;
            pointer-events: none;
            position: relative;
        }
        
        .windows-preview::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: transparent;
            z-index: 1;
        }
        
        .windows-preview button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(20%);
        }
        
        .windows-preview .send-to-editor-btn.disabled {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            opacity: 0.5;
        }
        
        .windows-preview .push-prompt-btn.disabled {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            opacity: 0.5;
        }
        
        .windows-preview .provider-dropdown-btn.disabled {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            opacity: 0.5;
        }
        
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-input-foreground);
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
          min-height: 80px;
          resize: vertical;
        }
        .textarea-container {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }
        label {
          margin-bottom: 0.4em;
          font-weight: bold;
          color: var(--vscode-descriptionForeground);
        }
        #preview-container {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            min-height: 0;
            margin-top: 0px;
            border-top: 1px solid var(--vscode-separator-foreground);
            padding-top: 1em;
        }
        a {
          cursor: pointer !important;
          margin-left: 5px !important;
          font-size: 0.9em !important;
          font-weight: 300 !important;
        }
        #preview-status {
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
          min-height: 1.2em;
        }
        #context-preview {
            flex-grow: 1;
            height: 256px;
            min-height: 100px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-editorWidget-background);
            color: var(--vscode-input-foreground);
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: var(--vscode-editor-font-family, monospace);
            transition: height 0.3s ease-in-out;
        }
        #preview-container.expanded #context-preview {
          height: 748px;
        }
        #preview-container.invalidated #context-preview,
        #preview-container.invalidated #context-preview:focus,
        #preview-container.invalidated #context-preview:hover,
        #preview-container.invalidated #context-preview:active {
          border: 1px solid var(--vscode-inputValidation-warningForeground, orange) !important;
          border-color: var(--vscode-inputValidation-warningForeground, orange) !important;
        }
        #preview-container.invalidated #preview-status {
            color: var(--vscode-inputValidation-warningForeground, orange);
        }
        
        /* Shimmer effect for context generation */
        #preview-container.cyber-generating #context-preview {
            background: linear-gradient(
                90deg,
                var(--vscode-input-background) 0%,     /* Start with background */
                var(--vscode-input-background) 20%,    /* Hold background for a smoother start */
                var(--vscode-charts-blue) 40%,         /* Blue fades in */
                var(--vscode-charts-green) 50%,        /* Green is the central color */
                var(--vscode-charts-blue) 60%,         /* Blue fades back in */
                var(--vscode-input-background) 80%,    /* Fade out to background */
                var(--vscode-input-background) 100%    /* Hold background for a smoother end */
            );
            background-size: 200% 100%; /* Keep background size, keyframes will control speed */
            animation: shimmer-bg 4s; /* Changed to 2 seconds */
            
            box-shadow: 0 0 20px rgba(var(--vscode-charts-blue), 0.2);
            opacity: 0.45;
        }
        #preview-container.cyber-generating #context-preview::selection {
            background: rgba(255, 255, 255, 0.3);
        }
        
        @keyframes shimmer-bg {
           0% {
               background-position: 200% 0;
               box-shadow: 0 0 5px rgba(var(--vscode-charts-blue), 0.05);
           }
           25% {
               background-position: 100% 0;
               box-shadow: 0 0 10px rgba(var(--vscode-charts-blue), 0.1);
           }
           50% {
               background-position: 0% 0;
               box-shadow: 0 0 15px rgba(var(--vscode-charts-blue), 0.15);
           }
           75% {
               background-position: -100% 0;
               box-shadow: 0 0 10px rgba(var(--vscode-charts-blue), 0.1);
           }
           100% {
               background-position: -200% 0;
               box-shadow: 0 0 5px rgba(var(--vscode-charts-blue), 0.05);
           }
       }
       
       /* Modal System */
       .modal-overlay {
           position: fixed;
           top: 0;
           left: 0;
           width: 100%;
           height: 100%;
           background: rgba(0, 0, 0, 0.6);
           z-index: 10000;
           display: flex;
           align-items: center;
           justify-content: center;
           backdrop-filter: blur(3px);
       }
       
       .modal-container {
           background: var(--vscode-editor-background);
           border: 1px solid var(--vscode-editorWidget-border);
           border-radius: 8px;
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
           max-width: 600px;
           min-width: 400px;
           max-height: 80vh;
           overflow: hidden;
           display: flex;
           flex-direction: column;
       }
       
       .modal-header {
           padding: 16px 20px;
           border-bottom: 1px solid var(--vscode-editorWidget-border);
           display: flex;
           align-items: center;
           justify-content: space-between;
           background: var(--vscode-editorWidget-background);
       }
       
       .modal-header h2 {
           margin: 0;
           font-size: 1.2em;
           color: var(--vscode-foreground);
       }
       
       .modal-close {
           background: none;
           border: none;
           font-size: 24px;
           color: var(--vscode-foreground);
           cursor: pointer;
           padding: 0;
           width: 32px;
           height: 32px;
           display: flex;
           align-items: center;
           justify-content: center;
           border-radius: 4px;
       }
       
       .modal-close:hover {
           background: var(--vscode-toolbar-hoverBackground);
       }
       
       .modal-content {
           padding: 20px;
           overflow-y: auto;
           flex-grow: 1;
           color: var(--vscode-foreground);
           line-height: 1.5;
       }
       
       .modal-content h3 {
           margin-top: 0;
           color: var(--vscode-textPreformat-foreground);
       }
       
       .modal-content p {
           margin: 12px 0;
       }
       
       .modal-content code {
           background: var(--vscode-textBlockQuote-background);
           padding: 2px 6px;
           border-radius: 3px;
           font-family: var(--vscode-editor-font-family);
       }
       
       .modal-footer {
           padding: 16px 20px;
           border-top: 1px solid var(--vscode-editorWidget-border);
           display: flex;
           gap: 12px;
           justify-content: flex-end;
           background: var(--vscode-editorWidget-background);
       }
    `;
}
