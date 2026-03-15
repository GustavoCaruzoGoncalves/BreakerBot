const {
  makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const db = require("./database/db");
const { initDatabase } = require("./database/init");
const { startAuthMessageProcessor } = require("./services/authMessageSender");

const imagesCommandsBot = require("./commands/media/imagesCommands");
const audioCommandsBot = require("./commands/media/audioCommands");
const jokesCommandsBot = require("./commands/fun/jokesCommands");
const gamesCommandsBot = require("./commands/fun/gamesCommands");
const amigoSecretoCommandBot = require("./commands/fun/amigoSecretoCommand");
const menuCommandBot = require("./commands/utility/menuCommand");
const featureCommandsBot = require("./commands/utility/featureCommands");
const gptCommandBot = require("./commands/ai/gptCommand");
const grokCommandBot = require("./commands/ai/grokCommand");
const zhipuCommandsBot = require("./commands/ai/zhipuCommands");
const banCommandBot = require("./commands/moderation/banCommand");
const lyricsCommandBot = require("./commands/utility/lyricsCommand");
const sendJsCommandBot = require("./commands/utility/sendJsCommand");
const levelCommandBot = require("./commands/level/levelCommand");
const auraCommandBot = require("./commands/aura/auraCommand");
const handleAuraReaction =
  require("./commands/aura/auraCommand").handleAuraReaction;

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
  console.error("Erro não capturado:", err);
  logError(err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Rejeição não tratada em:", promise, "Motivo:", reason);
  logError(reason);
});

const contactsCache = {};

// Fila síncrona: processa uma mensagem por vez, em ordem, para evitar race conditions
const messageQueue = [];
let isProcessingQueue = false;

async function processMessageQueue(sock, contactsCache) {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;
  const event = messageQueue.shift();
  try {
    await imagesCommandsBot(sock, event);
    await audioCommandsBot(sock, event);
    await jokesCommandsBot(sock, event, contactsCache);
    await featureCommandsBot(sock, event);
    await gamesCommandsBot(sock, event, contactsCache);
    await amigoSecretoCommandBot(sock, event, contactsCache);
    await menuCommandBot(sock, event);
    await gptCommandBot(sock, event);
    await grokCommandBot(sock, event);
    await lyricsCommandBot(sock, event);
    await banCommandBot(sock, event);
    await zhipuCommandsBot(sock, event);
    await sendJsCommandBot(sock, event);
    await levelCommandBot(sock, event, contactsCache);
    await auraCommandBot(sock, event, contactsCache);
  } catch (err) {
    console.error("Erro ao processar mensagem:", err);
    logError(err);
  } finally {
    isProcessingQueue = false;
    if (messageQueue.length > 0) {
      setImmediate(() => processMessageQueue(sock, contactsCache));
    }
  }
}

async function connectBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(__dirname, "..", "auth_info"),
    );

    const sock = makeWASocket({
      printQRInTerminal: false,
      version: [2, 3000, 1033893291],
      auth: state,
      browser: ["Windows", "Google Chrome", "145.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("contacts.update", (updates) => {
      updates.forEach((contact) => {
        if (contact.id) {
          if (!contactsCache[contact.id]) {
            contactsCache[contact.id] = {};
          }
          Object.assign(contactsCache[contact.id], contact);
        }
      });
    });

    sock.ev.on("contacts.upsert", (contacts) => {
      contacts.forEach((contact) => {
        if (contact.id) {
          contactsCache[contact.id] = contact;
        }
      });
    });

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
        startAuthMessageProcessor(sock);
      }
    });

    sock.ev.on("messages.reaction", async (reactions) => {
      try {
        if (Array.isArray(reactions)) {
          for (const item of reactions) {
            await handleAuraReaction(sock, item);
          }
        } else if (reactions) {
          await handleAuraReaction(sock, reactions);
        }
      } catch (err) {
        console.error("Erro ao processar reação (aura):", err);
        logError(err);
      }
    });

    sock.ev.on("messages.upsert", (evt) => {
      const list = evt?.messages || (Array.isArray(evt) ? evt : [evt]);
      for (const m of list) {
        messageQueue.push({ messages: [m] });
      }
      console.log("[FILA] Mensagem(ns) enfileirada(s). Total na fila:", messageQueue.length);
      processMessageQueue(sock, contactsCache);
    });
  } catch (err) {
    console.error("Erro ao iniciar o bot:", err);
    logError(err);
    setTimeout(connectBot, 5000);
  }
}

async function start() {
  const initOk = await initDatabase();
  if (!initOk) {
    console.warn("[DB] Init falhou - o bot iniciará, mas funcionalidades que usam o banco podem não funcionar.");
  } else {
    await db.testConnection();
  }
  connectBot();
}

start();
