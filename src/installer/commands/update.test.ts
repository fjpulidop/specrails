import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PrerequisiteError } from '../util/errors.js'
import { isDir, mkdirp, pathExists, readTextFile, writeFileLf } from '../util/fs.js'
import { initRepo } from '../util/git.js'
import { frameworkRoot, resolveArtifacts, registryPath, readRegistryOrEmpty } from '../util/registry.js'
import {
  assembleProjectWorkspace,
  ensureCurrentSymlink,
  installFramework,
} from '../phases/scaffold.js'
import { KIMI_REQUIRED_OPENSPEC_SKILLS } from './init.js'
import * as initModule from './init.js'
import { runUpdate } from './update.js'

async function setupFakeScriptDir(scriptDir: string, version: string): Promise<void> {
  writeFileLf(path.join(scriptDir, 'package.json'), `${JSON.stringify({ version })}\n`)
  writeFileLf(path.join(scriptDir, 'templates', 'agents', 'sr-architect.md'), `${version}-arch`)
  writeFileLf(path.join(scriptDir, 'templates', 'agents', 'sr-developer.md'), `${version}-dev`)
  writeFileLf(path.join(scriptDir, 'templates', 'agents', 'sr-reviewer.md'), `${version}-review`)
  writeFileLf(path.join(scriptDir, 'templates', 'rules', 'general.md'), `${version}-rules`)
  writeFileLf(
    path.join(scriptDir, 'templates', 'kimi', 'specrails', 'run-skill.mjs'),
    '// managed Kimi runner fixture\n',
  )
  writeFileLf(
    path.join(
      scriptDir,
      'templates',
      'kimi',
      'specrails',
      'vendor',
      'js-yaml',
      'js-yaml.mjs',
    ),
    '// vendored js-yaml fixture\n',
  )
  writeFileLf(
    path.join(
      scriptDir,
      'templates',
      'kimi',
      'specrails',
      'vendor',
      'js-yaml',
      'LICENSE',
    ),
    'js-yaml fixture license\n',
  )
  writeFileLf(
    path.join(
      scriptDir,
      'templates',
      'kimi',
      'specrails',
      'vendor',
      'js-yaml',
      'NOTICE.md',
    ),
    'js-yaml fixture notice\n',
  )
  writeFileLf(path.join(scriptDir, 'commands', 'enrich.md'), 'enrich')
  writeFileLf(path.join(scriptDir, 'commands', 'doctor.md'), 'doctor')
  writeFileLf(path.join(scriptDir, 'commands', 'implement.md'), 'implement')
  writeFileLf(path.join(scriptDir, 'commands', 'batch-implement.md'), 'batch')
  writeFileLf(path.join(scriptDir, 'commands', 'retry.md'), 'retry')
}

describe('runUpdate', () => {
  let tmpDir: string
  let registryHome: string
  let prevCwd: string
  let prevScriptDirOverride: string | undefined
  let prevRegistryHome: string | undefined
  let prevSkipOpenSpec: string | undefined

  /** Resolve the relocated artifact workspace for a repo (allocate so update finds it). */
  function workspaceFor(repoRoot: string): string {
    return resolveArtifacts(repoRoot, {
      allocate: true,
      home: registryHome,
      providers: ['claude'],
    }).artifactRoot
  }

  /**
   * Simulate a prior relocate-always install: allocate the registry entry and
   * write the marker + manifest into the resolved WORKSPACE (not the repo).
   */
  async function simulateExistingInstall(repoRoot: string, version: string): Promise<void> {
    mkdirp(repoRoot)
    await initRepo(repoRoot)
    const ws = workspaceFor(repoRoot)
    writeFileLf(path.join(ws, '.specrails', 'specrails-version'), `${version}\n`)
    writeFileLf(
      path.join(ws, '.specrails', 'specrails-manifest.json'),
      JSON.stringify({ version, installed_at: '2026-01-01T00:00:00Z', artifacts: {} }, null, 2),
    )
    mkdirp(path.join(ws, '.claude', 'commands', 'specrails'))
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'specrails-update-test-'))
    registryHome = mkdtempSync(path.join(os.tmpdir(), 'specrails-update-home-'))
    prevCwd = process.cwd()
    prevScriptDirOverride = process.env.SPECRAILS_CORE_SCRIPT_DIR
    prevRegistryHome = process.env.SPECRAILS_REGISTRY_HOME
    prevSkipOpenSpec = process.env.SPECRAILS_SKIP_OPENSPEC_INIT
    process.env.SPECRAILS_REGISTRY_HOME = registryHome
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(prevCwd)
    if (prevScriptDirOverride === undefined) delete process.env.SPECRAILS_CORE_SCRIPT_DIR
    else process.env.SPECRAILS_CORE_SCRIPT_DIR = prevScriptDirOverride
    if (prevRegistryHome === undefined) delete process.env.SPECRAILS_REGISTRY_HOME
    else process.env.SPECRAILS_REGISTRY_HOME = prevRegistryHome
    if (prevSkipOpenSpec === undefined) delete process.env.SPECRAILS_SKIP_OPENSPEC_INIT
    else process.env.SPECRAILS_SKIP_OPENSPEC_INIT = prevSkipOpenSpec
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    rmSync(registryHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('refuses to run when no prior install is present', async () => {
    const repoRoot = path.join(tmpDir, 'repo')
    mkdirp(repoRoot)
    await expect(
      runUpdate({ 'root-dir': repoRoot }),
    ).rejects.toBeInstanceOf(PrerequisiteError)
  })

  it('reports previous version and bumps to current version', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

    const result = await runUpdate({ 'root-dir': repoRoot })
    expect(result.previousVersion).toBe('4.2.0')
    expect(result.currentVersion).toBe('5.0.0')
    expect(result.provider).toBe('claude')

    // specrails-version file was rewritten to the new version (in the workspace).
    const ws = workspaceFor(repoRoot)
    const newVersion = readTextFile(path.join(ws, '.specrails', 'specrails-version')).trim()
    expect(newVersion).toBe('5.0.0')
  })

  it('--dry-run does not write files', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

    const result = await runUpdate({ 'root-dir': repoRoot, 'dry-run': true })
    expect(result.dryRun).toBe(true)

    // specrails-version file is unchanged (in the workspace).
    const ws = workspaceFor(repoRoot)
    const stillOld = readTextFile(path.join(ws, '.specrails', 'specrails-version')).trim()
    expect(stillOld).toBe('4.2.0')
  })

  it('dry-run with a new provider leaves the complete registry byte-identical', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
    const before = readTextFile(registryPath(registryHome))
    await runUpdate({ 'root-dir': repoRoot, provider: 'gemini', 'dry-run': true, relocate: true })
    expect(readTextFile(registryPath(registryHome))).toBe(before)
  })

  it('commits the version for an already-registered provider only after successful assembly', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
    await runUpdate({ 'root-dir': repoRoot })
    const entry = Object.values(readRegistryOrEmpty(registryHome).projects)[0]!
    expect(entry.coreVersion).toBe('5.0.0')
    expect(entry.providers).toEqual(['claude'])
  })

  it('restores migrated artifacts, markers, registry and framework pointer on failed assembly', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
    const ws = workspaceFor(repoRoot)
    const retired = path.join(ws, '.claude', 'agents', 'sr-product-manager.md')
    const custom = path.join(ws, '.claude', 'agents', 'custom-reviewer.md')
    writeFileLf(retired, 'old working role')
    writeFileLf(custom, 'user role')
    const registryBefore = readTextFile(registryPath(registryHome))
    vi.spyOn(initModule, 'reassembleWorkspaceProviders').mockImplementationOnce(() => {
      writeFileLf(path.join(ws, '.specrails', 'specrails-version'), '5.0.0')
      throw new Error('fixture assembly failed')
    })
    await expect(runUpdate({ 'root-dir': repoRoot })).rejects.toThrow('fixture assembly failed')
    expect(readTextFile(retired)).toBe('old working role')
    expect(readTextFile(custom)).toBe('user role')
    expect(readTextFile(path.join(ws, '.specrails', 'specrails-version'))).toBe('4.2.0\n')
    expect(readTextFile(registryPath(registryHome))).toBe(registryBefore)
    expect(pathExists(path.join(frameworkRoot(registryHome), 'current'))).toBe(false)
    expect(pathExists(path.join(frameworkRoot(registryHome), '5.0.0'))).toBe(false)
  })

  it('refreshes all copied in-repo providers before reporting the shared version', async () => {
    const scriptDir = path.join(tmpDir, 'core-copied')
    const repoRoot = path.join(tmpDir, 'copied-repo')
    const fwDir = frameworkRoot(registryHome)
    mkdirp(repoRoot)
    await setupFakeScriptDir(scriptDir, '4.2.0')
    for (const provider of ['claude', 'gemini'] as const) {
      installFramework({ scriptDir, frameworkDir: fwDir, provider, providerDir: '.' + provider, version: '4.2.0' })
    }
    ensureCurrentSymlink(fwDir, '4.2.0')
    for (const provider of ['claude', 'gemini'] as const) {
      assembleProjectWorkspace({ workspace: repoRoot, codeRoot: repoRoot, scriptDir, frameworkDir: fwDir, provider, providerDir: '.' + provider, version: '4.2.0', copyStatics: true })
    }
    const geminiAgent = path.join(repoRoot, '.gemini', 'agents', 'sr-architect.md')
    expect(readTextFile(geminiAgent)).toContain('4.2.0-arch')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
    await runUpdate({ 'root-dir': repoRoot, provider: 'claude' })
    expect(readTextFile(geminiAgent)).toContain('5.0.0-arch')
    expect(readTextFile(path.join(repoRoot, '.specrails', 'specrails-version')).trim()).toBe('5.0.0')
    expect(isDir(path.join(fwDir, '4.2.0'))).toBe(true)
  })

  it('refuses an older CLI before modifying an updated workspace', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '5.1.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
    const before = readTextFile(registryPath(registryHome))
    await expect(runUpdate({ 'root-dir': repoRoot })).rejects.toThrow('Refusing to downgrade')
    expect(readTextFile(registryPath(registryHome))).toBe(before)
    expect(readTextFile(path.join(workspaceFor(repoRoot), '.specrails', 'specrails-version'))).toBe('5.1.0\n')
  })

  it('preserves reserved paths (profiles + custom-* agents)', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

    // Reserved regions live under the relocated workspace now.
    const ws = workspaceFor(repoRoot)
    writeFileLf(
      path.join(ws, '.specrails', 'profiles', 'team.json'),
      '{"name":"team-profile"}',
    )
    writeFileLf(
      path.join(ws, '.claude', 'agents', 'custom-reviewer.md'),
      'custom reviewer content',
    )

    await runUpdate({ 'root-dir': repoRoot })

    // Reserved files remain byte-identical.
    expect(
      readTextFile(path.join(ws, '.specrails', 'profiles', 'team.json')),
    ).toBe('{"name":"team-profile"}')
    expect(
      readTextFile(path.join(ws, '.claude', 'agents', 'custom-reviewer.md')),
    ).toBe('custom reviewer content')
  })

  describe('install-config.yaml is honoured on update', () => {
    it('tolerates a legacy tier key in install-config.yaml and places the core agents', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      writeFileLf(
        path.join(repoRoot, '.specrails', 'install-config.yaml'),
        [
          'version: 1',
          'provider: claude',
          'tier: quick',
          'agents:',
          '  selected: [sr-architect, sr-developer]',
          '',
        ].join('\n'),
      )
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot })
      expect(result.provider).toBe('claude')
      // Placement happened: bundled agents are in <ws>/.claude/agents/
      // (not just under setup-templates/).
      const ws = workspaceFor(repoRoot)
      expect(pathExists(path.join(ws, '.claude', 'agents', 'sr-architect.md'))).toBe(true)
    })

    it('runs without an install-config.yaml', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot })
      expect(result.provider).toBe('claude')
    })
  })

  describe('--provider override (multi-provider)', () => {
    it('updates the FORCED provider even when .claude exists (auto-detect would pick claude)', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      // Multi-provider workspace: both .claude (created by simulateExistingInstall)
      // and .gemini are present. Auto-detection returns claude (.claude first).
      mkdirp(path.join(workspaceFor(repoRoot), '.gemini', 'commands', 'specrails'))
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      // Keep the real child-process and skill-normalization path, but do not
      // let this provider-selection regression download OpenSpec via npx.
      const invocationLog = path.join(tmpDir, 'openspec-invocation.json')
      const openspecCli = path.join(tmpDir, 'local openspec fixture.mjs')
      writeFileLf(openspecCli, `
import fs from 'node:fs'
import path from 'node:path'
const args = process.argv.slice(2)
fs.writeFileSync(${JSON.stringify(invocationLog)}, JSON.stringify(args))
if (args[0] !== 'init' || args[1] !== '--tools' || args[2] !== 'gemini') {
  throw new Error('Unexpected OpenSpec invocation')
}
for (const skill of ${JSON.stringify(KIMI_REQUIRED_OPENSPEC_SKILLS)}) {
  const directory = path.join(args.at(-1), '.gemini', 'skills', skill)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'SKILL.md'), 'generated:' + skill + String.fromCharCode(10))
}
`)
      vi.stubEnv('SPECRAILS_OPENSPEC_NODE', process.execPath)
      vi.stubEnv('SPECRAILS_OPENSPEC_BIN', openspecCli)
      vi.stubEnv('SPECRAILS_SKIP_OPENSPEC_INIT', '0')
      try {
        const result = await runUpdate({ 'root-dir': repoRoot, provider: 'gemini' })
        expect(result.provider).toBe('gemini')
        expect(JSON.parse(readTextFile(invocationLog))).toEqual([
          'init', '--tools', 'gemini', '--profile', 'custom', realpathSync(repoRoot),
        ])
        const artifactRoot = workspaceFor(repoRoot)
        for (const skill of KIMI_REQUIRED_OPENSPEC_SKILLS) {
          expect(readTextFile(path.join(artifactRoot, '.gemini', 'skills', skill, 'SKILL.md')))
            .toBe(`generated:${skill}\n`)
          expect(pathExists(path.join(repoRoot, '.gemini', 'skills', skill))).toBe(false)
        }
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('adds and refreshes Kimi without altering another provider or user-owned Kimi files', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      const ws = workspaceFor(repoRoot)
      writeFileLf(
        path.join(ws, '.specrails', 'specrails-manifest.json'),
        `${JSON.stringify(
          {
            version: '4.2.0',
            installed_at: '2026-01-01T00:00:00Z',
            providers: ['claude'],
            primary_provider: 'claude',
            artifacts: {},
          },
          null,
          2,
        )}\n`,
      )
      writeFileLf(
        path.join(ws, '.claude', 'commands', 'specrails', 'user-byte.md'),
        'claude-user-byte-content\n',
      )
      writeFileLf(
        path.join(ws, '.kimi-code', 'mcp.json'),
        '{"mcpServers":{"user-owned":{"command":"keep"}}}\n',
      )
      writeFileLf(
        path.join(
          ws,
          '.kimi-code',
          'skills',
          'rails',
          'custom-auditor',
          'SKILL.md',
        ),
        'custom-kimi-role-byte-content\n',
      )
      for (const skill of KIMI_REQUIRED_OPENSPEC_SKILLS) {
        writeFileLf(
          path.join(repoRoot, '.kimi', 'skills', skill, 'SKILL.md'),
          `fresh:${skill}\n`,
        )
      }
      writeFileLf(
        path.join(repoRoot, '.kimi', 'skills', 'user-skill', 'SKILL.md'),
        'repo-user-skill\n',
      )
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
      process.env.SPECRAILS_SKIP_OPENSPEC_INIT = '1'

      const result = await runUpdate({ 'root-dir': repoRoot, provider: 'kimi' })
      expect(result.provider).toBe('kimi')
      expect(
        readTextFile(
          path.join(ws, '.claude', 'commands', 'specrails', 'user-byte.md'),
        ),
      ).toBe('claude-user-byte-content\n')
      expect(readTextFile(path.join(ws, '.kimi-code', 'mcp.json'))).toBe(
        '{"mcpServers":{"user-owned":{"command":"keep"}}}\n',
      )
      expect(
        readTextFile(
          path.join(
            ws,
            '.kimi-code',
            'skills',
            'custom-auditor',
            'SKILL.md',
          ),
        ),
      ).toBe('custom-kimi-role-byte-content\n')
      for (const skill of KIMI_REQUIRED_OPENSPEC_SKILLS) {
        expect(
          readTextFile(path.join(ws, '.kimi-code', 'skills', skill, 'SKILL.md')),
        ).toBe(`fresh:${skill}\n`)
      }
      expect(
        readTextFile(
          path.join(repoRoot, '.kimi', 'skills', 'user-skill', 'SKILL.md'),
        ),
      ).toBe('repo-user-skill\n')
      const manifest = JSON.parse(
        readTextFile(path.join(ws, '.specrails', 'specrails-manifest.json')),
      ) as { providers: string[]; primary_provider: string }
      expect(manifest.providers).toEqual(['claude', 'kimi'])
      expect(manifest.primary_provider).toBe('claude')
      const registryResolution = resolveArtifacts(repoRoot, { home: registryHome })
      expect(registryResolution.providers).toEqual(['claude', 'kimi'])
      expect(registryResolution.primaryProvider).toBe('claude')
    })

    it('updates to Kimi 4.12 without breaking a Claude workspace linked through 4.11 current', async () => {
      const scriptDir = path.join(tmpDir, 'core-cross-version')
      const repoRoot = path.join(tmpDir, 'repo-cross-version')
      await setupFakeScriptDir(scriptDir, '4.11.0')
      await simulateExistingInstall(repoRoot, '4.11.0')
      const ws = workspaceFor(repoRoot)
      const fwDir = frameworkRoot(registryHome)

      // Build the actual 4.11 Claude framework/workspace link topology that the
      // update must preserve (the generic update fixture otherwise only writes
      // an installation marker).
      installFramework({
        scriptDir,
        frameworkDir: fwDir,
        provider: 'claude',
        providerDir: '.claude',
        version: '4.11.0',
      })
      ensureCurrentSymlink(fwDir, '4.11.0')
      assembleProjectWorkspace({
        workspace: ws,
        frameworkDir: fwDir,
        provider: 'claude',
        providerDir: '.claude',
        version: '4.11.0',
        codeRoot: repoRoot,
        scriptDir,
      })
      writeFileLf(
        path.join(ws, '.claude', 'agents', 'custom-owner.md'),
        'user-owned-claude-agent\n',
      )
      expect(readTextFile(path.join(ws, '.claude', 'agents', 'sr-architect.md'))).toBe(
        '4.11.0-arch',
      )

      await setupFakeScriptDir(scriptDir, '4.12.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
      process.env.SPECRAILS_SKIP_OPENSPEC_INIT = '1'
      const result = await runUpdate({
        'root-dir': repoRoot,
        provider: 'kimi',
      })

      expect(result.previousVersion).toBe('4.11.0')
      expect(result.currentVersion).toBe('4.12.0')
      expect(result.provider).toBe('kimi')
      expect(isDir(path.join(fwDir, '4.12.0', '.claude'))).toBe(true)
      expect(isDir(path.join(fwDir, '4.12.0', '.kimi-code'))).toBe(true)

      // The pre-existing Claude symlink follows the one global pointer into a
      // destination that still contains Claude, and user-owned files survive.
      expect(readTextFile(path.join(ws, '.claude', 'agents', 'sr-architect.md'))).toBe(
        '4.12.0-arch',
      )
      expect(
        readTextFile(path.join(ws, '.claude', 'agents', 'custom-owner.md')),
      ).toBe('user-owned-claude-agent\n')
      expect(
        pathExists(path.join(ws, '.kimi-code', 'skills', 'sr-architect', 'SKILL.md')),
      ).toBe(true)
      expect(pathExists(path.join(ws, '.kimi-code', 'specrails', 'run-skill.mjs'))).toBe(true)

      const manifest = JSON.parse(
        readTextFile(path.join(ws, '.specrails', 'specrails-manifest.json')),
      ) as { providers: string[]; primary_provider: string }
      expect(manifest.providers).toEqual(['claude', 'kimi'])
      expect(manifest.primary_provider).toBe('claude')
    })

    it('auto-detects (claude first) when --provider is omitted — backward compatible', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      mkdirp(path.join(workspaceFor(repoRoot), '.gemini', 'commands', 'specrails'))
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot })
      expect(result.provider).toBe('claude')
    })

    it('rejects an invalid --provider value', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      await expect(
        runUpdate({ 'root-dir': repoRoot, provider: 'bogus' }),
      ).rejects.toThrow(/--provider value must be 'claude', 'codex', 'gemini', or 'kimi'/)
    })
  })

  describe('--only flag', () => {
    it('defaults to scope=all when --only is omitted', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot })
      expect(result.scope).toBe('all')
    })

    it('--only=rules refreshes only the rules subtree', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot, only: 'rules' })
      expect(result.scope).toBe('rules')
      const ws = workspaceFor(repoRoot)
      // Rules staging is populated (under the workspace).
      expect(pathExists(path.join(ws, '.specrails', 'setup-templates', 'rules', 'general.md'))).toBe(true)
      // A component refresh must not claim the entire framework was upgraded.
      const manifest = JSON.parse(
        readTextFile(path.join(ws, '.specrails', 'specrails-manifest.json')),
      )
      expect(manifest.version).toBe('4.2.0')
      expect(result.installedVersion).toBe('4.2.0')
    })

    it('--only=agents refreshes only the agents subtree', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot, only: 'agents' })
      expect(result.scope).toBe('agents')
      expect(pathExists(path.join(workspaceFor(repoRoot), '.specrails', 'setup-templates', 'agents', 'sr-architect.md'))).toBe(true)
    })

    it('fails closed for partial Kimi refreshes before bumping manifest/version', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir
      const versionPath = path.join(
        workspaceFor(repoRoot),
        '.specrails',
        'specrails-version',
      )

      await expect(
        runUpdate({
          'root-dir': repoRoot,
          provider: 'kimi',
          only: 'rules',
        }),
      ).rejects.toThrow(/cannot safely refresh Kimi/)
      expect(readTextFile(versionPath).trim()).toBe('4.2.0')
    })

    it('--only=web-manager warns and exits without writing (deprecated)', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot, only: 'web-manager' })
      expect(result.scope).toBe('web-manager')
      // specrails-version unchanged (in the workspace).
      expect(readTextFile(path.join(workspaceFor(repoRoot), '.specrails', 'specrails-version')).trim()).toBe('4.2.0')
    })

    it('--only=core re-applies the full bundled template layer', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot, only: 'core' })
      expect(result.scope).toBe('core')
      // Bundled commands present (full scaffold ran) — under the workspace.
      expect(pathExists(path.join(workspaceFor(repoRoot), '.claude', 'commands', 'specrails', 'enrich.md'))).toBe(true)
    })

    it('unknown --only value falls back to scope=all with a warning', async () => {
      const scriptDir = path.join(tmpDir, 'core')
      const repoRoot = path.join(tmpDir, 'repo')
      await setupFakeScriptDir(scriptDir, '5.0.0')
      await simulateExistingInstall(repoRoot, '4.2.0')
      process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

      const result = await runUpdate({ 'root-dir': repoRoot, only: 'bogus' })
      expect(result.scope).toBe('all')
    })
  })

  it('refreshes the manifest version to match the installed core', async () => {
    const scriptDir = path.join(tmpDir, 'core')
    const repoRoot = path.join(tmpDir, 'repo')
    await setupFakeScriptDir(scriptDir, '5.0.0')
    await simulateExistingInstall(repoRoot, '4.2.0')
    process.env.SPECRAILS_CORE_SCRIPT_DIR = scriptDir

    await runUpdate({ 'root-dir': repoRoot })

    const ws = workspaceFor(repoRoot)
    const manifest = JSON.parse(
      readTextFile(path.join(ws, '.specrails', 'specrails-manifest.json')),
    )
    expect(manifest.version).toBe('5.0.0')
    // Artifacts map contains an entry for the bundled doctor command.
    expect(manifest.artifacts['commands/specrails/doctor.md']).toBeDefined()
    expect(pathExists(path.join(ws, '.claude', 'commands', 'specrails', 'doctor.md'))).toBe(
      true,
    )
  })
})
