const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

async function imagesCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const isSticker = messageType === 'stickerMessage';
    const isImage = messageType === 'imageMessage';
    const isReplyToImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isReplyToSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    const messageWithText = msg.message.imageMessage?.caption || msg.message.extendedTextMessage?.text || '';

    if (messageWithText.startsWith("!sticker") || messageWithText.startsWith("!fsticker")) {
        console.log("[DEBUG] Comando de figurinha detectado");

        if (isImage || isReplyToImage) {
            try {
                console.log("[DEBUG] Baixando imagem...");
                let mediaMessage = isImage ? msg.message.imageMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;

                const buffer = await downloadMediaMessage(
                    { message: { imageMessage: mediaMessage } },
                    "buffer"
                );

                if (!buffer) {
                    console.log("[ERRO] Falha ao baixar a imagem.");
                    await sock.sendMessage(sender, { text: "Erro ao baixar a imagem. Tente novamente!" }, { quoted: msg });
                    return;
                }

                const stickerPath = path.join(__dirname, 'sticker.webp');

                console.log("[DEBUG] Processando imagem...");
                const sharpInstance = sharp(buffer).webp();

                if (messageWithText.startsWith("!sticker")) {
                    sharpInstance.resize(1080, 1920, { fit: 'cover' });
                } else if (messageWithText.startsWith("!fsticker")) {
                    sharpInstance.resize(512, 512, { fit: 'cover' });
                }

                await sharpInstance.toFile(stickerPath);

                if (!fs.existsSync(stickerPath)) {
                    console.log("[ERRO] Arquivo WebP não foi gerado.");
                    await sock.sendMessage(sender, { text: "Erro ao processar a figurinha!" }, { quoted: msg });
                    return;
                }

                console.log("[DEBUG] Enviando figurinha...");
                const sticker = fs.readFileSync(stickerPath);
                await sock.sendMessage(sender, { sticker }, { quoted: msg });

                console.log("[DEBUG] Figurinha enviada com sucesso!");
                fs.unlinkSync(stickerPath);

            } catch (err) {
                console.error("[ERRO] Falha ao criar sticker:", err);
                await sock.sendMessage(sender, { text: "Erro ao criar a figurinha! 😢" }, { quoted: msg });
            }
        } else {
            console.log("[DEBUG] Nenhuma imagem detectada para criar sticker.");
            await sock.sendMessage(sender, { text: "Envie ou responda a uma imagem com `!sticker` ou `!fsticker`!" }, { quoted: msg });
        }
    }

    if (messageWithText.startsWith("!toimg") && isReplyToSticker) {
        if (isSticker) {
            console.log("[DEBUG] A mensagem é uma figurinha, evitando envio junto com o !toimg.");
            return;
        }

        try {
            console.log("[DEBUG] Convertendo figurinha para imagem...");
            let mediaMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage;

            const buffer = await downloadMediaMessage(
                { message: { stickerMessage: mediaMessage } },
                "buffer"
            );

            const imgPath = path.join(__dirname, 'sticker.png');
            await sharp(buffer).toFormat('png').toFile(imgPath);

            const image = fs.readFileSync(imgPath);
            await sock.sendMessage(sender, { image }, { quoted: msg });

            fs.unlinkSync(imgPath);
            console.log("[DEBUG] Imagem convertida e enviada!");

        } catch (err) {
            console.error("[ERRO] Falha ao converter figurinha:", err);
            await sock.sendMessage(sender, { text: "Erro ao converter a figurinha! 😢" }, { quoted: msg });
        }
    }
}

module.exports = imagesCommandsBot;
