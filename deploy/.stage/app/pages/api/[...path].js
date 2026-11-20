// Every /api request, handed to the commerce API (an Express app) in this same
// process. Copied to pages/api/[...path].js in the upload. A Pages Router API
// route is used because it receives Node's own req/res, which Express needs.
import { handle } from "../../backend/start";

export const config = {
  // Express reads the body itself.
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

export default function apiRoute(req, res) {
  return handle(req, res);
}
