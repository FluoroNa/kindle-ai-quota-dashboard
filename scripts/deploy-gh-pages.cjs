'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  throw new Error('dist 目录不存在，请先运行 npm run build');
}

// Check that we're on main/master
const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: ROOT }).trim();
if (branch !== 'main' && branch !== 'master') {
  throw new Error(`请在 main 或 master 分支上运行，当前: ${branch}`);
}

// Check for uncommitted changes
const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: ROOT }).trim();
if (status) {
  process.stderr.write('警告: 工作区有未提交的更改\n');
}

const REV = execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: ROOT }).trim();
const SHORT = REV.slice(0, 7);

// Create an orphan gh-pages branch with only dist/ contents
const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'gh-pages-'));
try {
  execSync(`cp -r ${DIST}/* ${tmpDir}/`, { cwd: ROOT });
  execSync(`cp ${path.join(DIST, '.nojekyll')} ${tmpDir}/`, { cwd: ROOT });

  execSync('git init', { cwd: tmpDir });
  execSync('git checkout -b gh-pages', { cwd: tmpDir });
  execSync('git add -A', { cwd: tmpDir });
  execSync(`git commit -m "deploy ${SHORT}" --allow-empty`, { cwd: tmpDir });

  const remote = process.env.GH_REMOTE || 'origin';
  const remoteUrl = execSync(`git remote get-url ${remote}`, { encoding: 'utf8', cwd: ROOT }).trim();

  execSync(`git remote add origin ${remoteUrl}`, { cwd: tmpDir });
  execSync('git push -f origin gh-pages', { cwd: tmpDir, stdio: 'inherit' });

  process.stdout.write(`\n已部署到 GitHub Pages: dist/ → gh-pages 分支\n`);
  process.stdout.write(`提交: ${SHORT}\n`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
