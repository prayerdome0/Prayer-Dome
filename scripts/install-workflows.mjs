// Installs the GitHub Actions workflows this repository ships with.
//
// The GitHub App that pushes arena branches cannot create or update files
// under .github/workflows/ (GitHub rejects the push without the `workflows`
// permission). A maintainer with normal repository access runs this script
// once:
//
//     node scripts/install-workflows.mjs
//
// It copies the production workflow definitions into .github/workflows/ and
// commits them. From then on every push runs the full verification suite and
// the Android build produces installable APK/AAB artifacts on GitHub.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(repoRoot, '.github', 'workflows');

const workflows = [
  { from: path.join(repoRoot, 'ci', 'verify.yml'), to: 'verify.yml' },
  { from: path.join(repoRoot, 'mobile', 'android-build.yml'), to: 'android.yml' }
];

await mkdir(targetDir, { recursive: true });
for (const wf of workflows) {
  await copyFile(wf.from, path.join(targetDir, wf.to));
  console.log('Installed', path.join('.github/workflows', wf.to));
}

try {
  execFileSync('git', ['add', '.github'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-m', 'ci: enable Verify and Android CI workflows'], { cwd: repoRoot });
  console.log('\nCommitted. Push to activate: git push');
} catch {
  console.log('\nCopied workflows (nothing to commit — already installed).');
}
