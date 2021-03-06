const restify = require('restify');
const cdn = require('./routes/cdn');
const { Package, User } = require('../db');
const Router = require('restify-router').Router;
const ver = require('../package.json').version;

const router = new Router();

router.get('/', async (req, res) => {
  res.send(200, {
    name: 'diamond-registry',
    version: ver,
    packages: await Package.count(),
    users: await User.count(),
  });
});

router.get('/unauthorized', (req, res) => {
  res.send(new restify.UnauthorizedError('Unauthorized'));
});

router.add('/', require('./routes/search'));
router.add('/', require('./routes/user'));
router.add('/', require('./routes/package'));

module.exports = { registry: router, cdn };
