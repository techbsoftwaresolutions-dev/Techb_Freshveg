// When this copy of the API was packaged for upload. deploy/package-one-app.js
// rewrites this file in the upload with the real time; in development it
// stays null. Shown by GET /api/health, to tell which build a host is running.
module.exports = { builtAt: null };
