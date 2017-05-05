const { User } = require('../db');
const bcrypt = require('bcryptjs');
const passport = require('passport-restify');
const { BasicStrategy } = require('passport-http');

passport.use(new BasicStrategy((username, password, done) => {
  User.findOne({
    where: {
      username: username.toLowerCase(),
    },
  }).then((user) => {
    if (!user) return done(null, false);
    if (!user.get('verified')) return done(null, false);

    bcrypt.compare(password, user.get('password'), (err, match) => {
      if (err) return done(err);
      if (!match) return done(null, false);
      return done(null, user);
    });

    return undefined;
  }).catch(err => done(err));
}));

const auth = passport.authenticate('basic', { session: false, failureRedirect: '/v1/unauthorized' });

module.exports = auth;
