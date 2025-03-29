import * as vscode from "vscode";

export interface TokenUpdatePayload {
  count: number;
  isCounting: boolean;
}

// Simple EventEmitter wrapper for type safety
export class TokenUpdateEmitter extends vscode.EventEmitter<TokenUpdatePayload> {}
