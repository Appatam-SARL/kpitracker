/**
 * Charge .env / .env.local au démarrage Node (cPanel n’injecte pas toujours les variables).
 * Utilisé par server.js avant Next.js.
 */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const root = process.cwd();
  const files = [
    { name: ".env", override: false },
    { name: ".env.local", override: true },
  ];

  for (const { name, override } of files) {
    const filePath = path.resolve(root, name);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      if (!override && process.env[key] !== undefined) continue;

      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

module.exports = { loadEnv };
