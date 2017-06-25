const { User } = require('../db');
const jwt = require('jsonwebtoken');

module.exports = (req, tok) => new Promise((resolve, reject) => {
  jwt.verify(req.header('Authorization') || tok || null, process.env.JWT_SECRET || 'secret', async (err, payload) => {
    if (err) return reject(err);
    let user;
    try {
      user = await User.findOne({
        where: {
          username: payload.sub,
        },
      });
    } catch (error) {
      return reject(error);
    }

    if (!user) return resolve(false);
    if (!user.get('verified')) return resolve(false);

    return resolve(user);
  });
});
