import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { firebaseDeps } from "./firebase.js";

const env = loadEnv();
const app = createApp({ env, ...firebaseDeps(env) });
app.listen(env.PORT, () => console.log(`saathi server on :${env.PORT} (MOCK_AI=${env.MOCK_AI})`));
