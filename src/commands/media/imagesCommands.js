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
    const isVideo = messageType === 'videoMessage';
    const isReplyToImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isReplyToSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    const isReplyToVideo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
    const messageWithText = msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.extendedTextMessage?.text || '';

    const isStickerCommand = messageWithText.startsWith("!sticker") || messageWithText.startsWith("!fsticker");
    
    if (isStickerCommand) {
        console.log("[DEBUG] Comando de figurinha detectado");
        console.log("[DEBUG] Tipo de mensagem:", messageType);
        console.log("[DEBUG] isImage:", isImage, "isReplyToImage:", isReplyToImage);
        console.log("[DEBUG] isVideo:", isVideo, "isReplyToVideo:", isReplyToVideo);
        console.log("[DEBUG] messageWithText:", messageWithText);
        console.log("[DEBUG] isStickerCommand:", isStickerCommand);

        if (isImage || isReplyToImage || isVideo || isReplyToVideo) {
            try {
                console.log("[DEBUG] Baixando mídia...");
                let mediaMessage;
                let mediaType;
                
                if (isImage || isReplyToImage) {
                    mediaMessage = isImage ? msg.message.imageMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                    mediaType = 'imageMessage';
                } else if (isVideo || isReplyToVideo) {
                    mediaMessage = isVideo ? msg.message.videoMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage;
                    mediaType = 'videoMessage';
                }

                const buffer = await downloadMediaMessage(
                    { message: { [mediaType]: mediaMessage } },
                    "buffer"
                );

                if (!buffer) {
                    console.log("[ERRO] Falha ao baixar a mídia.");
                    await sock.sendMessage(sender, { text: "Erro ao baixar a mídia. Tente novamente!" }, { quoted: msg });
                    return;
                }

                const stickerPath = path.join(__dirname, 'sticker.webp');

                if (mediaType === 'videoMessage') {
                    console.log("[DEBUG] Processando vídeo...");
                    console.log("[DEBUG] Tamanho do buffer:", buffer.length);

                    const command = messageWithText;
                    await processVideoToSticker(buffer, stickerPath, command);
                } else {
                    console.log("[DEBUG] Processando imagem...");
                    const sharpInstance = sharp(buffer).webp();

                    const command = messageWithText;
                    
                    if (command.startsWith("!sticker")) {
                        sharpInstance.resize(1080, 1920, { fit: 'cover' });
                    } else if (command.startsWith("!fsticker")) {
                        sharpInstance.resize(512, 512, { fit: 'cover' });
                    }

                    await sharpInstance.toFile(stickerPath);
                }

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
                console.error("[ERRO] Stack trace:", err.stack);
                console.error("[ERRO] Comando:", messageWithText);
                await sock.sendMessage(sender, { text: `Erro ao criar a figurinha! 😢\n\nDetalhes: ${err.message}` }, { quoted: msg });
            }
        } else {
            console.log("[DEBUG] Nenhuma mídia detectada para criar sticker.");
            await sock.sendMessage(sender, { text: "Envie ou responda a uma imagem, vídeo ou GIF com `!sticker` ou `!fsticker`!" }, { quoted: msg });
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

async function processVideoToSticker(videoBuffer, outputPath, command) {
    return new Promise(async (resolve, reject) => {
        const tempVideoPath = path.join(__dirname, 'temp_video.mp4');
        const tempWebpPath = path.join(__dirname, 'temp_sticker.webp');
        
        console.log("[DEBUG] Iniciando processamento de vídeo...");
        console.log("[DEBUG] Tamanho do buffer:", videoBuffer.length);
        
        try {
            fs.writeFileSync(tempVideoPath, videoBuffer);
            console.log("[DEBUG] Arquivo temporário criado:", tempVideoPath);
        } catch (error) {
            console.error("[ERRO] Falha ao criar arquivo temporário:", error);
            reject(error);
            return;
        }

        let dimensions;
        if (command.startsWith("!sticker")) {
            try {
                dimensions = '512:512';
            } catch (error) {
                console.error('[ERRO] Erro ao detectar dimensões:', error);
                dimensions = '512:512';
            }
        } else if (command.startsWith("!fsticker")) {
            dimensions = '512:512';
        } else {
            dimensions = '512:512';
        }
        
        console.log("[DEBUG] Iniciando conversão FFmpeg...");
        console.log("[DEBUG] Dimensões:", dimensions);

        let videoFilter;
        if (command.startsWith("!sticker")) {
            videoFilter = `scale=${dimensions}`;
        } else {
            videoFilter = `scale=${dimensions}:force_original_aspect_ratio=decrease,pad=${dimensions}:(ow-iw)/2:(oh-ih)/2:color=black`;
        }
        
        ffmpeg(tempVideoPath)
            .outputOptions([
                '-vf', videoFilter,
                '-c:v', 'libwebp',
                '-loop', '0',
                '-quality', '80',
                '-compression_level', '6',
                '-f', 'webp'
            ])
            .output(tempWebpPath)
            .on('start', (commandLine) => {
                console.log("[DEBUG] FFmpeg iniciado:", commandLine);
            })
            .on('progress', (progress) => {
                console.log("[DEBUG] Progresso FFmpeg:", progress.percent + "%");
            })
            .on('end', () => {
                console.log("[DEBUG] FFmpeg finalizado com sucesso");
                try {
                    if (fs.existsSync(tempWebpPath)) {
                        fs.copyFileSync(tempWebpPath, outputPath);
                        fs.unlinkSync(tempWebpPath);
                    }
                    fs.unlinkSync(tempVideoPath);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('[ERRO] FFmpeg error:', error);
                console.error('[ERRO] FFmpeg error message:', error.message);
                console.error('[ERRO] FFmpeg error code:', error.code);
                if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
                reject(error);
            })
            .run();
    });
}

module.exports = imagesCommandsBot;
