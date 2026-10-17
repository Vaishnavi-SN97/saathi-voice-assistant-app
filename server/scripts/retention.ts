// One-off retention cleanup (the server also runs this every 6 hours).
//   npm run retention            -> ID photos of signed applications, applications idle for more than RETENTION_DAYS (default 7)
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";
import { runRetention } from "../src/services/retention.js";

const env = loadEnv();
const r = await runRetention(firebaseDeps(env).store, { days: env.RETENTION_DAYS });
console.log(`checked ${r.checked} applications: deleted ${r.photosDeleted} ID photo(s) of signed applications and ${r.applicationsDeleted} abandoned application(s) (idle > ${env.RETENTION_DAYS} days)`);
