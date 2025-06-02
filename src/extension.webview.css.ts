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
        h1 {
            margin-top: 0;
            font-size: 1.5em;
            border-bottom: 1px solid var(--vscode-separator-foreground);
            padding-bottom: 0.3em;
            margin-bottom: 0.8em;
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
        
        /* Modern button container styling */
        .button-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 12px;
        }
        
        .button-group-left {
            display: flex;
            gap: 8px;
        }
        
        .button-group-right {
            display: flex;
            align-items: center;
            gap: 0;
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
    `;
}
