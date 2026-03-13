const fs = require("fs");
const path = require("path");
require("dotenv").config();

// #region agent log
try {
  fetch("http://127.0.0.1:7318/ingest/b4c0730a-0fc4-4150-81cd-58837ff2aca9", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "95a2dd",
    },
    body: JSON.stringify({
      sessionId: "95a2dd",
      runId: "bot-prefix-debug-1",
      hypothesisId: "A",
      location: "config/prefix.js:env-check",
      message: "BOT_PREFIX before manual parse",
      data: {
        botPrefix: process.env.BOT_PREFIX || null,
        envHasBotPrefix: Object.prototype.hasOwnProperty.call(
          process.env,
          "BOT_PREFIX",
        ),
        cwd: process.cwd(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch (_) {}
// #endregion agent log

// Hipótese B: dotenv não está lendo o .env corretamente.
// Tentativa extra: leitura manual do .env só para BOT_PREFIX.
if (!process.env.BOT_PREFIX) {
  try {
    const envPath = path.join(__dirname, "..", "..", ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const line = content
        .split(/\r?\n/)
        .find((l) => l.trim().startsWith("BOT_PREFIX="));
      if (line) {
        const raw = line.trim().slice("BOT_PREFIX=".length);
        const value = raw.trim();
        if (value) {
          process.env.BOT_PREFIX = value;
        }
      }
    }
  } catch {
    // se der erro aqui, continuamos com a validação normal abaixo
  }
}

// Pequeno log direto para ficar claro em runtime
console.log("[DEBUG BOT_PREFIX]", {
  botPrefix: process.env.BOT_PREFIX || null,
  envHasBotPrefix: Object.prototype.hasOwnProperty.call(
    process.env,
    "BOT_PREFIX",
  ),
  cwd: process.cwd(),
});

if (!process.env.BOT_PREFIX) {
  throw new Error(
    "BOT_PREFIX não definido no ambiente. Configure BOT_PREFIX no arquivo .env.",
  );
}

const PREFIX = process.env.BOT_PREFIX;

module.exports = { PREFIX };

