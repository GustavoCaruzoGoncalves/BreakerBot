const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch (_) {}

let baileysModule = null;
async function getBaileys() {
  if (!baileysModule) baileysModule = await import("@whiskeysockets/baileys");
  return baileysModule;
}

/** Retorna o JID da DM de destino (ex: 5511999999999 -> 5511999999999@s.whatsapp.net). */
function getViewOnceDmJid() {
  const num = process.env.VIEWONCE_DM_NUMBER || process.env.VIEWONCE_DM_JID;
  if (!num || typeof num !== "string") return null;
  const trimmed = num.trim().replace(/\D/g, "");
  if (!trimmed) return null;
  return trimmed.includes("@") ? num.trim() : `${trimmed}@s.whatsapp.net`;
}

/**
 * Extrai mídia viewOnce da mensagem direta (imageMessage/videoMessage/audioMessage na raiz)
 * ou de extendedTextMessage.contextInfo.quotedMessage (resposta com mídia viewOnce).
 */
function getViewOnceMedia(msg) {
  const message = msg.message;
  if (!message) return null;

  // 1) ViewOnce direto na mensagem (raiz)
  const imageMsg = message.imageMessage;
  const videoMsg = message.videoMessage;
  const audioMsg = message.audioMessage;
  if (imageMsg?.viewOnce === true) return { type: "imageMessage", msg: imageMsg };
  if (videoMsg?.viewOnce === true) return { type: "videoMessage", msg: videoMsg };
  if (audioMsg?.viewOnce === true) return { type: "audioMessage", msg: audioMsg };

  // 2) ViewOnce em extendedTextMessage (resposta/citação)
  const extended = message.extendedTextMessage;
  const quoted = extended?.contextInfo?.quotedMessage;
  if (!quoted) return null;

  const qImg = quoted.imageMessage;
  const qVid = quoted.videoMessage;
  const qAud = quoted.audioMessage;
  if (qImg?.viewOnce === true) return { type: "imageMessage", msg: qImg };
  if (qVid?.viewOnce === true) return { type: "videoMessage", msg: qVid };
  if (qAud?.viewOnce === true) return { type: "audioMessage", msg: qAud };

  return null;
}

/**
 * Extrai a parte "user" do JID (número antes do @) para usar no texto da menção.
 * No WhatsApp, a menção só funciona se o texto tiver @[número], e mentionedJid tiver o JID completo.
 */
function jidToMentionNumber(jid) {
  if (!jid || typeof jid !== "string") return "";
  const user = jid.split("@")[0] || "";
  return user.split(":")[0] || user;
}

/**
 * Verifica se o JID é de um grupo (@g.us).
 */
function isGroupJid(jid) {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

/** Monta o caption com os dados do remetente (menção com @número), origem (PV/grupo) e legenda da mídia. */
function buildViewOnceCaption(msg, mediaCaption, senderJid, originInfo) {
  const key = msg.key || {};
  const remoteJid = key.remoteJid || "";
  const senderJidVal = senderJid || key.participant || key.remoteJidAlt || remoteJid;

  const mentionNumber = jidToMentionNumber(senderJidVal);
  const mentionPart = mentionNumber ? `@${mentionNumber}` : "(sem nome)";
  const lines = [
    "📩 ViewOnce recebido de " + mentionPart,
    "Número: " + senderJidVal,
    "Origem: " + (originInfo?.type === "grupo" ? "grupo" : "PV"),
  ];
  if (originInfo?.type === "grupo" && originInfo?.groupName) {
    lines.push("Grupo: " + originInfo.groupName);
  }
  if (mediaCaption && String(mediaCaption).trim()) {
    lines.push("Legenda: " + String(mediaCaption).trim());
  }
  if (msg.messageTimestamp) {
    const date = new Date(Number(msg.messageTimestamp) * 1000);
    lines.push("Data: " + date.toISOString());
  }
  return lines.join("\n");
}

/**
 * Processa mensagens com viewOnce (imagem/vídeo/áudio de visualização única).
 * Suporta viewOnce na mensagem direta ou em extendedTextMessage.contextInfo.quotedMessage.
 * Envia os dados da mensagem e a mídia para a DM configurada em VIEWONCE_DM_NUMBER no .env.
 */
async function handleViewOnce(sock, { messages }) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  const dmJid = getViewOnceDmJid();
  if (!dmJid) {
    console.warn("[viewOnceHandler] VIEWONCE_DM_NUMBER não definido no .env; viewOnce ignorado.");
    return;
  }

  const { downloadMediaMessage } = await getBaileys();

  for (const msg of messages) {
    try {
      if (!msg.message || !msg.key?.remoteJid) continue;

      const media = getViewOnceMedia(msg);
      if (!media) continue;

      const remoteJid = msg.key.remoteJid;
      let originInfo = { type: "PV" };
      if (isGroupJid(remoteJid) && typeof sock.groupMetadata === "function") {
        try {
          const metadata = await sock.groupMetadata(remoteJid);
          originInfo = { type: "grupo", groupName: metadata?.subject || remoteJid };
        } catch (_) {
          originInfo = { type: "grupo", groupName: remoteJid };
        }
      }

      const { type, msg: mediaMessage } = media;
      const key = msg.key;
      const senderJid =
        originInfo.type === "grupo"
          ? key.participantAlt || key.participant || key.remoteJidAlt || key.remoteJid
          : key.remoteJidAlt || key.remoteJid;
      const caption = buildViewOnceCaption(msg, mediaMessage.caption, senderJid, originInfo);
      const mentionOpts = senderJid ? { mentions: [senderJid] } : {};

      const buffer = await downloadMediaMessage(
        { message: { [type]: mediaMessage } },
        "buffer"
      );

      if (!buffer || buffer.length === 0) continue;

      if (type === "imageMessage") {
        const mimetype = mediaMessage.mimetype || "image/jpeg";
        await sock.sendMessage(dmJid, { image: buffer, mimetype, caption, ...mentionOpts });
      } else if (type === "videoMessage") {
        const mimetype = mediaMessage.mimetype || "video/mp4";
        await sock.sendMessage(dmJid, { video: buffer, mimetype, caption, ...mentionOpts });
      } else {
        const mimetype = mediaMessage.mimetype || "audio/ogg; codecs=opus";
        const ptt = mediaMessage.ptt === true;
        await sock.sendMessage(dmJid, { audio: buffer, mimetype, ptt });
        await sock.sendMessage(dmJid, { text: caption, ...mentionOpts });
      }
    } catch (err) {
      console.error("[viewOnceHandler] Erro ao processar viewOnce:", err?.message || err);
    }
  }
}

module.exports = { handleViewOnce };
