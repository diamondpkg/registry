const v1 = require('./v1');
const { db, Package } = require('./db');
const restify = require('restify');
const schedule = require('node-schedule');
const ver = require('./package.json').version;
const Router = require('restify-router').Router;
const corsMiddleware = require('restify-cors-middleware');
const { graphqlRestify, graphiqlRestify } = require('graphql-server-restify');
const schema = require('./v2');

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
});

const cdnRouter = new Router();
const cdnServer = restify.createServer({
  name: 'diamond-registry',
  version: ver,
});

server.use(restify.bodyParser({ mapFiles: true }));
server.use(restify.queryParser());

const cors = corsMiddleware({
  origins: ['https://diamond.js.org', 'http://diamondpkg.org', 'https://diamondpkg.org', 'http://localhost:8080'],
  credentials: true,
  allowHeaders: ['Authorization'],
});

server.pre(cors.preflight);
server.pre(cors.actual);

router.add('/', v1.registry);
router.add('/v1', v1.registry);

router.applyRoutes(server);

cdnRouter.add('/', v1.cdn);
cdnRouter.add('/v1', v1.cdn);

cdnRouter.applyRoutes(cdnServer);

server.post('/graphql', (req, res, next) => graphqlRestify({ schema, context: { req } })(req, res, next));
server.get('/graphql', (req, res, next) => graphqlRestify({ schema, context: { req } })(req, res, next));

server.get('/graphiql', graphiqlRestify({ endpointURL: '/graphql' }));

db.sync().then(() => {
  cdnServer.listen(9000, () => console.log('CDN Ready'));
  server.listen(8000, () => console.log('Registry Ready'));
});
