#!/usr/bin/env node

/**
 * Version Sync Script
 * 
 * Synchronizes version numbers across all project files:
 * - package.json (source of truth)
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml
 * - src/services/updateChecker.ts
 * 
 * Usage: node scripts/sync-version.js [new-version]
 * If no version is provided, it will use the version from package.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Get version from command line or package.json
const newVersion = process.argv[2]

function getPackageVersion() {
  const packagePath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
  return packageJson.version
}

function updatePackageJson(version) {
  const packagePath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
  packageJson.version = version
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log(`✓ Updated package.json to ${version}`)
}

function updateTauriConfig(version) {
  const configPath = join(rootDir, 'src-tauri', 'tauri.conf.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  config.version = version
  config.app.windows[0].title = `OpenChat v${version}`
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log(`✓ Updated src-tauri/tauri.conf.json to ${version}`)
}

function updateCargoToml(version) {
  const cargoPath = join(rootDir, 'src-tauri', 'Cargo.toml')
  let content = readFileSync(cargoPath, 'utf-8')
  content = content.replace(/^version = ".*"$/m, `version = "${version}"`)
  writeFileSync(cargoPath, content)
  console.log(`✓ Updated src-tauri/Cargo.toml to ${version}`)
}

function updateUpdateChecker(version) {
  // Note: updateChecker.ts now imports version from package.json directly
  // This function is kept for backwards compatibility but does nothing
  console.log(`✓ src/services/updateChecker.ts uses package.json (${version})`)
}

function validateVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+$/
  if (!semverRegex.test(version)) {
    console.error(`❌ Invalid version format: ${version}`)
    console.error('   Version must follow semantic versioning (e.g., 0.5.8)')
    process.exit(1)
  }
}

// Main execution
try {
  const version = newVersion || getPackageVersion()
  
  console.log(`\n🔄 Synchronizing version to ${version}...\n`)
  
  validateVersion(version)
  
  if (newVersion) {
    updatePackageJson(version)
  }
  
  updateTauriConfig(version)
  updateCargoToml(version)
  updateUpdateChecker(version)
  
  console.log(`\n✅ All version numbers synchronized to ${version}`)
  console.log('\n📝 Don\'t forget to:')
  console.log('   1. Update CHANGELOG.md')
  console.log('   2. Commit the changes')
  console.log('   3. Create a git tag: git tag v' + version)
  console.log('   4. Push with tags: git push --tags\n')
} catch (error) {
  console.error('❌ Error syncing versions:', error.message)
  process.exit(1)
}
