// `pnpm dev:mock`: the dev server with the MSW mock API on (src/mocks), so the
// app runs on fake data with no backend. Extra args go to `next dev`.
import { spawn } from "node:child_process";

const child = spawn("next", ["dev", "--turbopack", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_API_MOCKING: "enabled",
    // Nothing listens here: anything that slips past the mock fails instead
    // of reaching a real backend.
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:9",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
