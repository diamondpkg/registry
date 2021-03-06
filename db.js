const crypto = require('crypto');
const Sequelize = require('sequelize');

let db;
if (process.env.NODE_ENV === 'production') {
  db = new Sequelize(
    process.env.DB,
    process.env.USER,
    process.env.PASSWORD,
    {
      logging: false,
      host: process.env.HOST,
      dialect: process.env.DIALECT,
    }
  );
} else {
  db = new Sequelize({
    dialect: 'sqlite',
    storage: 'db.sqlite',
  });
}

const Package = db.define('package', {
  name: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  downloads: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  weeklyDownloads: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});

const Version = db.define('version', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  package: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  version: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  readme: {
    type: Sequelize.TEXT,
    allowNull: false,
    defaultValue: 'No readme!',
  },
  data: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  shasum: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  dist: {
    type: Sequelize.BLOB,
    allowNull: false,
  },
  cdn: Sequelize.TEXT,
});

const Tag = db.define('tag', {
  id: {
    primaryKey: true,
    allowNull: false,
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

const User = db.define('user', {
  username: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  verified: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  verifyToken: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue() {
      return crypto.randomBytes(32).toString('hex');
    },
  },
});

const Download = db.define('download', {
  date: {
    type: Sequelize.DATEONLY,
    allowNull: false,
    defaultValue() {
      return new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth()));
    },
  },
  count: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});


Package.hasMany(Version, { as: 'Versions' });
Package.hasMany(Tag, { as: 'Tags' });
Package.hasMany(Download, { as: 'Downloads' });

Tag.belongsTo(Version);

User.belongsToMany(Package, { through: 'UserPackage' });
Package.belongsToMany(User, { through: 'UserPackage', as: 'Authors' });

module.exports = { db, Package, Version, User, Tag };
