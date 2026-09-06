import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isMain, npm, validateArtifact, releaseVersion } from './release-utils.mjs'

export function compareStableVersions(a, b) {
  const aa = releaseVersion('v' + a).split('.').map(BigInt)
  const bb = releaseVersion('v' + b).split('.').map(BigInt)
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1
  return 0
}
export async function assertMonotonicRelease(version, fetchImpl = fetch) {
  releaseVersion('v' + version)
  const response = await fetchImpl('https://registry.npmjs.org/specrails-core/latest', { signal: AbortSignal.timeout(30_000) })
  if (response.status === 404) return
  if (!response.ok) throw new Error(`Cannot verify npm latest: HTTP ${response.status}`)
  const latest = await response.json()
  if (latest.name !== 'specrails-core' || compareStableVersions(version, latest.version) < 0) throw new Error('Refusing to publish an older release or move npm latest backwards')
}
export async function publishedState(version, expectedIntegrity, fetchImpl = fetch) {
  const response = await fetchImpl(`https://registry.npmjs.org/specrails-core/${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(30_000) })
  if (response.status === 404) return 'new'
  if (!response.ok) throw new Error(`npm registry check failed: HTTP ${response.status}`)
  const published = await response.json()
  if (published.name !== 'specrails-core' || published.version !== version || published.dist?.integrity !== expectedIntegrity) throw new Error('This npm version already exists with different bytes; never overwrite or silently accept it')
  return 'identical'
}
// Kept separate for hermetic tests; importing this module never publishes.
export function readArtifact(directory, expected) {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'release-manifest.json'), 'utf8'))
  if (!/^specrails-core-\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\.tgz$/.test(manifest.filename)) throw new Error('Unsafe package artifact filename')
  const file = path.join(directory, manifest.filename)
  validateArtifact(manifest, readFileSync(file), expected)
  return { manifest, file }
}
if (isMain(import.meta.url)) {
  try {
    const { manifest, file } = readArtifact(process.argv[2], { version: process.env.RELEASE_VERSION, sha: process.env.RELEASE_SHA })
    await assertMonotonicRelease(manifest.version)
    if (await publishedState(manifest.version, manifest.integrity) === 'new') {
      const npmVersion = npm(['--version'])
      if (compareStableVersions(npmVersion, '11.5.1') < 0) throw new Error('Publication requires npm >=11.5.1 for trusted-publisher compatibility')
      npm(['publish', file, '--ignore-scripts', '--provenance', '--access', 'public'], { timeout: 180_000 })
      console.log(`Published verified artifact ${manifest.filename}`)
    } else console.log(`Identical ${manifest.filename} is already published; continuing release notifications`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
