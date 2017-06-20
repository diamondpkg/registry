const fs = require('fs');
const cdn = require('../cdn');
const docs = require('../docs');
const auth = require('../auth');
const crypto = require('crypto');
// const Canvas = require('canvas');
const semver = require('semver');
const moment = require('moment');
const utils = require('../utils');
const restify = require('restify');
const truncate = require('truncate');
const Router = require('restify-router').Router;
const { User, Package, Version, Tag } = require('../../db');

const router = new Router();

router.get('/package/:name', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  return res.send(200, await utils.getAdvPackageInfo(req, pkg));
});

router.get('/package/:name/:version', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  let version = (await pkg.getVersions({ where: { version: req.params.version } }))[0];
  const tag = (await pkg.getTags({ where: { name: req.params.version } }))[0];
  if (!version && !tag) return res.send(new restify.NotFoundError('Invalid version/tag'));

  if (tag) version = await tag.getVersion();

  let download = (await pkg.getDownloads({
    where: { date: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth())) },
  }))[0];
  if (!download) {
    download = await pkg.createDownload();
  }

  await pkg.update({
    downloads: pkg.get('downloads') + 1,
    weeklyDownloads: pkg.get('weeklyDownloads') + 1,
  });

  await download.update({
    count: download.get('count') + 1,
  });

  res.writeHead(200, { 'Content-Length': Buffer.byteLength(version.dist), 'Content-Type': 'application/octet-stream' });
  res.write(version.dist);
  return res.end();
});

router.post('/package/:name', auth, async (req, res) => {
  if (!req.params.package || !req.params.dist) return res.send(new restify.BadRequestError('Missing package.json and/or dist file'));

  const data = JSON.parse(req.params.package);
  if (!data.version) return res.send(new restify.BadRequestError('Missing package version'));
  if (!semver.valid(data.version)) return res.send(new restify.BadRequestError('Invalid version'));

  const existingPackage = await Package.findById(req.params.name.toLowerCase());
  if (existingPackage && !await existingPackage.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  const v = await Version.findById(`${req.params.name.toLowerCase()}@${data.version}`);
  if (v) return res.send(new restify.ConflictError(`Version '${data.version}' already exists`));

  let pkg = existingPackage;
  if (!pkg) {
    pkg = await Package.create({
      name: req.params.name.toLowerCase(),
      description: data.description,
    });

    await pkg.addAuthor(req.user);
    await req.user.addPackage(pkg);
  }

  const version = await Version.create({
    id: `${req.params.name.toLowerCase()}@${data.version}`,
    package: req.params.name.toLowerCase(),
    version: data.version,
    readme: req.params.readme ? req.params.readme.toString() : undefined,
    data: JSON.stringify(data),
    shasum: crypto.createHash('sha256').update(req.params.dist).digest('hex'),
    dist: req.params.dist,
  });

  await pkg.addVersion(version);

  let latest = (await pkg.getTags({ where: { name: 'latest' } }))[0];
  if (!latest) {
    latest = await Tag.create({ name: 'latest' });
    await pkg.addTag(latest);
  }

  await latest.setVersion(version);

  cdn(req.params.name.toLowerCase(), req.params.dist, data, version);
  docs(req.params.name.toLowerCase(), req.params.dist);

  return res.send(200, await utils.getPackageVersionInfo(req, pkg, version));
});

router.get('/packages', async (req, res) => {
  const limit = req.params.limit || 50;
  if (limit > 100) return res.send(new restify.BadRequestError('limit must be less than 100'));

  let packages = await Package.findAll();

  packages.sort((a, b) => {
    const aVal = a.get('downloads') / (moment() - moment(a.get('createdAt')));
    const bVal = b.get('downloads') / (moment() - moment(b.get('createdAt')));

    if (aVal < bVal) return 1;
    else if (aVal > bVal) return -1;
    return 0;
  });

  packages = packages.splice(0, limit);

  const promises = [];
  const response = [];
  for (const pkg of packages) {
    promises.push((async () => {
      response.push(await utils.getPackageVersionInfo(req, pkg, (await (await pkg.getTags({ where: { name: 'latest' } }))[0].getVersion())));
    })());
  }

  await Promise.all(promises);

  return res.send(200, response);
});

router.post('/package/:name/rebuild', auth, async (req, res) => {
  if (req.user.get('username') !== 'hackzzila') return res.send(new restify.ForbiddenError('Forbidden'));

  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  const version = (await (await pkg.getTags({ where: { name: 'latest' } }))[0].getVersion());

  cdn(req.params.name.toLowerCase(), version.get('dist'), JSON.parse(version.get('data')), version);
  docs(req.params.name.toLowerCase(), version.get('dist'));

  return res.send(204);
});

router.del('/package/:name', auth, async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  for (const version of await pkg.getVersions()) {
    await version.destroy();
  }

  for (const tag of await pkg.getTags()) {
    await tag.destroy();
  }

  await pkg.destroy();

  return res.send(204);
});

router.del('/package/:name/:version', auth, async (req, res) => {
  if (!semver.valid(req.params.version)) return res.send(new restify.BadRequestError('Invalid version'));

  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  if (!await pkg.hasVersion(`${req.params.name}@${req.params.version}`)) return res.send(new restify.NotFoundError('Invalid version'));

  for (const tag of await pkg.getTags()) {
    if (await tag.getVersion().get('version') === req.params.version) await tag.destroy();
  }

  await (await pkg.getVersions({ where: { version: req.params.version } }))[0].destroy();

  if (await pkg.countVersions() === 0) await pkg.destroy();
  else {
    let latest = (await pkg.getTags({ where: { name: 'latest' } }))[0];
    if (!latest) {
      latest = await Tag.create({ name: 'latest' });
      await pkg.addTag(latest);
      await latest.setVersion(await Version.findOne({ order: [['createdAt', 'DESC']], where: { package: req.params.name.toLowerCase() } }));
    }
  }


  return res.send(204);
});

router.post('/package/:name/author/:user', auth, async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  const user = await User.findById(req.params.user.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!user) return res.send(new restify.BadRequestError('Invalid user'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  await pkg.addAuthor(user);
  await user.addPackage(pkg);

  return res.send(200, await utils.getPackageAuthors(pkg));
});

router.del('/package/:name/author/:user', auth, async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  const user = await User.findById(req.params.user.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!user) return res.send(new restify.BadRequestError('Invalid user'));
  if (!pkg.hasAuthor(user)) return res.send(new restify.BadRequestError('User is not an author'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  await pkg.removeAuthor(user);
  await user.removePackage(pkg);

  return res.send(200, await utils.getPackageAuthors(pkg));
});

router.post('/package/:name/tag/:tag', auth, async (req, res) => {
  if (!semver.valid(req.params.version)) return res.send(new restify.BadRequestError('Invalid version'));

  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  let tag = (await pkg.getTags({ where: { name: req.params.tag.toLowerCase() } }))[0];
  if (!tag) {
    tag = await pkg.createTag({ name: req.params.tag.toLowerCase() });
  }

  const version = (await pkg.getVersions({ where: { version: req.params.version } }))[0];
  if (!version) return res.send(new restify.BadRequestError('Invalid version'));

  await tag.setVersion(version);

  return res.send(200, await utils.getPackageTags(pkg));
});

router.del('/package/:name/tag/:tag', auth, async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  const tag = (await pkg.getTags({ where: { name: req.params.tag.toLowerCase() } }))[0];
  if (!tag) return res.send(new restify.NotFoundError('Invalid tag'));

  if (tag.get('name') === 'latest') return res.send(new restify.ForbiddenError('Tag \'latest\' cannot be removed'));

  await tag.destroy();

  return res.send(200, await utils.getPackageTags(pkg));
});

/* eslint-disable */
/* For use later
router.get('/package/:name/badge/small.svg', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  const version = 'passing'; // (await (await pkg.getTags({ where: { name: 'latest' } }))[0].getVersion()).get('version');

  const canvas = new Canvas(0, 17, 'svg');
  const ctx = canvas.getContext('2d');

  ctx.font = '9px "DejaVu Sans"';

  canvas.width = ctx.measureText('build').width + ctx.measureText(version).width + 20;

  ctx.fillStyle = 'rgb(85, 85, 85)';
  ctx.fillRect(0, 0, ctx.measureText('build').width + 10, 17);

  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(1, 1, 1, 0.3)';
  ctx.shadowOffsetY = 1;
  ctx.fillText('build', 6, 11);

  ctx.fillStyle = '#3273dc';
  ctx.shadowOffsetY = 0;
  ctx.fillRect(ctx.measureText('build').width + 10, 0, ctx.measureText(version).width + 10, 17);

  ctx.fillStyle = 'white';
  ctx.shadowOffsetY = 1;
  ctx.fillText(version, ctx.measureText('build').width + 14, 11);

  ctx.filter = 'bilinear';
  ctx.patternQuality = 'bilinear';

  const data = canvas.toBuffer();

  res.writeHead(200, {
    'Content-Length': Buffer.byteLength(data),
    'Content-Type': 'image/svg+xml',
  });

  res.write(data);
  return res.end();
});
*/
/* eslint-enable */

router.get('/package/:name/badge/full.svg', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  const version = (await (await pkg.getTags({ where: { name: 'latest' } }))[0].getVersion()).get('version');
  const time = moment(pkg.get('updatedAt')).fromNow();

  fs.readFile('v1/badges/full.svg', 'utf8', (err, file) => {
    if (err) return res.send(new restify.InternalServerError('Internal server error'));
    const data = file
      .replace('{{NAME}}', pkg.get('name'))
      .replace('{{DESC}}', truncate(pkg.get('description'), 40))
      .replace('{{VER}}', version)
      .replace('{{TIME}}', time);

    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(data),
      'Content-Type': 'image/svg+xml',
    });

    res.write(data);
    return res.end();
  });

  return undefined;
});

module.exports = router;
