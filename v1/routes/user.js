const auth = require('../auth');
const utils = require('../utils');
const restify = require('restify');
const bcrypt = require('bcryptjs');
const { User } = require('../../db');
const Router = require('restify-router').Router;

const router = new Router();

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

module.exports = router;
