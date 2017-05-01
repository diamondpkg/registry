const v1 = require('./v1');
const { db } = require('./db');
const restify = require('restify');
const ver = require('./package.json').version;
const Router = require('restify-router').Router;

const router = new Router();
const server = restify.createServer({
  name: 'diamond-registry',
  version: ver,
});

server.use(restify.bodyParser({ mapFiles: true }));
server.use(restify.queryParser());

router.add('/', v1);
router.add('/v1', v1);

router.applyRoutes(server);

db.sync().then(() => {
  server.listen(8000, () => console.log('Ready'));
});
