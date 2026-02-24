let baileysModule = null;
async function getBaileys() {
  if (!baileysModule) baileysModule = await import("@whiskeysockets/baileys");
  return baileysModule;
}

/**
 * Processa mensagens com viewOnce (imagem/vídeo/áudio de visualização única).
 * Baixa a mídia e reenvia como mensagem normal (sem viewOnce) no mesmo chat.
 */
async function handleViewOnce(sock, { messages }) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  const { downloadMediaMessage } = await getBaileys();

  for (const msg of messages) {
    try {
      if (!msg.message || !msg.key?.remoteJid || msg.key.fromMe) continue;

      const imageMsg = msg.message.imageMessage;
      const videoMsg = msg.message.videoMessage;
      const audioMsg = msg.message.audioMessage;

      const isViewOnceImage = imageMsg && imageMsg.viewOnce === true;
      const isViewOnceVideo = videoMsg && videoMsg.viewOnce === true;
      const isViewOnceAudio = audioMsg && audioMsg.viewOnce === true;

      if (!isViewOnceImage && !isViewOnceVideo && !isViewOnceAudio) continue;

      const chatId = msg.key.remoteJid;
      const mediaMessage = isViewOnceImage ? imageMsg : isViewOnceVideo ? videoMsg : audioMsg;
      const mediaType = isViewOnceImage ? "imageMessage" : isViewOnceVideo ? "videoMessage" : "audioMessage";

      const buffer = await downloadMediaMessage(
        { message: { [mediaType]: mediaMessage } },
        "buffer"
      );

      if (!buffer || buffer.length === 0) continue;

      if (isViewOnceImage) {
        const mimetype = imageMsg.mimetype || "image/jpeg";
        await sock.sendMessage(chatId, { image: buffer, mimetype });
      } else if (isViewOnceVideo) {
        const mimetype = videoMsg.mimetype || "video/mp4";
        await sock.sendMessage(chatId, { video: buffer, mimetype });
      } else {
        const mimetype = audioMsg.mimetype || "audio/ogg; codecs=opus";
        const ptt = audioMsg.ptt === true;
        await sock.sendMessage(chatId, { audio: buffer, mimetype, ptt });
      }
    } catch (err) {
      console.error("[viewOnceHandler] Erro ao processar viewOnce:", err?.message || err);
    }
  }
}

module.exports = { handleViewOnce };
