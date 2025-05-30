export const ALWAYS_IGNORE = [
  // Version control (HUGE and irrelevant for LLM context)
  ".git/",
  ".svn/",
  ".hg/",
  ".bzr/",
  ".darcs/",
  ".husky/",
  
  // IDE/Editor directories (contain settings, might have sensitive paths)
  ".vscode/",
  ".idea/",
  ".vs/",
  ".vscode-test/",
  ".sublime-project",
  ".sublime-workspace",
  "*.swp",
  "*.swo",
  "*.tmp",
  
  // Lock files (consolidates package-lock.json, yarn.lock, etc.)
  "*.lock",
  "*.lockb", 
  "*.lockfile*",
  "package-lock.json",
  "yarn.lock",
  "poetry.lock",
  "Gemfile.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "Pipfile.lock",
  
  // Dependencies & build outputs
  "node_modules/",
  "**/node_modules/**",
  "vendor/",
  "Pods/",
  "Carthage/",
  "dist/",
  "**/dist/**",
  "build/",
  "**/build/**",
  "out/",
  "target/",
  ".next/",
  ".nuxt/",
  "coverage/",
  ".nyc_output/",
  ".gradle/",
  "gradle/",
  ".m2/",
  ".cargo/",
  
  // Cache & temporary directories
  ".cache/",
  "cache/",
  "tmp/",
  "temp/",
  ".tmp/",
  ".temp/",
  "*.cache",
  
  // Build caches & incremental build files
  "*.tsbuildinfo",
  ".eslintcache",
  ".parcel-cache/",
  ".webpack/",
  ".rollup.cache/",
  
  // Environment files & secrets (often contain API keys, tokens)
  ".env",
  ".env.*",
  ".env.local",
  ".env.*.local",
  "secrets/",
  "private/",
  
  // Test outputs & coverage
  "test-results/",
  "spec-results/", 
  ".coverage",
  "htmlcov/",
  ".nyc_output/",
  "coverage/",
  
  // Python environments
  "venv/",
  ".venv/",
  "env/",
  "__pycache__/",
  ".mypy_cache/",
  ".pytest_cache/",
  ".tox/",
  
  // Document files
  "*.pdf",
  "*.docx",
  "*.doc",
  "*.xls",
  "*.xlsx",
  "*.ppt",
  "*.pptx",
  
  // Image files
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.bmp",
  "*.tiff",
  "*.ico",
  "*.webp",
  "*.svg",
  
  // Media files
  "*.mp3",
  "*.mp4",
  "*.avi",
  "*.mov",
  "*.wmv",
  "*.webm",
  "*.m4a",
  "*.m4v",
  "*.m4b",
  "*.m4p",
  
  // Binary & system files
  "*.so",
  "*.so.*",
  "*.dll",
  "*.dylib",
  "*.lib",
  "*.exp",
  "*.def",
  "*.exe",
  "*.com",
  "*.sys",
  "*.bin",
  
  // Archives
  "*.tar",
  "*.gz",
  "*.bz2",
  "*.tgz",
  "*.zip",
  "*.rar",
  "*.7z",
  "*.zipx",
  "*.dmg",
  "*.pkg",
  "*.msi",
  "*.deb",
  "*.rpm",
  "*.iso",
  "*.img",
  
  // Compiled files
  "*.pyc",
  "*.pyo",
  "*.o",
  "*.obj",
  "*.class",
  "*.jar",
  "*.war",
  "*.ear",
  
  // Data files
  "*.h5",
  "*.hdf5",
  "*.hdf",
  "*.hdf4",
  "*.hdf3",
  "*.hdf2",
  "*.hdf1",
  "*.hdf0",
  "*.pkl",
  "*.sqlite",
  "*.joblib",
  "*.mat",
  "*.npz",
  "*.npy",
  "*.nii",
  
  // Font files
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.otf",
  
  // Virtual machine files
  "*.vdi",
  "*.vhd",
  "*.vmdk",
  "*.qcow2",
  "*.vhdx",
  
  // Security files
  "*.crt",
  "*.pem",
  "*.key",
  
  // System files
  ".DS_Store",
  "Thumbs.db",
  "Desktop.ini",
  "ehthumbs.db",
  
  // Script files that are usually not source
  "*.bat",
  "*.cmd",
  
  // Log files (can be huge and not relevant for code context)
  "*.log",
  "logs/",
  "log/",
  
  // Database files (large, binary, not source code)
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  
  // Backup and temporary patterns
  "*.tmp",
  "*.temp",
  "*.bak",
  "*.backup",
  "*~",
  "*.orig",
  "*.rej",
  
  // Documentation directories (often auto-generated or large)
  "docs/_build/",
  "site/",
  "_site/",
  "public/",
  
  // Package artifacts
  "*.whl",
  "*.egg-info/",
  "*.egg",
  "*.dist-info/",
  "*.dist",
  
  // More IDE artifacts
  "*.user",
  "*.userprefs",
  "*.sln.docstates",
  
  // Memory dumps & profiles
  "*.stackdump",
  "*.dmp",
  "heapdump*",
];
