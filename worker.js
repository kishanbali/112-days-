// Cloudflare CI/CD entry point.
// The production Worker implementation lives in payment-backend/worker.js.
import worker from "./payment-backend/worker.js";
export default worker;
