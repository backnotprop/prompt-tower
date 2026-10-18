const state = { useGitignore: true, watchers: [], configurationListeners: [], files: [], lastExclude: null };
class RelativePattern {
  constructor(base, pattern) { this.base = base; this.pattern = pattern; }
}
const workspace = {
  async findFiles(_include, exclude) {
    state.lastExclude = exclude;
    return state.files.map(fsPath => ({ fsPath }));
  },
  getConfiguration() {
    return { get: (key, fallback) => key === 'useGitignore' ? state.useGitignore : fallback };
  },
  onDidChangeConfiguration(listener) {
    state.configurationListeners.push(listener);
    return { dispose() {} };
  },
  createFileSystemWatcher(pattern) {
    const callbacks = {};
    const watcher = {
      pattern, disposed: false,
      onDidCreate(callback) { callbacks.create = callback; },
      onDidChange(callback) { callbacks.change = callback; },
      onDidDelete(callback) { callbacks.delete = callback; },
      fire(event) { callbacks[event](); },
      dispose() { this.disposed = true; },
    };
    state.watchers.push(watcher);
    return watcher;
  },
};
module.exports = { state, workspace, RelativePattern, TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 } };
