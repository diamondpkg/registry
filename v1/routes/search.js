const utils = require('../utils');
const restify = require('restify');
const ver = require('../../package.json').version;
const Router = require('restify-router').Router;

const { Package, User } = require('../../db');

const router = new Router();

router.get('/', async (req, res) => {
  res.send(200, {
    name: 'diamond-registry',
    version: ver,
    packages: await Package.count(),
    users: await User.count(),
  });
});

router.get('/search/user', async (req, res) => {
  if (!req.params.q) return res.send(new restify.BadRequestError('No search query'));

  const users = await User.findAll({
    where: {
      username: {
        $like: `%${req.params.q.toLowerCase().replace(/\s+/g, '%')}%`,
      },
    },
  });

  const response = [];

  for (const user of users) {
    response.push(await utils.getAdvUserInfo(user));
  }

  return res.send(200, response);
});

router.get('/search/package', async (req, res) => {
  if (!req.params.q) return res.send(new restify.BadRequestError('No search query'));

  const packages = await Package.findAll({
    where: {
      name: {
        $like: `%${req.params.q.toLowerCase().replace(/\s+/g, '%')}%`,
      },
    },
  });

  const response = [];

  for (const pkg of packages) {
    response.push(await utils.getAdvPackageInfo(req, pkg));
  }

  return res.send(200, response);
});

module.exports = router;
