const fs = require('fs-extra');
const tar = require('tar');
const path = require('path');
const crypto = require('crypto');
const diamond = require('diamondpkg');

module.exports = async (name, dist, pkg, version) => {
  if (!pkg.main) return;
  if (!/\.less|\.sass|\.scss|\.styl|\.stylus|\.css/.test(pkg.main)) return;

  const id = crypto.randomBytes(32).toString('hex');
  const p = path.join(process.cwd(), 'cdn-build', id, 'src');
  await fs.ensureDir(p);

  await fs.writeFile(path.join(process.cwd(), 'cdn-build', `${id}.tgz`), dist);

  await tar.x({ cwd: p, file: path.join(process.cwd(), 'cdn-build', `${id}.tgz`), strict: true });

  let css;
  if (!pkg.main.endsWith('.css')) css = await diamond.compile(path.join(p, pkg.main), { minify: true });
  else css = await fs.readFile(path.join(p, pkg.main));

  await version.update({ cdn: css });

  await fs.remove(path.join(process.cwd(), 'cdn-build', id));
  await fs.remove(path.join(process.cwd(), 'cdn-build', `${id}.tgz`));
};
