const fs = require('fs');
const auth = require('../auth');
const utils = require('../utils');
const restify = require('restify');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../db');
const superagent = require('superagent');
const Handlebars = require('handlebars');
const Router = require('restify-router').Router;

let config;
try {
  config = require('../../config.json'); // eslint-disable-line
} catch (err) { } // eslint-disable-line

const router = new Router();
const email = Handlebars.compile(fs.readFileSync(`${__dirname}/../../html/email.handlebars`).toString());
const error = Handlebars.compile(fs.readFileSync(`${__dirname}/../../html/error.handlebars`).toString());

router.get('/user', auth, async (req, res) => {
  res.send(200, await utils.getAdvUserInfo(req.user));
});

router.get('/user/:name', async (req, res) => {
  const user = await User.findById(req.params.name);
  if (!user) return res.send(new restify.NotFoundError('Invalid user'));

  return res.send(200, await utils.getAdvUserInfo(user));
});

router.get('/verify', async (req, res) => {
  if (!req.params.user || !req.params.token) {
    const body = error({ error: 'Missing URL Parameters' });
    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'text/html',
    });
    res.write(body);
    return res.end();
  }

  const user = await User.findById(req.params.user);

  if (!user) {
    const body = error({ error: 'Invalid User' });
    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'text/html',
    });
    res.write(body);
    return res.end();
  }

  if (user.get('verifyToken') !== req.params.token) {
    const body = error({ error: 'Invalid Verify Token' });
    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'text/html',
    });
    res.write(body);
    return res.end();
  }

  await user.update({
    verified: true,
    verifyToken: null,
  });

  const body = fs.readFileSync(`${__dirname}/../../html/success.html`);
  res.writeHead(200, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'text/html',
  });
  res.write(body);
  return res.end();
});

router.post('/user', (req, res) => {
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

    await superagent.post('https://api.elasticemail.com/v2/email/send')
      .field('apikey', process.env.EMAIL_APIKEY || config.email.apiKey)
      .field('from', process.env.EMAIL_FROM || config.email.from)
      .field('fromName', 'diamond')
      .field('to', req.params.email.toLowerCase())
      .field('subject', 'Activate Your diamond Account')
      .field('bodyHtml', email({ url: `${req.isSecure() ? 'https' : 'http'}://${req.headers.host}/v1/verify?user=${user.get('username')}&token=${user.get('verifyToken')}` }));

    return res.send(200, utils.getUserInfo(user));
  });

  return undefined;
});

router.post('/user/login', async (req, res) => {
  if (!req.params.username || !req.params.password) return res.send(new restify.BadRequestError('Missing username and/or password'));

  const user = await User.findById(req.params.username);
  if (!user) return res.send(new restify.UnauthorizedError('Unauthorized'));
  if (!user.get('verified')) return res.send(new restify.UnauthorizedError('Unauthorized'));

  bcrypt.compare(req.params.password, user.get('password'), (err, match) => {
    if (err) return res.send(new restify.InternalServerError('Internal server error'));
    if (!match) return res.send(new restify.UnauthorizedError('Unauthorized'));

    jwt.sign({ sub: user.get('username') }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' }, (e, token) => {
      if (e) return res.send(new restify.InternalServerError('Internal server error'));

      return res.send(200, { token, user: utils.getUserInfo(user) });
    });

    return undefined;
  });

  return undefined;
});

module.exports = router;
