const jwt = require("jsonwebtoken");
const config = require("../../config");

// The access token carries role and permissions so the common case — "may this
// request do this?" — needs no database round trip. Anything that revokes
// access (blocking a user, changing a role) therefore takes effect on the next
// refresh, which is why access tokens are short next to refresh tokens.
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id || user._id.toString(),
      role: user.role,
      perms: user.permissions,
      name: user.name,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id || user._id.toString(), typ: "refresh" },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);
const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    expiresIn: config.jwt.expiresIn,
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
};
