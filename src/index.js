const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const { handleViewOnce } = require("./services/viewOnceHandler");

const noop = () => {};
const silentLogger = {
  level: "silent",
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child() { return silentLogger; },
};

const isTransientSocketError = (err) => {
  const msg = err?.message || "";
  const cause = err?.cause?.code || "";
  return (
    msg === "terminated" ||
    cause === "ECONNRESET" ||
    cause === "UND_ERR_SOCKET" ||
    cause === "EPIPE" ||
    cause === "ETIMEDOUT" ||
    cause === "ECONNREFUSED"
  );
};

const logError = (error) => {
  try {
    const errorLogPath = path.join(__dirname, "..", "data", "logs", "error.log");
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
    const errorMsg = `[${new Date().toISOString()}] ${error.stack || error.message || error}\n`;
    fs.appendFileSync(errorLogPath, errorMsg);
  } catch (e) {
    console.error("Falha ao gravar log de erro:", e.message);
  }
};

process.on("uncaughtException", (err) => {
  if (isTransientSocketError(err)) {
    console.warn(`[Socket] Erro transiente ignorado: ${err.cause?.code || err.message}`);
    return;
  }
  console.error("Erro não capturado:", err);
  logError(err);
});

process.on("unhandledRejection", (reason, promise) => {
  if (isTransientSocketError(reason)) {
    console.warn(`[Socket] Rejeição transiente ignorada: ${reason?.cause?.code || reason?.message}`);
    return;
  }
  console.error("Rejeição não tratada em:", promise, "Motivo:", reason);
  logError(reason);
});

async function connectBot() {
  try {
    const { makeWASocket, useMultiFileAuthState, Browsers } = await import("@whiskeysockets/baileys");
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(__dirname, "..", "auth_info"),
    );

    const sock = makeWASocket({
      printQRInTerminal: false,
      version: [2, 3000, 1033893291],
      auth: state,
      browser: Browsers.android("13"),
      logger: silentLogger,
      retryRequestDelayMs: 2000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      defaultQueryTimeoutMs: 60000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("Escaneie o QR Code para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isStreamError =
          lastDisconnect?.error?.message?.includes("Stream Errored");

        const shouldReconnect = statusCode !== 401 || isStreamError;
        console.log(
          "Conexão fechada. Código:",
          statusCode,
          "| Stream error:",
          isStreamError,
        );
        if (shouldReconnect) {
          console.log("Tentando reconectar...");
          connectBot();
        } else {
          console.log(
            "Sessão inválida. Delete a pasta auth_info e reconecte via QR Code.",
          );
        }
      } else if (connection === "open") {
        console.log("Bot conectado com sucesso!");
      }
    });

    sock.ev.on("messages.upsert", async (messages) => {
      try {
        console.log("\n========== MENSAGEM RECEBIDA ==========");
        console.log("Timestamp:", new Date().toISOString());
        console.log("Dados completos da API do Baileys:");
        console.log(JSON.stringify(messages, null, 2));
        console.log("========================================\n");

        await handleViewOnce(sock, messages);
      } catch (err) {
        console.error("Erro ao processar mensagem:", err);
        logError(err);
      }
    });
  } catch (err) {
    console.error("Erro ao iniciar o bot:", err);
    logError(err);
    setTimeout(connectBot, 5000);
  }
}

connectBot();
