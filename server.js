const { loadEnv } = require("./load-env.cjs");
loadEnv();

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "[KpiTracker] DATABASE_URL manquant. Ajoutez-le dans cPanel (Setup Node.js App) ou dans .env à la racine.",
  );
  process.exit(1);
}

const { createServer } = require("http");
const next = require("next");

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, hostname, () => {
      // eslint-disable-next-line no-console
      console.log(
        `[KpiTracker] Ready on http://${hostname}:${port} (NODE_ENV=${process.env.NODE_ENV})`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `[KpiTracker] Test: GET /api/health — basePath=${process.env.NEXT_PUBLIC_BASE_PATH || "(racine)"}`,
      );
    });

    server.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[KpiTracker] HTTP server error", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[KpiTracker] Failed to start", err);
    process.exit(1);
  });
