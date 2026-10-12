# 📝 Changelog

## [1.1.0] — 2026-10-12

### ✨ Editor and projects

- Bundle Monaco and language workers locally, removing the editor's CDN dependency.
- Preserve unsaved edits when creating files or switching files and projects.
- Keep drafts after failed saves and show errors for retry.
- Save the latest text with Ctrl/Cmd + S and prevent delayed project requests from replacing the current project's files.
- Validate file paths, handle renames, and roll back file records after disk errors.

### 🐳 Execution

- Repair all eight language images, including writable workspaces and offline C# builds.
- Run renamed and nested entry files with working relative imports.
- Make Stop available while execution is being prepared, and clean up cancelled, timed-out, or disconnected runs.
- Supply stdin and close it correctly; cap captured output at 100 KiB without corrupting UTF-8 characters.
- Disable container networking and apply memory, CPU, and process limits.
- Keep Docker as the default and require explicit configuration for host execution.

### 🧪 Maintenance

- Update development tooling and dependency lockfiles; full npm audits reported zero known vulnerabilities at release validation.
- Validate 41 backend tests, 21 real Docker integration scenarios, and 15 browser scenarios before release.
- Document installation, storage limitations, release screenshots, license scope, and third-party media exceptions.

[1.1.0]: https://github.com/snowtravit/snow-local-ide/releases/tag/v1.1.0
