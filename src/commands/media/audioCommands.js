const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const https = require('https');
const http = require('http');

ffmpeg.setFfmpegPath(ffmpegPath);

const COOKIES_PATH = path.join(__dirname, '..', '..', '..', 'cookies.txt');

process.env.DENO_INSTALL = '/root/.deno';
process.env.PATH = `/root/.deno/bin:${process.env.PATH}`;

function getVideoInfo(url) {
    const args = [
        url,
        '--print', '%(title)s',
        '--print', '%(thumbnail)s',
        '--no-warnings',
        '--remote-components', 'ejs:github',
    ];

    if (fs.existsSync(COOKIES_PATH)) {
        args.push('--cookies', COOKIES_PATH);
    }

    const result = spawnSync('yt-dlp', args, { 
        encoding: 'utf-8',
        env: process.env 
    });

    if (result.status === 0 && result.stdout) {
        const lines = result.stdout.trim().split('\n');
        return {
            title: lines[0] || 'Vídeo',
            thumbnail: lines[1] || null
        };
    }
    return { title: 'Vídeo', thumbnail: null };
}

function downloadThumbnail(thumbnailUrl, outputPath) {
    return new Promise((resolve) => {
        if (!thumbnailUrl) {
            resolve(null);
            return;
        }

        const protocol = thumbnailUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(outputPath);
        
        protocol.get(thumbnailUrl, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                protocol.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(outputPath);
                    });
                }).on('error', () => resolve(null));
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(outputPath);
                });
            }
        }).on('error', () => resolve(null));
    });
}

function generateVideoThumbnail(videoPath, outputPath) {
    return new Promise((resolve) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '320x180'
            })
            .on('end', () => resolve(outputPath))
            .on('error', () => resolve(null));
    });
}

function listFormats(url) {
    const args = [
        url,
        '--list-formats',
        '--no-warnings',
        '--remote-components', 'ejs:github',
    ];
    if (fs.existsSync(COOKIES_PATH)) args.push('--cookies', COOKIES_PATH);

    const result = spawnSync('yt-dlp', args, { encoding: 'utf-8', env: process.env });
    if (result.status === 0 && result.stdout) {
        return result.stdout;
    }
    return null;
}

function chooseFallbackFormat(formatOutput, mediaType) {
    if (!formatOutput) return null;

    const lines = formatOutput.split('\n');

    const formatLines = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('ID') || trimmed.startsWith('─') || trimmed.startsWith('-')) return false;
        if (trimmed.includes('storyboard') || trimmed.includes('images')) return false;
        return /^\w+/.test(trimmed);
    });

    if (formatLines.length === 0) return null;

    const audioFormats = [];
    const videoFormats = [];

    for (const line of formatLines) {
        const id = line.trim().split(/\s+/)[0];

        if (line.includes('audio only')) {
            audioFormats.push(id);
        } else {
            const resMatch = line.match(/(\d+)x(\d+)/);
            if (resMatch) {
                videoFormats.push({ id, height: parseInt(resMatch[2]) });
            }
        }
    }

    if (mediaType === 'audio') {
        if (audioFormats.length > 0) {
            return audioFormats[audioFormats.length - 1];
        }
        return null;
    }

    const validVideo = videoFormats.filter(f => f.height <= 1080);
    const bestVideo = validVideo.length > 0 ? validVideo[validVideo.length - 1] : (videoFormats.length > 0 ? videoFormats[videoFormats.length - 1] : null);
    const bestAudio = audioFormats.length > 0 ? audioFormats[audioFormats.length - 1] : null;

    if (bestVideo && bestAudio) {
        return `${bestVideo.id}+${bestAudio.id}`;
    }
    if (bestVideo) {
        return bestVideo.id;
    }
    return null;
}

function resolveDownloadedFile(outputDir, outputBase, outputPath) {
    const files = fs.readdirSync(outputDir);
    const baseName = path.basename(outputBase);
    const downloadedFile = files.find(f => f.startsWith(baseName) && !f.includes('.f') && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv') || f.endsWith('.m4a') || f.endsWith('.opus') || f.endsWith('.mp3')));

    if (downloadedFile) {
        const downloadedPath = path.join(outputDir, downloadedFile);
        if (downloadedPath !== outputPath) {
            fs.renameSync(downloadedPath, outputPath);
        }
    }

    files.filter(f => f.startsWith(baseName) && f.includes('.f')).forEach(f => {
        try { fs.unlinkSync(path.join(outputDir, f)); } catch(e) {}
    });
}

async function downloadWithYtdlp(url, outputPath, format, mediaType = 'video') {
    const outputBase = outputPath.replace(/\.[^/.]+$/, '');
    const outputDir = path.dirname(outputPath);

    function buildArgs(fmt, extraArgs = []) {
        const args = [
            url,
            '-o', outputBase + '.%(ext)s',
            '-f', fmt,
            '--no-check-certificates',
            '--no-warnings',
            '--remote-components', 'ejs:github',
            '--merge-output-format', 'mp4',
            '--ffmpeg-location', ffmpegPath.replace(/ffmpeg(\.exe)?$/, ''),
            '--force-overwrites',
            ...extraArgs,
        ];
        if (fs.existsSync(COOKIES_PATH)) args.push('--cookies', COOKIES_PATH);
        return args;
    }

    function tryDownload(args) {
        console.log('[yt-dlp] Executando: yt-dlp', args.join(' '));
        const result = spawnSync('yt-dlp', args, { encoding: 'utf-8', env: process.env });
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        return result;
    }

    if (fs.existsSync(COOKIES_PATH)) {
        console.log('[yt-dlp] Usando cookies de:', COOKIES_PATH);
    }

    // Tentativa 1: formato original
    const result = tryDownload(buildArgs(format));
    if (result.status === 0) {
        resolveDownloadedFile(outputDir, outputBase, outputPath);
        return;
    }

    const errorOutput = (result.stderr || '') + (result.stdout || '');
    if (!errorOutput.includes('Requested format is not available')) {
        throw new Error(`yt-dlp falhou com código ${result.status}`);
    }

    // Tentativa 2: listar formatos e escolher um disponível
    console.log('[yt-dlp] Formato solicitado indisponível. Listando formatos disponíveis...');
    const formatOutput = listFormats(url);
    if (formatOutput) {
        console.log('[yt-dlp] Formatos disponíveis:\n' + formatOutput);
        const fallbackFormat = chooseFallbackFormat(formatOutput, mediaType);
        if (fallbackFormat) {
            console.log(`[yt-dlp] Tentando formato alternativo: ${fallbackFormat}`);
            const retryResult = tryDownload(buildArgs(fallbackFormat));
            if (retryResult.status === 0) {
                resolveDownloadedFile(outputDir, outputBase, outputPath);
                return;
            }
        } else {
            console.log('[yt-dlp] Nenhum formato real encontrado (apenas storyboards). Tentando player clients alternativos...');
        }
    }

    // Tentativa 3: forçar diferentes player clients do YouTube
    const genericFormat = mediaType === 'audio'
        ? 'bestaudio/best'
        : 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
    const playerClients = ['ios', 'android', 'ios,web', 'android,ios', 'mweb'];

    for (const client of playerClients) {
        console.log(`[yt-dlp] Tentando player_client=${client} com formato: ${genericFormat}`);
        const clientResult = tryDownload(buildArgs(genericFormat, [
            '--extractor-args', `youtube:player_client=${client}`
        ]));
        if (clientResult.status === 0) {
            resolveDownloadedFile(outputDir, outputBase, outputPath);
            return;
        }
    }

    // Tentativa 4: último recurso — sem restrição de formato nenhuma
    console.log('[yt-dlp] Último recurso: tentando sem restrição de formato...');
    for (const client of ['ios', 'android']) {
        const lastResult = tryDownload(buildArgs('best', [
            '--extractor-args', `youtube:player_client=${client}`
        ]));
        if (lastResult.status === 0) {
            resolveDownloadedFile(outputDir, outputBase, outputPath);
            return;
        }
    }

    throw new Error('yt-dlp falhou: nenhum formato disponível após todas as tentativas');
}

async function audioCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (textMessage.startsWith('!play ')) {
        const audioPath = path.join(__dirname, 'temp_audio.webm');
        const outputPath = path.join(__dirname, 'temp_audio.mp3');
        const thumbPath = path.join(__dirname, 'temp_audio_thumb.jpg');

        try {
            const query = textMessage.replace('!play ', '').trim();
            if (!query) {
                await sock.sendMessage(sender, { text: 'Por favor, digite o nome ou link da música! 🎵' }, { quoted: msg });
                return;
            }

            const audioInfo = getVideoInfo(query);
            await downloadThumbnail(audioInfo.thumbnail, thumbPath);

            const searchingMessage = {
                text: `🎵 Buscando: *${audioInfo.title}*...`,
            };

            if (fs.existsSync(thumbPath)) {
                searchingMessage.jpegThumbnail = fs.readFileSync(thumbPath);
                searchingMessage.matchedText = query;
                searchingMessage.canonicalUrl = query;
                searchingMessage.title = audioInfo.title;
                searchingMessage.description = '🎵 Baixando música do YouTube...';
            }

            await sock.sendMessage(sender, searchingMessage, { quoted: msg });

            await downloadWithYtdlp(query, audioPath, 'bestaudio/best', 'audio');

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
                if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            } catch (err) {
                console.error('Erro ao limpar arquivos temporários:', err);
            }
        }
    }

    if (textMessage.startsWith('!playmp4 ')) {
        const videoPath = path.join(__dirname, 'temp_video.mp4');
        const thumbPath = path.join(__dirname, 'temp_thumb.jpg');

        try {
            const query = textMessage.replace('!playmp4 ', '').trim();
            if (!query) {
                await sock.sendMessage(sender, { text: 'Por favor, digite o nome ou link do vídeo! 🎥' }, { quoted: msg });
                return;
            }

            const videoInfo = getVideoInfo(query);
            console.log('[playmp4] Título:', videoInfo.title);

            await downloadThumbnail(videoInfo.thumbnail, thumbPath);
            
            const searchingMessage = {
                text: `🎥 Buscando: *${videoInfo.title}*...`,
            };

            if (fs.existsSync(thumbPath)) {
                searchingMessage.jpegThumbnail = fs.readFileSync(thumbPath);
                searchingMessage.matchedText = query;
                searchingMessage.canonicalUrl = query;
                searchingMessage.title = videoInfo.title;
                searchingMessage.description = '🎬 Baixando vídeo do YouTube...';
            }

            await sock.sendMessage(sender, searchingMessage, { quoted: msg });

            await downloadWithYtdlp(query, videoPath, 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=avc]+bestaudio/best[height<=1080]', 'video');

            if (!fs.existsSync(videoPath)) {
                throw new Error('Arquivo não foi baixado');
            }

            const stats = fs.statSync(videoPath);
            const fileSizeInMB = stats.size / (1024 * 1024);
            console.log(`[playmp4] Tamanho do arquivo: ${fileSizeInMB.toFixed(2)}MB`);

            const videoThumbPath = path.join(__dirname, 'temp_video_thumb.jpg');
            console.log('[playmp4] Gerando thumbnail...');
            await generateVideoThumbnail(videoPath, videoThumbPath);

            console.log('[playmp4] Enviando vídeo...');
            const video = fs.readFileSync(videoPath);
            
            const messageOptions = { 
                video,
                caption: `✨ *${videoInfo.title}*`,
                mimetype: 'video/mp4'
            };

            if (fs.existsSync(videoThumbPath)) {
                messageOptions.jpegThumbnail = fs.readFileSync(videoThumbPath);
                console.log('[playmp4] Thumbnail adicionada!');
            }

            await sock.sendMessage(sender, messageOptions, { quoted: msg });
            console.log('[playmp4] Vídeo enviado com sucesso!');
            
            if (fs.existsSync(videoThumbPath)) fs.unlinkSync(videoThumbPath);

            try {
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            } catch (err) {
                console.error('Erro ao limpar arquivos temporários:', err);
            }
        } catch (error) {
            console.error('Erro ao processar vídeo:', error);
            await sock.sendMessage(sender, { 
                text: 'Desculpe, ocorreu um erro ao baixar o vídeo! 😢'
            }, { quoted: msg });
        }
    }
}

module.exports = audioCommandsBot;
