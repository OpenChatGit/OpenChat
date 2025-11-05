# Version Management

OpenChat uses semantic versioning (MAJOR.MINOR.PATCH) across all components.

## Version Synchronization

The version number is maintained in multiple files:
- `package.json` - Source of truth
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/Cargo.toml` - Rust package
- `src/services/updateChecker.ts` - Fallback version

### Automatic Sync

To update the version across all files, use the sync script:

```bash
# Sync current version from package.json
npm run sync-version

# Set a new version and sync
npm run sync-version 0.6.0
```

### Manual Version Update

If you prefer to update manually:

1. Update `package.json` version
2. Run `npm run sync-version`
3. Update `CHANGELOG.md`
4. Commit changes
5. Create git tag: `git tag v0.6.0`
6. Push with tags: `git push --tags`

### Using npm version

You can also use npm's built-in version command, which automatically runs the sync:

```bash
# Bump patch version (0.5.8 -> 0.5.9)
npm version patch

# Bump minor version (0.5.8 -> 0.6.0)
npm version minor

# Bump major version (0.5.8 -> 1.0.0)
npm version major

# Set specific version
npm version 1.0.0
```

The `version` script in package.json automatically syncs all files and stages them for commit.

## Dynamic Version Detection

The application dynamically detects its version at runtime:

1. **In Development**: Imports version directly from `package.json`
2. **In Production (Tauri)**: Uses `@tauri-apps/api/app.getVersion()` from compiled binary
3. **Fallback**: Uses `package.json` version if Tauri API fails

This ensures the update checker always knows the correct current version, whether running in dev or production.

### Version Debug Tool

In development mode, a debug panel appears in the bottom-left corner showing:
- package.json version
- Tauri API version (if available)
- Current environment (Tauri/Browser)
- Build mode (Development/Production)

This helps verify that version detection is working correctly.

## Update Checking

The update checker compares the current version with the latest GitHub release:

- Checks every 6 hours
- Caches results in localStorage
- Shows notification when update is available
- Provides direct download link

### Dev vs Production

- **Dev builds**: Version is read from Tauri config (0.5.8)
- **Production builds**: Version is embedded in the binary
- Both use the same dynamic detection mechanism

## Release Process

1. Update version: `npm version minor` (or patch/major)
2. Update CHANGELOG.md with release notes
3. Commit: `git commit -m "Release v0.6.0"`
4. Push: `git push && git push --tags`
5. Create GitHub release from the tag
6. Attach build artifacts (.msi, .exe)

The update checker will automatically detect the new release.
