import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: process.env.LEDGER_COMMS_PATH ? { "@": resolve(process.env.LEDGER_COMMS_PATH, "src") } : {},
  },
});
