/* Usage: npm run warmup */
import { warmup } from "./warmup-lib";
process.exit((await warmup()) ? 0 : 1);
