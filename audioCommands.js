const fs = require('fs');
const path = require('path');
const ytdl = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

async function audioCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (textMessage.startsWith('!play ')) {
        const audioPath = path.join(__dirname, 'temp_audio.webm');
        const outputPath = path.join(__dirname, 'temp_audio.mp3');
        
        try {
            const query = textMessage.replace('!play ', '').trim();
            if (!query) {
                await sock.sendMessage(sender, { text: 'Por favor, digite o nome ou link da música! 🎵' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(sender, { text: `🎵 Buscando: *${query}*...` }, { quoted: msg });

            await ytdl(query, {
                output: audioPath,
                format: 'bestaudio',
                noCheckCertificates: true,
                preferFreeFormats: true,
            });

            await new Promise((resolve, reject) => {
                ffmpeg(audioPath)
                    .toFormat('mp3')
                    .audioBitrate('128k')
                    .audioChannels(2)
                    .audioFrequency(44100)
                    .outputOptions(['-threads', '1'])
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            const audio = fs.readFileSync(outputPath);
            await sock.sendMessage(sender, { 
                audio, 
                mimetype: 'audio/mp4',
                fileName: query + '.mp3'
            }, { quoted: msg });

        } catch (error) {
            console.error('Erro ao processar áudio:', error);
            await sock.sendMessage(sender, { text: 'Desculpe, ocorreu um erro ao baixar a música! 😢' }, { quoted: msg });
        } finally {
            try {
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (err) {
                console.error('Erro ao limpar arquivos temporários:', err);
            }
        }
    }

    if (textMessage.startsWith('!playmp4 ')) {
        const videoPath = path.join(__dirname, 'temp_video.mp4');
        const outputPath = path.join(__dirname, 'temp_video_processed.mp4');

        try {
            const query = textMessage.replace('!playmp4 ', '').trim();
            if (!query) {
                await sock.sendMessage(sender, { text: 'Por favor, digite o nome ou link do vídeo! 🎥' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(sender, { text: `🎥 Buscando: *${query}*...` }, { quoted: msg });

            const isShort = query.includes('youtube.com/shorts/');
            
            await ytdl(query, {
                output: videoPath,
                format: isShort ? 'best' : 'best[height<=480]',
                noCheckCertificates: true,
                preferFreeFormats: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                ]
            });

            await new Promise((resolve, reject) => {
                let ffmpegCommand = ffmpeg(videoPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-preset veryfast',
                        '-crf 35',
                        '-maxrate 1M',
                        '-bufsize 2M',
                        '-c:a aac',
                        '-b:a 96k',
                        '-movflags +faststart',
                        '-threads 1'
                    ]);

                if (!isShort) {
                    ffmpegCommand.outputOptions(['-vf', 'scale=480:-2']);
                }

                ffmpegCommand
                    .toFormat('mp4')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            const stats = fs.statSync(outputPath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB > 15) {
                throw new Error('Arquivo muito grande: ' + fileSizeInMB.toFixed(2) + 'MB');
            }

            const video = fs.readFileSync(outputPath);
            await sock.sendMessage(sender, { 
                video,
                caption: `✨ ${query}`,
                mimetype: 'video/mp4'
            }, { quoted: msg });

        } catch (error) {
            console.error('Erro ao processar vídeo:', error);
            await sock.sendMessage(sender, { 
                text: error.message.includes('muito grande') 
                    ? 'Desculpe, o vídeo é muito grande para ser enviado! Tente um vídeo mais curto. 😢' 
                    : 'Desculpe, ocorreu um erro ao baixar o vídeo! 😢'
            }, { quoted: msg });
        } finally {
            try {
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (err) {
                console.error('Erro ao limpar arquivos temporários:', err);
            }
        }
    }
}

module.exports = audioCommandsBot;
