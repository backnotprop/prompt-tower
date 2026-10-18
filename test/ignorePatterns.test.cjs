const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const { buildSync } = require('esbuild');

// Bundle the real service in memory; only VS Code's configuration/watcher API is faked.
const bundle = buildSync({
  stdin: {
    contents: 'export { IgnorePatternService } from "./src/services/IgnorePatternService"; export { state } from "vscode"; export { FileDiscoveryService } from "./src/services/FileDiscoveryService";',
    resolveDir: path.resolve(__dirname, '..'),
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  alias: { vscode: path.join(__dirname, 'vscodeMock.cjs') },
});
const loaded = new Module(__filename, module);
loaded._compile(bundle.outputFiles[0].text, __filename);
const { IgnorePatternService, FileDiscoveryService, state } = loaded.exports;

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-tower-ignore-'));
  state.useGitignore = true;
  state.watchers.length = 0;
  state.files = [];
  state.lastExclude = null;
  state.configurationListeners.length = 0;
  const service = new IgnorePatternService({ subscriptions: [] });
  const workspace = { id: root, rootPath: root, name: 'fixture', uri: root, index: 0 };
  const write = (name, content = '') => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  for (const [name, content] of Object.entries(files)) { write(name, content); }
  t.after(() => { service.dispose(); fs.rmSync(root, { recursive: true, force: true }); });
  return {
    root, service, workspace, write,
    ignored: (name) => service.isPathIgnored(path.join(root, name), workspace),
  };
}

function checkLikeGit(f, paths) {
  execFileSync('git', ['init', '-q', f.root]);
  for (const name of paths) {
    let expected;
    try {
      execFileSync('git', ['-C', f.root, 'check-ignore', '--no-index', '-q', '--', name]);
      expected = true;
    } catch (error) {
      assert.equal(error.status, 1, 'git check-ignore must complete normally');
      expected = false;
    }
    assert.equal(f.ignored(name), expected, name);
  }
}

test('nested patterns stay relative to their directory and do not affect siblings', (t) => {
  const f = fixture(t, {
    'app/.gitignore': '/local.txt\n*.generated\nassets/\n',
    'app/local.txt': '', 'app/deep/local.txt': '', 'app/deep/code.generated': '',
    'app/assets/image.svg': '', 'other/local.txt': '', 'other/code.generated': '',
  });
  checkLikeGit(f, ['app/local.txt', 'app/deep/local.txt', 'app/deep/code.generated',
    'app/assets', 'app/assets/image.svg', 'other/local.txt', 'other/code.generated']);
});

test('deeper negations override parent rules without resurrecting excluded directories', (t) => {
  const f = fixture(t, {
    '.gitignore': '*.trace\nblocked/\n',
    'app/.gitignore': '!keep.trace\n',
    'app/deep/.gitignore': 'keep.trace\n',
    'app/keep.trace': '', 'app/drop.trace': '', 'app/deep/keep.trace': '',
    'blocked/.gitignore': '!keep.trace\n', 'blocked/keep.trace': '',
  });
  checkLikeGit(f, ['app/keep.trace', 'app/drop.trace', 'app/deep/keep.trace', 'blocked/keep.trace']);
});

test('root towerignore retains precedence over nested rules', (t) => {
  const f = fixture(t, {
    '.towerignore': 'app/keep.trace\n!app/allowed.trace\n',
    'app/.gitignore': '*.trace\n!keep.trace\n',
    'app/keep.trace': '', 'app/allowed.trace': '',
  });
  assert.equal(f.ignored('app/keep.trace'), true);
  assert.equal(f.ignored('app/allowed.trace'), false);
});

test('disabling gitignore disables nested rules but keeps towerignore', (t) => {
  const f = fixture(t, {
    'app/.gitignore': '*.trace\n', '.towerignore': 'app/tower.txt\n',
    'app/code.trace': '', 'app/tower.txt': '',
  });
  assert.equal(f.ignored('app/code.trace'), true);
  state.useGitignore = false;
  for (const listener of state.configurationListeners) {
    listener({ affectsConfiguration: (key) => key === 'promptTower.useGitignore' });
  }
  assert.equal(f.ignored('app/code.trace'), false);
  assert.equal(f.ignored('app/tower.txt'), true);
});

test('nested ignore create, change and delete events invalidate cached matches', (t) => {
  const f = fixture(t, { 'app/item.trace': '' });
  f.service.setupIgnoreFileWatchers(f.workspace);
  const watcher = state.watchers.find((w) => w.pattern.pattern === '**/.gitignore');
  assert.ok(watcher, 'watch nested .gitignore files');
  assert.equal(f.ignored('app/item.trace'), false);
  f.write('app/.gitignore', '*.trace\n');
  watcher.fire('create');
  assert.equal(f.ignored('app/item.trace'), true);
  f.write('app/.gitignore', '!*.trace\n');
  watcher.fire('change');
  assert.equal(f.ignored('app/item.trace'), false);
  f.write('app/.gitignore', '*.trace\n');
  watcher.fire('change');
  assert.equal(f.ignored('app/item.trace'), true);
  fs.unlinkSync(path.join(f.root, 'app/.gitignore'));
  watcher.fire('delete');
  assert.equal(f.ignored('app/item.trace'), false);
});

test('findFiles prefilter cannot discard files re-included by nested rules', (t) => {
  const f = fixture(t, { '.gitignore': '*.trace\n', 'app/.gitignore': '!keep.trace\n' });
  const globs = f.service.getExcludeGlobPatterns(f.workspace);
  assert.ok(!globs.some((glob) => glob.includes('.trace')), 'defer gitignore matching to the scoped service');
  assert.ok(globs.includes('**/node_modules/**'), 'keep built-in search exclusions');
});

test('workspace cleanup drops cached nested matchers and disposes watchers', (t) => {
  const f = fixture(t, { 'app/.gitignore': '*.trace\n', 'app/item.trace': '' });
  f.service.setupIgnoreFileWatchers(f.workspace);
  assert.equal(f.ignored('app/item.trace'), true);
  f.service.cleanupWorkspace(f.workspace);
  assert.ok(state.watchers.every((watcher) => watcher.disposed));
  f.write('app/.gitignore', '!*.trace\n');
  assert.equal(f.ignored('app/item.trace'), false);
});

test('a nested rule can re-include a directory excluded by an ancestor rule', (t) => {
  const f = fixture(t, {
    '.gitignore': 'app/hidden/\n', 'app/.gitignore': '!hidden/\n',
    'app/hidden/visible.txt': '',
  });
  checkLikeGit(f, ['app/hidden', 'app/hidden/visible.txt']);
});

test('directory names containing glob characters remain literal', (t) => {
  const f = fixture(t, {
    'app[1]/.gitignore': '*.trace\n',
    'app[1]/item.trace': '', 'app1/item.trace': '',
    'app?/.gitignore': '*.trace\n', 'app?/item.trace': '', 'appx/item.trace': '',
    'app?/deep/item.trace': '', 'appx/deep/item.trace': '',
    '!special/.gitignore': '/item.trace\n', '!special/item.trace': '',
  });
  checkLikeGit(f, ['app[1]/item.trace', 'app1/item.trace', 'app?/item.trace', 'appx/item.trace', 'app?/deep/item.trace', 'appx/deep/item.trace', '!special/item.trace']);
});

test('nested matchers remain isolated between workspaces', (t) => {
  const f = fixture(t, { 'first/app/.gitignore': '*.trace\n',
    'first/app/item.trace': '', 'second/app/item.trace': '' });
  const first = { ...f.workspace, id: 'first', rootPath: path.join(f.root, 'first') };
  const second = { ...f.workspace, id: 'second', rootPath: path.join(f.root, 'second') };
  assert.equal(f.service.isPathIgnored(path.join(first.rootPath, 'app/item.trace'), first), true);
  assert.equal(f.service.isPathIgnored(path.join(second.rootPath, 'app/item.trace'), second), false);
});


test('file discovery includes nested exceptions and filters nested exclusions', async (t) => {
  const f = fixture(t, {
    '.gitignore': '*.trace\n', 'app/.gitignore': '!keep.trace\n/local.txt\n',
    'app/keep.trace': '', 'app/drop.trace': '', 'app/local.txt': '',
    'other/local.txt': '',
  });
  state.files = ['app/keep.trace', 'app/drop.trace', 'app/local.txt', 'other/local.txt']
    .map(name => path.join(f.root, name));
  const discovery = new FileDiscoveryService(f.service);
  const tree = await discovery.discoverWorkspaceFiles(f.workspace);
  assert.ok(tree);
  const found = name => discovery.findNodeByPath([tree], path.join(f.root, name));
  assert.ok(found('app/keep.trace'));
  assert.ok(found('other/local.txt'));
  assert.equal(found('app/drop.trace'), undefined);
  assert.equal(found('app/local.txt'), undefined);
  assert.ok(!state.lastExclude.includes('.trace'));
});
