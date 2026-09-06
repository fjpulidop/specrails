import { appendFileSync } from 'node:fs'
import { isMain, validateRelease } from './release-utils.mjs'
if (isMain(import.meta.url)) {
  try {
    const release = validateRelease(process.cwd(), process.env.RELEASE_TAG, process.env.EXPECTED_SHA || undefined)
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${release.version}\nsha=${release.sha}\n`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
