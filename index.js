const { makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const sharp = require('sharp');
const { exec } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("Escaneie o QR Code para conectar:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log("Conexão fechada, tentando reconectar:", shouldReconnect);
            if (shouldReconnect) connectBot();
        } else if (connection === 'open') {
            console.log("Bot conectado com sucesso!");
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        const sender = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        const isSticker = messageType === 'stickerMessage';
        const isImage = messageType === 'imageMessage';
        const isReplyToImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isReplyToSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`[DEBUG] Mensagem recebida de ${sender}: ${textMessage}`);

        if (textMessage.startsWith("!sticker") || msg.message.extendedTextMessage?.text?.startsWith("!sticker")) {
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

        if (textMessage.startsWith("!menu")) {
            console.log("[DEBUG] Enviando menu de comandos...");
            const menuText = `📌 *Menu de Comandos:*\n
✅ *!menu* - Exibe esta lista de comandos.\n
✅ *!sticker* - Cria uma figurinha a partir de uma imagem.\n
✅ *!toimg* - Converte uma figurinha de volta para imagem PNG.\n
✅ *!play <nome ou link>* - Baixa uma música do YouTube e envia no WhatsApp.\n
✅ *!playmp4 <nome ou link>* - Baixa um vídeo do YouTube e envia no WhatsApp.\n
✅ *!gay* - Calcula a % de gay da pessoa.\n
✅ *!corno* - Calcula a % de corno da pessoa.\n
✅ *!hetero* - Calcula a % de hetero da pessoa.\n
✅ *!chato* - Calcula a % de chato da pessoa.\n`;

            await sock.sendMessage(sender, { text: menuText }, { quoted: msg });
        }

        if (textMessage.startsWith("!play ")) {
            try {
                const query = textMessage.replace("!play ", "").trim();
                if (!query) {
                    await sock.sendMessage(sender, { text: "Digite um nome ou link de vídeo do YouTube! 🎵" }, { quoted: msg });
                    return;
                }

                console.log(`[DEBUG] Buscando música para: ${query}`);
                const audioPath = path.join(__dirname, 'audio.mp3');
                const tempAudioPath = path.join(__dirname, 'temp_audio.mp3');

                await sock.sendMessage(sender, { text: `🎶 Baixando: *${query}*...` }, { quoted: msg });

                console.log("[DEBUG] Iniciando download com yt-dlp...");
                exec(`yt-dlp -x --audio-format mp3 --ffmpeg-location "${ffmpegPath}" -o "${audioPath}" "${query}"`, async (error, stdout, stderr) => {
                    if (error) {
                        console.error("[ERRO] Falha ao baixar música:", error);
                        await sock.sendMessage(sender, { text: "Erro ao baixar a música! 😢" }, { quoted: msg });
                        return;
                    }

                    console.log("[DEBUG] Download concluído, processando áudio...");

                    ffmpeg(audioPath)
                        .audioBitrate(128)
                        .toFormat('mp3')
                        .save(tempAudioPath)
                        .on('end', async () => {
                            fs.renameSync(tempAudioPath, audioPath);

                            console.log("[DEBUG] Áudio processado, enviando...");
                            const audio = fs.readFileSync(audioPath);
                            await sock.sendMessage(sender, { audio, mimetype: 'audio/mp4' }, { quoted: msg });

                            fs.unlinkSync(audioPath);
                            console.log("[DEBUG] Música enviada com sucesso!");
                        })
                        .on('error', (err) => {
                            console.error("[ERRO] Falha ao processar áudio:", err);
                            fs.unlinkSync(audioPath);
                            sock.sendMessage(sender, { text: "Erro ao processar a música! 😢" }, { quoted: msg });
                        });
                });

            } catch (err) {
                console.error("[ERRO] Falha ao baixar música:", err);
                await sock.sendMessage(sender, { text: "Erro ao baixar a música! 😢" }, { quoted: msg });
            }
        }

        if (textMessage.startsWith("!playmp4 ")) {
            try {
                const query = textMessage.replace("!playmp4 ", "").trim();
                if (!query) {
                    await sock.sendMessage(sender, { text: "Digite um nome ou link de vídeo do YouTube! 🎥" }, { quoted: msg });
                    return;
                }

                console.log(`[DEBUG] Buscando vídeo para: ${query}`);

                const videoPath = path.join(__dirname, 'video');
                const audioPath = path.join(__dirname, 'audio');
                const outputPath = path.join(__dirname, 'video_with_audio.mp4');

                console.log(`[DEBUG] Caminho do vídeo: ${videoPath}`);
                console.log(`[DEBUG] Caminho do áudio: ${audioPath}`);

                await sock.sendMessage(sender, { text: `🎬 Baixando: *${query}*...` }, { quoted: msg });

                console.log("[DEBUG] Iniciando download com yt-dlp...");
                exec(`yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 -o "${videoPath}-%(id)s.%(ext)s" "${query}"`, async (error, stdout, stderr) => {
                    if (error) {
                        console.error("[ERRO] Falha ao baixar vídeo:", error);
                        await sock.sendMessage(sender, { text: "Erro ao baixar o vídeo! 😢" }, { quoted: msg });
                        return;
                    }

                    console.log("[DEBUG] Vídeo e áudio baixados, agora combinando...");

                    const files = fs.readdirSync(__dirname);
                    console.log(`[DEBUG] Arquivos no diretório atual: ${files}`);

                    const videoFile = files.find(file => file.endsWith('.mp4') && file.includes('video'));
                    const audioFile = files.find(file => file.endsWith('.webm') && file.includes('video'));

                    if (!videoFile || !audioFile) {
                        console.error("[ERRO] Arquivos de vídeo ou áudio não encontrados.");
                        await sock.sendMessage(sender, { text: "Erro ao encontrar os arquivos de vídeo ou áudio! 😢" }, { quoted: msg });
                        return;
                    }

                    const videoFilePath = path.join(__dirname, videoFile);
                    const audioFilePath = path.join(__dirname, audioFile);

                    console.log(`[DEBUG] Vídeo encontrado: ${videoFilePath}`);
                    console.log(`[DEBUG] Áudio encontrado: ${audioFilePath}`);

                    console.log(`[DEBUG] Vídeo encontrado: ${videoFilePath}`);
                    console.log(`[DEBUG] Áudio encontrado: ${audioFilePath}`);

                    ffmpeg()
                        .input(videoFilePath)
                        .input(audioFilePath)
                        .output(outputPath)
                        .audioCodec('aac')
                        .videoCodec('copy')
                        .on('end', async () => {
                            console.log("[DEBUG] Arquivo combinado com sucesso!");

                            const video = fs.readFileSync(outputPath);
                            await sock.sendMessage(sender, { video, mimetype: 'video/mp4' }, { quoted: msg });

                            fs.unlinkSync(videoFilePath);
                            fs.unlinkSync(audioFilePath);
                            fs.unlinkSync(outputPath);

                            console.log("[DEBUG] Vídeo enviado com sucesso!");
                        })
                        .on('error', async (err) => {
                            console.error("[ERRO] Falha ao combinar o vídeo e o áudio:", err);
                            await sock.sendMessage(sender, { text: "Erro ao combinar vídeo e áudio! 😢" }, { quoted: msg });
                        })
                        .run();
                });

            } catch (err) {
                console.error("[ERRO] Falha ao baixar vídeo:", err);
                await sock.sendMessage(sender, { text: "Erro ao baixar o vídeo! 😢" }, { quoted: msg });
            }
        }

        if (textMessage.startsWith("!gay")) {
            console.log("[DEBUG] Comando !gay detectado");
        
            const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
            if (mentionedJid && mentionedJid.length > 0) {
                const userToMention = mentionedJid[0];
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `@${userToMention.split('@')[0]} é ${percentage}% gay! 🏳‍🌈🏳‍🌈🏳‍🌈`;
        
                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userToMention],
                }, { quoted: msg });
            } else {
                const nameArgument = textMessage.slice(5).trim().toLowerCase();
                
                if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `Você é ${percentage}% gay! 🏳‍🌈🏳‍🌈🏳‍🌈`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [sender],
                    }, { quoted: msg });
                } else if (nameArgument) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} você é ${percentage}% gay! 🏳‍🌈🏳‍🌈🏳‍🌈`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        text: "Por favor, mencione um usuário ou forneça um nome com o comando !gay nome.",
                    }, { quoted: msg });
                }
            }
        }

        if (textMessage.startsWith("!corno")) {
            console.log("[DEBUG] Comando !corno detectado");
        
            const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
            if (mentionedJid && mentionedJid.length > 0) {
                const userToMention = mentionedJid[0];
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `@${userToMention.split('@')[0]} é ${percentage}% corno! 🐂🐂🐂`;
        
                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userToMention],
                }, { quoted: msg });
            } else {
                const nameArgument = textMessage.slice(5).trim().toLowerCase();
                
                if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `Você é ${percentage}% corno! 🐂🐂🐂`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [sender],
                    }, { quoted: msg });
                } else if (nameArgument) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} você é ${percentage}% corno! 🐂🐂🐂`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        text: "Por favor, mencione um usuário ou forneça um nome com o comando !corno nome.",
                    }, { quoted: msg });
                }
            }
        }
        
        if (textMessage.startsWith("!hetero")) {
            console.log("[DEBUG] Comando !hetero detectado");
        
            const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
            if (mentionedJid && mentionedJid.length > 0) {
                const userToMention = mentionedJid[0];
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `@${userToMention.split('@')[0]} é ${percentage}% hétero! 🩲`;
        
                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userToMention],
                }, { quoted: msg });
            } else {
                const nameArgument = textMessage.slice(5).trim().toLowerCase();
                
                if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `Você é ${percentage}% hétero! 🩲`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [sender],
                    }, { quoted: msg });
                } else if (nameArgument) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} você é ${percentage}% hétero! 🩲`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        text: "Por favor, mencione um usuário ou forneça um nome com o comando !hetero nome.",
                    }, { quoted: msg });
                }
            }
        }

        if (textMessage.startsWith("!chato")) {
            console.log("[DEBUG] Comando !chato detectado");
        
            const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
            if (mentionedJid && mentionedJid.length > 0) {
                const userToMention = mentionedJid[0];
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `@${userToMention.split('@')[0]} é ${percentage}% chato! 😡`;
        
                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userToMention],
                }, { quoted: msg });
            } else {
                const nameArgument = textMessage.slice(5).trim().toLowerCase();
                
                if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `Você é ${percentage}% chato! 😡`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [sender],
                    }, { quoted: msg });
                } else if (nameArgument) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} você é ${percentage}% chato! 😡`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        text: "Por favor, mencione um usuário ou forneça um nome com o comando !chato nome.",
                    }, { quoted: msg });
                }
            }
        }

        if (textMessage.startsWith("!ship")) {
            console.log("[DEBUG] Comando !ship detectado");
        
            const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
            if (mentionedJid && mentionedJid.length === 2) {
                const userToMention1 = mentionedJid[0];
                const userToMention2 = mentionedJid[1];
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `@${userToMention1.split('@')[0]} e @${userToMention2.split('@')[0]} tem ${percentage}% de chance de namorarem! 👫👫👫`;
        
                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userToMention1, userToMention2],
                }, { quoted: msg });
            } else {
                const args = textMessage.slice(5).trim().split(" ");
                const nameArgument = args[0];
                const nameArgument2 = args.slice(1).join(" ");
        
                if ((nameArgument.toLowerCase() === "eu" || nameArgument.toLowerCase() === "me") && !nameArgument2) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `Você e @${sender.split('@')[0]} tem ${percentage}% de chance de namorarem! 👫👫👫`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [sender],
                    }, { quoted: msg });
                } else if (nameArgument && nameArgument2) {
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} e ${nameArgument2} tem ${percentage}% de chance de namorarem! 👫👫👫`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                    }, { quoted: msg });
                } else if (nameArgument && mentionedJid && mentionedJid.length === 1) {
                    const userToMention = mentionedJid[0];
                    const percentage = Math.floor(Math.random() * 101);
                    const replyText = `${nameArgument} e @${userToMention.split('@')[0]} tem ${percentage}% de chance de namorarem! 👫👫👫`;
        
                    await sock.sendMessage(sender, {
                        text: replyText,
                        mentions: [userToMention],
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        text: "Por favor, mencione dois usuários ou forneça dois nomes com o comando !ship nome1 nome2.",
                    }, { quoted: msg });
                }
            }
        }         
    });
}

connectBot();
