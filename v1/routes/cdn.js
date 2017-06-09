const Router = require('restify-router').Router;
const ver = require('../../package.json').version;

const { Package } = require('../../db');

const router = new Router();

router.get('/', async (req, res) => {
  res.send(200, {
    name: 'diamond-cdn',
    version: ver,
    packages: await Package.count(),
  });
});

async function handler(req, res) {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(404);

  let version = (await pkg.getVersions({ where: { version: req.params.version } }))[0];
  const tag = (await pkg.getTags({ where: { name: req.params.version || 'latest' } }))[0];
  if (!version && !tag) return res.send(404);
  if (tag) version = await tag.getVersion();

  if (!version.get('cdn')) return res.send(404);

  const content = `/* ${pkg.get('name')}@${version.get('version')} - Served by diamond CDN */\n\n${version.get('cdn')}`;

  res.writeHead(200, { 'Content-Length': Buffer.byteLength(content), 'Content-Type': 'text/css' });
  res.write(content);
  return res.end();
}

router.get('/:name', handler);
router.get('/:name/:version', handler);

module.exports = router;
