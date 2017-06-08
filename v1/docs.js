const fs = require('fs-extra');
const tar = require('tar');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const sassdoc = require('sassdoc');

module.exports = async (name, dist) => {
  const id = crypto.randomBytes(32).toString('hex');
  const p = path.join(process.cwd(), 'docs-build', id, 'src');
  await fs.ensureDir(p);

  await fs.writeFile(path.join(process.cwd(), 'docs-build', `${id}.tgz`), dist);

  await tar.x({ cwd: p, file: path.join(process.cwd(), 'docs-build', `${id}.tgz`), strict: true });

  let config = {};
  if (fs.existsSync(path.join(p, '.sassdocrc'))) {
    try {
      config = JSON.parse(await fs.readFile(path.join(p, '.sassdocrc'), 'utf8'));
    } catch (err) {
      try {
        config = yaml.safeLoad(await fs.readFile(path.join(p, '.sassdocrc'), 'utf8'));
      } catch (_) {
        config = {};
      }
    }
  }

  Object.assign(config, { dest: path.join(process.cwd(), 'docs-build', id, 'doc') });

  try {
    await sassdoc([`${p}/**/*.{sass,scss}`, '!node_modules/**/*'], config);
  } catch (err) {
    console.error(err);
    return;
  }

  await fs.ensureDir(path.join(process.cwd(), 'docs', name));
  await fs.copy(path.join(process.cwd(), 'docs-build', id, 'doc'), path.join(process.cwd(), 'docs', name));
  await fs.remove(path.join(process.cwd(), 'docs-build', id));
  await fs.remove(path.join(process.cwd(), 'docs-build', `${id}.tgz`));
};
