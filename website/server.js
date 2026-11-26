// Startup file for hosts that run a Node app by launching one .js file —
// cPanel's "Setup Node.js App" (Phusion Passenger) and Hostinger's Node.js
// apps. It does what `next start` does: serves the production build from
// .next, on the port the host hands over in PORT.
//
// Run `npm run build` first; this file only serves an existing build.
// Locally, `npm run dev` and `npm start` are unaffected.
const { createServer } = require("http");
const next = require("next");

const port = Number(process.env.PORT) || 3100;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
      console.log(`[website] ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("[website] could not start — has `npm run build` been run?", err);
    process.exit(1);
  });
