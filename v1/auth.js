const { User } = require('../db');
const bcrypt = require('bcryptjs');
const passport = require('passport-restify');
const { BasicStrategy } = require('passport-http');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

passport.use('basic', new BasicStrategy(async (username, password, done) => {
  let user;
  try {
    user = await User.findOne({
      where: {
        username: username.toLowerCase(),
      },
    });
  } catch (err) {
    return done(err, false);
  }

  if (!user) return done(null, false);
  if (!user.get('verified')) return done(null, false);

  bcrypt.compare(password, user.get('password'), (err, match) => {
    if (err) return done(err, false);
    if (!match) return done(null, false);
    return done(null, user);
  });

  return undefined;
}));

passport.use('jwt', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: process.env.JWT_SECRET || 'secret',
}, async (payload, done) => {
  let user;
  try {
    user = await User.findOne({
      where: {
        username: payload.sub,
      },
    });
  } catch (err) {
    return done(err, false);
  }

  if (!user) return done(null, false);
  if (!user.get('verified')) return done(null, false);

  return done(null, user);
}));

const auth = passport.authenticate(['basic', 'jwt'], { session: false, failureRedirect: '/v1/unauthorized' });

module.exports = auth;
