const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

async function audioCommandsBot(sock, { messages }) {
    const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        const sender = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

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
}

module.exports = audioCommandsBot;
