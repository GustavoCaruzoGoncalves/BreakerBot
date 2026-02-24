let baileysModule = null;
async function getBaileys() {
  if (!baileysModule) baileysModule = await import("@whiskeysockets/baileys");
  return baileysModule;
}

/**
 * Processa mensagens com viewOnce (imagem/vídeo de visualização única).
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

      const isViewOnceImage = imageMsg && imageMsg.viewOnce === true;
      const isViewOnceVideo = videoMsg && videoMsg.viewOnce === true;

      if (!isViewOnceImage && !isViewOnceVideo) continue;

      const chatId = msg.key.remoteJid;
      const mediaMessage = isViewOnceImage ? imageMsg : videoMsg;
      const mediaType = isViewOnceImage ? "imageMessage" : "videoMessage";

      const buffer = await downloadMediaMessage(
        { message: { [mediaType]: mediaMessage } },
        "buffer"
      );

      if (!buffer || buffer.length === 0) continue;

      if (isViewOnceImage) {
        const mimetype = imageMsg.mimetype || "image/jpeg";
        await sock.sendMessage(chatId, { image: buffer, mimetype }, { quoted: msg });
      } else {
        const mimetype = videoMsg.mimetype || "video/mp4";
        await sock.sendMessage(chatId, { video: buffer, mimetype }, { quoted: msg });
      }
    } catch (err) {
      console.error("[viewOnceHandler] Erro ao processar viewOnce:", err?.message || err);
    }
  }
}

module.exports = { handleViewOnce };
