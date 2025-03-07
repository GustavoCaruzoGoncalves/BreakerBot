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
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (textMessage.startsWith("!sticker") || isImage) {
        console.log("[DEBUG] Comando !sticker detectado");

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

                console.log("[DEBUG] Convertendo imagem para WebP...");
                await sharp(buffer).resize(512, 512).webp().toFile(stickerPath);

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
            await sock.sendMessage(sender, { text: "Envie ou responda a uma imagem com `!sticker`!" }, { quoted: msg });
        }
    }

    if (textMessage.startsWith("!toimg") && isReplyToSticker) {
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
