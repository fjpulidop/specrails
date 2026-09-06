import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { KIMI_REQUIRED_OPENSPEC_SKILLS, normalizeGeminiOpenSpecSkills } from './init.js'
import { pathExists, readTextFile, writeFileLf } from '../util/fs.js'

const temps: string[] = []
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }) })
describe('Gemini OpenSpec execution workspace', () => {
  it('refreshes all generated skills outside the repo while preserving custom skills', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'specrails-gemini-skills-')); temps.push(dir)
    const repo = path.join(dir, 'repo'), workspace = path.join(dir, 'workspace')
    for (const revision of ['first', 'updated']) {
      for (const skill of KIMI_REQUIRED_OPENSPEC_SKILLS) writeFileLf(path.join(repo, '.gemini', 'skills', skill, 'SKILL.md'), `${revision}:${skill}`)
      writeFileLf(path.join(workspace, '.gemini', 'skills', 'custom-owner', 'SKILL.md'), 'preserve user')
      expect(normalizeGeminiOpenSpecSkills(repo, workspace)).toHaveLength(KIMI_REQUIRED_OPENSPEC_SKILLS.length)
      for (const skill of KIMI_REQUIRED_OPENSPEC_SKILLS) {
        expect(readTextFile(path.join(workspace, '.gemini', 'skills', skill, 'SKILL.md'))).toBe(`${revision}:${skill}`)
        expect(pathExists(path.join(repo, '.gemini', 'skills', skill))).toBe(false)
      }
      expect(readTextFile(path.join(workspace, '.gemini', 'skills', 'custom-owner', 'SKILL.md'))).toBe('preserve user')
    }
  })
  it('fails on incomplete inventory before moving the successfully generated skill', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'specrails-gemini-missing-')); temps.push(dir)
    const repo = path.join(dir, 'repo'), workspace = path.join(dir, 'workspace')
    const skill = path.join(repo, '.gemini', 'skills', 'openspec-apply-change', 'SKILL.md')
    writeFileLf(skill, 'valid generated source')
    expect(() => normalizeGeminiOpenSpecSkills(repo, workspace)).toThrow(/required gemini skill/)
    expect(readTextFile(skill)).toBe('valid generated source')
    expect(pathExists(path.join(workspace, '.gemini', 'skills', 'openspec-apply-change'))).toBe(false)
  })
})
