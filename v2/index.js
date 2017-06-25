const path = require('path');
const fs = require('fs-extra');
const { Package, User } = require('../db');
const { makeExecutableSchema } = require('graphql-tools');
const GraphQLJSON = require('graphql-type-json');
const auth = require('./auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const semver = require('semver');

const typeDefs = [];
for (const type of fs.readdirSync('./v2/schemas')) {
  typeDefs.push(fs.readFileSync(path.join('./v2/schemas', type), 'utf8'));
}

const resolvers = {
  JSON: GraphQLJSON,

  Package: {
    name(pkg) {
      return pkg.get('name');
    },

    description(pkg) {
      return pkg.get('description');
    },

    createdAt(pkg) {
      return pkg.get('createdAt');
    },

    downloads(pkg) {
      return pkg.get('downloads');
    },

    weeklyDownloads(pkg) {
      return pkg.get('weeklyDownloads');
    },

    async author(pkg, { username }) {
      return (await pkg.getAuthors({ where: { username: username.toLowerCase() } }))[0];
    },

    authors(pkg) {
      return pkg.getAuthors();
    },

    async version(pkg, { version }) {
      return {
        pkg,
        ver: (await pkg.getVersions({ where: { version: version.toLowerCase() } }))[0],
      };
    },

    async versions(pkg) {
      const arr = [];
      for (const ver of await pkg.getVersions()) {
        arr.push({ ver, pkg });
      }
      return arr;
    },

    async tag(pkg, { name }) {
      return {
        pkg,
        ver: await (await pkg.getTags({ where: { name: name.toLowerCase() } }))[0].getVersion(),
      };
    },

    async tags(pkg) {
      const obj = {};
      for (const tag of await pkg.getTags()) {
        obj[tag.get('name')] = await tag.getVersion().get('version');
      }
      return obj;
    },
  },

  Version: {
    version({ ver }) {
      return ver.get('version');
    },

    async data({ ver }) {
      return JSON.parse(await ver.get('data'));
    },

    readme({ ver }) {
      return ver.get('readme');
    },

    createdAt({ ver }) {
      return ver.get('createdAt');
    },

    dist(args) {
      return args;
    },
  },

  Dist: {
    shasum({ ver }) {
      return ver.get('shasum');
    },

    url({ pkg, ver }, _, { req }) {
      return `${req.isSecure() ? 'https' : 'http'}://${req.headers.host}/v1/package/${pkg.get('name')}/${ver.get('version')}`;
    },
  },

  User: {
    username(user) {
      return user.get('username');
    },

    email(user) {
      return user.get('email');
    },

    createdAt(user) {
      return user.get('createdAt');
    },

    verified(user) {
      return user.get('verified');
    },

    packages(user) {
      return user.getPackages();
    },
  },

  Query: {
    package(_, { name }) {
      return Package.findById(name.toLowerCase());
    },

    user(_, { username }) {
      return User.findById(username.toLowerCase());
    },

    viewer(_, __, { req }) {
      return auth(req);
    },
  },

  Login: {
    token({ token }) {
      return token;
    },

    user({ user }) {
      return user;
    },
  },

  Mutation: {
    login(_, { username, password }) {
      return new Promise(async (resolve, reject) => {
        if (!username || !password) return reject(new Error('Missing username and/or password'));

        const user = await User.findById(username.toLowerCase());
        if (!user) return reject(new Error('Unauthorized'));
        if (!user.get('verified')) return reject(new Error('Unauthorized'));

        bcrypt.compare(password, user.get('password'), (err, match) => {
          if (err) return reject(new Error('Internal server error'));
          if (!match) return reject(new Error('Unauthorized'));

          jwt.sign({ sub: user.get('username') }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' }, (e, token) => {
            if (e) return reject(new Error('Internal server error'));

            return resolve({ token, user });
          });

          return undefined;
        });

        return undefined;
      });
    },

    async addAuthor(_, { username, package: name }, { req }) {
      const pkg = await Package.findById(name.toLowerCase());
      const user = await User.findById(username.toLowerCase());

      if (!pkg) throw new Error('Invalid package');
      if (!user) throw new Error('Invalid user');
      if (!await pkg.hasAuthor(await auth(req))) throw new Error('Forbidden');

      await pkg.addAuthor(user);
      await user.addPackage(pkg);

      return pkg;
    },

    async removeAuthor(_, { username, package: name }, { req }) {
      const pkg = await Package.findById(name.toLowerCase());
      const user = await User.findById(username.toLowerCase());

      if (!pkg) throw new Error('Invalid package');
      if (!user) throw new Error('Invalid user');
      if (!await pkg.hasAuthor(await auth(req))) throw new Error('Forbidden');

      await pkg.removeAuthor(user);
      await user.removePackage(pkg);

      return pkg;
    },

    async setTag(_, { package: name, tag: tagName, version }, { req }) {
      if (!semver.valid(version)) throw new Error('Invalid version');

      const pkg = await Package.findById(name.toLowerCase());

      if (!pkg) throw new Error('Invalid package');
      if (!await pkg.hasAuthor(await auth(req))) throw new Error('Forbidden');

      const ver = (await pkg.getVersions({ where: { version } }))[0];
      if (!ver) throw new Error('Invalid version');

      let tag = (await pkg.getTags({ where: { name: tagName.toLowerCase() } }))[0];
      if (!tag) {
        tag = await pkg.createTag({ name: tagName.toLowerCase() });
      }

      await tag.setVersion(ver);

      return pkg;
    },

    async removeTag(_, { package: name, tag: tagName }, { req }) {
      const pkg = await Package.findById(name.toLowerCase());

      if (!pkg) throw new Error('Invalid package');
      if (!await pkg.hasAuthor(await auth(req))) throw new Error('Forbidden');

      const tag = (await pkg.getTags({ where: { name: tagName.toLowerCase() } }))[0];
      if (!tag) throw new Error('Invalid tag');

      if (tag.get('name') === 'latest') throw new Error('Tag \'latest\' cannot be removed');

      await tag.destroy();

      return pkg;
    },
  },
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
