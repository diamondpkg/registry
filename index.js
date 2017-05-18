const fs = require('fs');
const v1 = require('./v1');
const { db, Package } = require('./db');
const restify = require('restify');
const schedule = require('node-schedule');
const ver = require('./package.json').version;
const Router = require('restify-router').Router;
const corsMiddleware = require('restify-cors-middleware');

schedule.scheduleJob('0 0 * * 0', async () => {
  for (const pkg of await Package.findAll()) {
    pkg.update({
      weeklyDownloads: 0,
    });
  }
});

const router = new Router();
const server = restify.createServer({
  name: 'diamond-registry',
  version: ver,
  certificate: fs.readFileSync('ssl/cert.pem'),
  key: fs.readFileSync('ssl/key.pem'),
});

server.use(restify.bodyParser({ mapFiles: true }));
server.use(restify.queryParser());

const cors = corsMiddleware({
  origins: ['https://diamond.js.org', 'http://vue.diamond.hackzzila.com', 'http://localhost:8080'],
  credentials: true,
  allowHeaders: ['Authorization'],
});

server.pre(cors.preflight);
server.pre(cors.actual);

router.add('/', v1);
router.add('/v1', v1);

router.applyRoutes(server);

db.sync().then(() => {
  server.listen(8000, () => console.log('Ready'));
});
