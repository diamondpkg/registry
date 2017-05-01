const crypto = require('crypto');
const utils = require('./utils');
const semver = require('semver');
const restify = require('restify');
const bcrypt = require('bcryptjs');
const passport = require('passport-restify');
const ver = require('./package.json').version;
const Router = require('restify-router').Router;
const { BasicStrategy } = require('passport-http');
const { Package, Version, User, Tag } = require('./db');

const router = new Router();

passport.use(new BasicStrategy((username, password, done) => {
  User.findOne({
    where: {
      username: username.toLowerCase(),
    },
  }).then((user) => {
    if (!user) return done(null, false);

    bcrypt.compare(password, user.get('password'), (err, match) => {
      if (err) return done(err);
      if (!match) return done(null, false);
      return done(null, user);
    });

    return undefined;
  }).catch(err => done(err));
}));

const auth = passport.authenticate('basic', { session: false });

router.get('/', async (req, res) => {
  res.send(200, {
    name: 'diamond-registry',
    version: ver,
    packages: await Package.count(),
    users: await User.count(),
  });
});

router.get('/user/search', async (req, res) => {
  if (!req.params.q) return res.send(new restify.BadRequestError('No search query'));

  const users = await User.findAll({
    where: {
      username: {
        $like: `%${req.params.q.toLowerCase().replace(/\s+/g, '%')}%`,
      },
    },
  });

  const response = { size: users.length, users: [] };

  for (const user of users) {
    response.users.push(await utils.getAdvUserInfo(user));
  }

  return res.send(200, response);
});

router.get('/user', auth, async (req, res) => {
  res.send(200, await utils.getAdvUserInfo(req.user));
});

router.get('/user/:name', async (req, res) => {
  const user = await User.findById(req.params.name);
  if (!user) return res.send(new restify.NotFoundError('Invalid user'));

  return res.send(200, await utils.getAdvUserInfo(user));
});

router.post('/register', (req, res) => {
  if (!req.params.username || !req.params.password || !req.params.email) return res.send(new restify.BadRequestError('Missing username and/or password and/or email'));
  if (req.params.username.toLowerCase() === 'search') return res.send(new restify.BadRequestError('Invalid username'));

  bcrypt.hash(req.params.password, 8, async (err, hash) => {
    if (err) return res.send(new restify.InternalServerError('Internal server error'));

    const existing = await User.findOne({
      where: {
        $or: [
          { username: req.params.username.toLowerCase() },
          { email: req.params.email.toLowerCase() },
        ],
      },
    });

    if (existing !== null) return res.send(new restify.ConflictError('User already exists'));

    const user = await User.create({
      username: req.params.username.toLowerCase(),
      password: hash,
      email: req.params.email.toLowerCase(),
    });

    return res.send(200, utils.getUserInfo(user));
  });

  return undefined;
});

router.get('/package/search', async (req, res) => {
  if (!req.params.q) return res.send(new restify.BadRequestError('No search query'));

  const packages = await Package.findAll({
    where: {
      name: {
        $like: `%${req.params.q.toLowerCase().replace(/\s+/g, '%')}%`,
      },
    },
  });

  const response = { size: packages.length, packages: [] };

  for (const pkg of packages) {
    response.packages.push(await utils.getAdvPackageInfo(req, pkg));
  }

  return res.send(200, response);
});

router.get('/package/:name', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(new restify.NotFoundError('Invalid package'));

  return res.send(200, await utils.getAdvPackageInfo(req, pkg));
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

  return res.send(200, await utils.getPackageVersionInfo(req, pkg, version));
});

router.get('/package/:name/:version', async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());
  if (!pkg) return res.send(restify.NotFoundError('Invalid package'));

  const version = (await pkg.getVersions({ where: { version: req.params.version } }))[0];
  if (!version) return res.send(restify.NotFoundError('Invalid version'));

  res.writeHead(200, { 'Content-Length': Buffer.byteLength(version.dist), 'Content-Type': 'application/octet-stream' });
  res.write(version.dist);
  return res.end();
});

router.del('/package/:name', auth, async (req, res) => {
  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(restify.NotFoundError('Invalid package'));
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
  if (!semver.valid(req.params.version)) return res.send(restify.BadRequestError('Invalid version'));

  const pkg = await Package.findById(req.params.name.toLowerCase());

  if (!pkg) return res.send(restify.NotFoundError('Invalid package'));
  if (!await pkg.hasAuthor(req.user)) return res.send(new restify.ForbiddenError('Forbidden'));

  if (!await pkg.hasVersion(`${req.params.name}@${req.params.version}`)) return res.send(restify.NotFoundError('Invalid version'));

  for (const tag of await pkg.getTags()) {
    if (await tag.getVersion().get('version') === req.params.version) await tag.destroy();
  }

  await (await pkg.getVersions({ where: { version: req.params.version } }))[0].destroy();

  if (await pkg.countVersions() === 0) await pkg.destroy();
  else {
    let latest = await pkg.getTags({ where: { name: 'latest' } })[0];
    if (!latest) {
      latest = await Tag.create({ name: 'latest' });
      await pkg.addTag(latest);
      await latest.setVersion(await Version.findOne({ order: [['createdAt', 'DESC']], where: { package: req.params.name.toLowerCase() } }));
    }
  }


  return res.send(204);
});

module.exports = router;
