const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const sharp = require('sharp');
const mentionsController = require('../../controllers/mentionsController');
const { admins } = require('../../config/adm');
const { PREFIX } = require('../../config/prefix');

const USERS_FILE = path.resolve(__dirname, '..', '..', '..', 'levels_info', 'users.json');

function loadUsersData() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[EMOJI REACTION] Erro ao carregar users.json:', error);
    }
    return {};
}

function saveUsersData(data) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[PFP] Erro ao salvar users.json:', err);
    }
}

function findUserByJid(usersData, jid) {
    if (usersData[jid]) {
        return { key: jid, user: usersData[jid] };
    }
    for (const [key, userData] of Object.entries(usersData)) {
        if (userData.jid === jid) {
            return { key, user: userData };
        }
    }
    return { key: null, user: null };
}

async function downloadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadImageAsBase64(response.headers.location).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                return reject(new Error(`Erro ao baixar imagem: ${response.statusCode}`));
            }
            
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const contentType = response.headers['content-type'] || 'image/jpeg';
                const dataUrl = `data:${contentType};base64,${base64}`;
                resolve(dataUrl);
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function applyGrayscaleFilter(inputBuffer) {
    return sharp(inputBuffer).grayscale().jpeg().toBuffer();
}

async function applyLGBTFilter(inputBuffer) {
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    const rainbowSVG = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="rainbow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#FF0000;stop-opacity:0.95" />
                    <stop offset="16.66%" style="stop-color:#FF8C00;stop-opacity:0.95" />
                    <stop offset="33.33%" style="stop-color:#FFD700;stop-opacity:0.95" />
                    <stop offset="50%" style="stop-color:#00FF00;stop-opacity:0.95" />
                    <stop offset="66.66%" style="stop-color:#0000FF;stop-opacity:0.95" />
                    <stop offset="83.33%" style="stop-color:#8B00FF;stop-opacity:0.95" />
                    <stop offset="100%" style="stop-color:#FF1493;stop-opacity:0.95" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#rainbow)" />
        </svg>
    `;

    const rainbowOverlay = Buffer.from(rainbowSVG);

    return sharp(inputBuffer)
        .composite([{ input: rainbowOverlay, blend: 'overlay' }])
        .modulate({ saturation: 1.8, brightness: 1.1 })
        .jpeg()
        .toBuffer();
}

async function applyBolsonaroFilter(inputBuffer) {
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    const brazilSVG = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="brazil" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#009B3A;stop-opacity:0.9" />
                    <stop offset="50%" style="stop-color:#FFDF00;stop-opacity:0.9" />
                    <stop offset="100%" style="stop-color:#002776;stop-opacity:0.9" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#brazil)" />
        </svg>
    `;

    const brazilOverlay = Buffer.from(brazilSVG);

    const logoPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'logobolsonaro.png');
    const hasLogo = fs.existsSync(logoPath);

    const composites = [{ input: brazilOverlay, blend: 'overlay' }];

    if (hasLogo) {
        const logoMetadata = await sharp(logoPath).metadata();
        const logoAspectRatio = logoMetadata.width / logoMetadata.height;

        const maxLogoHeight = Math.floor(height * 0.35);
        const logoHeight = Math.min(maxLogoHeight, height);
        const logoWidth = Math.floor(logoHeight * logoAspectRatio);

        const logoBuffer = await sharp(logoPath)
            .resize(logoWidth, logoHeight, { fit: 'contain' })
            .toBuffer();

        const topOffset = height - logoHeight;
        const leftOffset = Math.floor((width - logoWidth) / 2);

        composites.push({
            input: logoBuffer,
            top: topOffset,
            left: leftOffset,
            blend: 'over'
        });
    }

    return sharp(inputBuffer)
        .composite(composites)
        .modulate({ saturation: 1.4, brightness: 1.05 })
        .jpeg()
        .toBuffer();
}

async function applyBolsonaro2Filter(inputBuffer) {
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    const brazilSVG = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="brazil2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#009B3A;stop-opacity:0.9" />
                    <stop offset="50%" style="stop-color:#FFDF00;stop-opacity:0.9" />
                    <stop offset="100%" style="stop-color:#002776;stop-opacity:0.9" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#brazil2)" />
        </svg>
    `;

    const brazilOverlay = Buffer.from(brazilSVG);

    const logoPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'logobolsonaro2.png');
    const hasLogo = fs.existsSync(logoPath);

    const composites = [{ input: brazilOverlay, blend: 'overlay' }];

    if (hasLogo) {
        const logoMetadata = await sharp(logoPath).metadata();
        const logoAspectRatio = logoMetadata.width / logoMetadata.height;

        const maxLogoHeight = Math.floor(height * 0.6);
        const logoHeight = Math.min(maxLogoHeight, height);
        const logoWidth = Math.floor(logoHeight * logoAspectRatio);

        const logoBuffer = await sharp(logoPath)
            .resize(logoWidth, logoHeight, { fit: 'contain' })
            .toBuffer();

        const topOffset = height - logoHeight + Math.floor(height * 0.1);
        const leftOffset = Math.floor((width - logoWidth) / 2);

        composites.push({
            input: logoBuffer,
            top: topOffset,
            left: leftOffset,
            blend: 'over'
        });
    }

    return sharp(inputBuffer)
        .composite(composites)
        .modulate({ saturation: 1.4, brightness: 1.05 })
        .jpeg()
        .toBuffer();
}

async function applyBolsonaro3Filter(inputBuffer) {
    const framePath = path.resolve(__dirname, '..', '..', '..', 'assets', 'logobolsonaro3.png');
    const hasFrame = fs.existsSync(framePath);

    if (!hasFrame) {
        return sharp(inputBuffer).jpeg().toBuffer();
    }

    const frameMetadata = await sharp(framePath).metadata();
    const frameWidth = frameMetadata.width;
    const frameHeight = frameMetadata.height;

    const photoSize = Math.min(frameWidth, frameHeight) * 0.625;

    const resizedPhoto = await sharp(inputBuffer)
        .resize(Math.floor(photoSize), Math.floor(photoSize), { fit: 'cover' })
        .toBuffer();

    const frameBuffer = await sharp(framePath).toBuffer();

    return sharp({
        create: {
            width: frameWidth,
            height: frameHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .composite([
            {
                input: resizedPhoto,
                gravity: 'center',
                blend: 'over'
            },
            {
                input: frameBuffer,
                gravity: 'center',
                blend: 'over'
            }
        ])
        .jpeg()
        .toBuffer();
}

async function jokesCommandsBot(sock, { messages }, contactsCache = {}) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe || messageType === 'reactionMessage') {
        return;
    }

    //const poopNumber = process.env.POOP_NUMBER;
    //if (messageType === 'reactionMessage') {
    //    const reactionSender = isGroup 
    //        ? (msg.key.participantAlt || msg.key.remoteJid)
    //        : msg.key.remoteJid;
    //    
    //    console.log(`[DEBUG POOP REAÇÃO] Reação detectada!`);
    //    console.log(`[DEBUG POOP REAÇÃO] Sender: ${reactionSender}`);
    //    console.log(`[DEBUG POOP REAÇÃO] Match: ${reactionSender.includes(poopNumber)}`);
    //    
    //    if (reactionSender.includes(poopNumber)) {
    //        try {
    //            await sock.sendMessage(chatId, {
    //                text: "💩"
    //            });
    //            console.log(`[DEBUG POOP REAÇÃO] Mensagem enviada com sucesso!`);
     //       } catch (err) {
      //          console.error(`[DEBUG POOP REAÇÃO] Erro ao enviar mensagem:`, err);
       //     }
       // }
   // }

    function getPushName(jid) {
        return mentionsController.getPushName(jid, contactsCache);
    }

    function getRandomPercentage() {
        return Math.floor(Math.random() * 101);
    }

    function isSelfReference(name) {
        return ["eu", "me", "eu me", "me eu"].includes(name);
    }

    function isPedraoVariation(name) {
        const pedraoVariations = ["pedrão", "pedrao", "perdão", "perdao", "pedrao", "pedrão"];
        return pedraoVariations.some(variation => 
            name.toLowerCase().includes(variation.toLowerCase())
        );
    }

    const pedraoNumber = process.env.PEDRAO_NUMBER;

    function isPedraoNumber(jid) {
        return jid === pedraoNumber + "@s.whatsapp.net";
    }

    async function handleCommand({ command, emoji, customText }) {
        console.log(`[DEBUG] Comando ${command} detectado`);
        console.log('========== LOG DE MENÇÃO ==========');
        console.log('[DEBUG] Mensagem completa (msg):', JSON.stringify(msg, null, 2));
        console.log('[DEBUG] msg.key:', JSON.stringify(msg.key, null, 2));
        console.log('[DEBUG] msg.message:', JSON.stringify(msg.message, null, 2));
        console.log('[DEBUG] msg.message.extendedTextMessage:', JSON.stringify(msg.message.extendedTextMessage, null, 2));
        console.log('[DEBUG] contextInfo:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo, null, 2));
        console.log('[DEBUG] mentionedJid:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo?.mentionedJid, null, 2));
        console.log('[DEBUG] participantAlt:', msg.key.participantAlt);
        console.log('[DEBUG] participant:', msg.key.participant);
        console.log('[DEBUG] sender:', sender);
        console.log('===================================');
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const mentionInfo = mentionsController.processSingleMention(userToMention, contactsCache);
            let percentage = getRandomPercentage();
            let replyText;
            const leitadaCommand = `${PREFIX}leitada`;
            
            if (isPedraoNumber(userToMention) && textMessage.startsWith(leitadaCommand)) {
                percentage = 100;
                replyText = `${mentionInfo.mentionText} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                
                const stickerPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'pedrao_sticker.webp');
                if (fs.existsSync(stickerPath)) {
                    await sock.sendMessage(chatId, {
                        sticker: fs.readFileSync(stickerPath),
                    }, { quoted: msg });
                }
            } else if (textMessage.startsWith(leitadaCommand)){
                replyText = `${mentionInfo.mentionText} levou ${percentage}% ${customText}! ${emoji}`;
            } else {
                replyText = `${mentionInfo.mentionText} é ${percentage}% ${customText}! ${emoji}`;
            }
            
            if (!mentionInfo.hasName && !mentionInfo.canMention) {
                replyText += `\n\n💡 Dica: os usuários precisam enviar alguma mensagem para que seus nomes apareçam quando as menções estão desativadas, ou podem adicionar um nome personalizado para que assim possam ser chamados`;
            }

            await sock.sendMessage(chatId, {
                text: replyText,
                mentions: mentionInfo.mentions,
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(command.length).trim();


            if (isSelfReference(nameArgument)) {
                let percentage = getRandomPercentage();
                let replyText;
                const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
                const leitadaCommand = `${PREFIX}leitada`;
                
                if (textMessage.startsWith(leitadaCommand)){
                    replyText = `Você levou ${percentage}% ${customText}! ${emoji}`;
                } else {
                    replyText = `Você é ${percentage}% ${customText}! ${emoji}`;
                }

                await sock.sendMessage(chatId, {
                    text: replyText,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });
            } else if (nameArgument) {
                let percentage = getRandomPercentage();
                let replyText;
                const leitadaCommand = `${PREFIX}leitada`;
                
                if (isPedraoVariation(nameArgument) && textMessage.startsWith(leitadaCommand)) {
                    percentage = 100;
                    replyText = `${nameArgument} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                    
                    const stickerPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'pedrao_sticker.webp');
                    if (fs.existsSync(stickerPath)) {
                        await sock.sendMessage(chatId, {
                            sticker: fs.readFileSync(stickerPath),
                        }, { quoted: msg });
                    }
                } else if (textMessage.startsWith(leitadaCommand)){
                    replyText = `${nameArgument} levou ${percentage}% ${customText}! ${emoji}`;
                } else {
                    replyText = `${nameArgument} é ${percentage}% ${customText}! ${emoji}`;
                }

                await sock.sendMessage(chatId, {
                    text: replyText,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, {
                    text: `Por favor, mencione um usuário ou forneça um nome com o comando ${command} nome.`,
                }, { quoted: msg });
            }
        }
    }

    // Verifica reação de emoji personalizada do usuário
    const usersData = loadUsersData();
    
    // Busca o usuário pelo sender ou pelo jid associado
    let userEmojiConfig = null;
    
    // Primeiro tenta encontrar diretamente pelo sender
    if (usersData[sender]) {
        userEmojiConfig = usersData[sender];
    } else {
        // Se não encontrar, busca por usuário que tenha o sender como jid
        for (const [key, userData] of Object.entries(usersData)) {
            if (userData.jid === sender) {
                userEmojiConfig = userData;
                break;
            }
        }
    }
    
    // Se o usuário tem emojiReaction ativado e um emoji configurado, envia a reação
    if (userEmojiConfig && userEmojiConfig.emojiReaction && userEmojiConfig.emoji) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: userEmojiConfig.emoji,
                    key: msg.key
                }
            });
            console.log(`[EMOJI REACTION] Reação ${userEmojiConfig.emoji} enviada para ${sender}`);
        } catch (err) {
            console.error(`[EMOJI REACTION] Erro ao enviar reação:`, err);
        }
    }

    const gayCommand = `${PREFIX}gay`;
    const cornoCommand = `${PREFIX}corno`;
    const heteroCommand = `${PREFIX}hetero`;
    const chatoCommand = `${PREFIX}chato`;
    const petistaCommand = `${PREFIX}petista`;
    const bolsonaristaCommand = `${PREFIX}bolsonarista`;
    const leitadaCommand = `${PREFIX}leitada`;
    const burroCommand = `${PREFIX}burro`;
    const pintoCommand = `${PREFIX}pinto`;
    const fazolCommand = `${PREFIX}fazol`;
    const marcacoesCommand = `${PREFIX}marcacoes`;
    const marcarMeCommand = `${PREFIX}marcarMe`;
    const customNameCommand = `${PREFIX}customName`;
    const setCustomNameCommand = `${PREFIX}setCustomName`;
    const shipCommand = `${PREFIX}ship`;
    const hugCommand = `${PREFIX}hug`;
    const transarCommand = `${PREFIX}transar`;
    const arrebentarCommand = `${PREFIX}arrebentar`;
    const vumvumCommand = `${PREFIX}vumvum`;
    const pfpCommand = `${PREFIX}pfp`;
    const pfpDeadCommand = `${PREFIX}pfpdead`;
    const pfpGayCommand = `${PREFIX}pfpgay`;
    const pfpBolsonaroCommand = `${PREFIX}pfpbolsonaro`;
    const pfpBolsonaro2Command = `${PREFIX}pfpbolsonaro2`;
    const pfpBolsonaro3Command = `${PREFIX}pfpbolsonaro3`;
    const rankingGayCommand = `${PREFIX}rankingGay`;

    if (textMessage.startsWith(gayCommand)) {
        await handleCommand({
            command: gayCommand,
            emoji: "🏳‍🌈🏳‍🌈🏳‍🌈",
            customText: "gay"
        });
    }

    if (textMessage.startsWith(cornoCommand)) {
        await handleCommand({
            command: cornoCommand,
            emoji: "🐂🐂🐂",
            customText: "corno"
        });
    }

    if (textMessage.startsWith(heteroCommand)) {
        await handleCommand({
            command: heteroCommand,
            emoji: "🩲",
            customText: "hétero"
        });
    }

    if (textMessage.startsWith(chatoCommand)) {
        await handleCommand({
            command: chatoCommand,
            emoji: "😡",
            customText: "chato"
        });
    }

    if (textMessage.startsWith(petistaCommand)) {
        await handleCommand({
            command: petistaCommand,
            emoji: "🚩🚩🚩",
            customText: "petista"
        });
    }

    if (textMessage.startsWith(bolsonaristaCommand)) {
        await handleCommand({
            command: bolsonaristaCommand,
            emoji: "🇧🇷🇧🇷🇧🇷",
            customText: "bolsonarista"
        });
    }

    if (textMessage.startsWith(leitadaCommand)) {
        await handleCommand({
            command: leitadaCommand,
            emoji: "🥛🥛🥛",
            customText: "de leitada"
        });
    }

    if (textMessage.startsWith(burroCommand)) {
        await handleCommand({
            command: burroCommand,
            emoji: "🫏🫏🫏",
            customText: "burro"
        });
    }

    if (textMessage.startsWith(pintoCommand)) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
        const isSpecial = Math.random() < 0.01;
        
        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const mentionInfo = mentionsController.processSingleMention(userToMention, contactsCache);
            let replyText;
            
            if (isSpecial) {
                await sock.sendMessage(chatId, {
                    text: `${mentionInfo.mentionText}, VOCÊ TEM 1000km DE PICA KKKKKKKKKKKKKKKKKK`,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });
                
                if (process.env.PINTO_MESSAGE) {
                    await sock.sendMessage(chatId, {
                        text: process.env.PINTO_MESSAGE,
                        mentions: mentionInfo.mentions,
                    }, { quoted: msg });
                }
            } else {
                const size = (Math.random() * 39.9 + 0.1).toFixed(1);
                replyText = `${mentionInfo.mentionText} tem ${size}cm de pinto! 🍆`;
                
                if (!mentionInfo.hasName && !mentionInfo.canMention) {
                    replyText += `\n\n💡 Dica: os usuários precisam enviar alguma mensagem para que seus nomes apareçam quando as menções estão desativadas, ou podem adicionar um nome personalizado para que assim possam ser chamados`;
                }

                await sock.sendMessage(chatId, {
                    text: replyText,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });
            }
        } else {
            const nameArgument = textMessage.slice(pintoCommand.length).trim();

            if (isSelfReference(nameArgument)) {
                let replyText;
                
                if (isSpecial) {
                    const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
                    
                    await sock.sendMessage(chatId, {
                        text: `${mentionInfo.mentionText}, VOCÊ TEM 1000km DE PICA KKKKKKKKKKKKKKKKKK`,
                        mentions: mentionInfo.mentions,
                    }, { quoted: msg });
                    
                    if (process.env.PINTO_MESSAGE) {
                        await sock.sendMessage(chatId, {
                            text: process.env.PINTO_MESSAGE,
                            mentions: mentionInfo.mentions,
                        }, { quoted: msg });
                    }
                } else {
                    const size = (Math.random() * 39.9 + 0.1).toFixed(1);
                    replyText = `Você tem ${size}cm de pinto! 🍆`;

                    await sock.sendMessage(chatId, {
                        text: replyText,
                    }, { quoted: msg });
                }
            } else if (nameArgument) {
                let replyText;
                
                if (isSpecial) {
                    await sock.sendMessage(chatId, {
                        text: `${nameArgument}, VOCÊ TEM 1000km DE PICA KKKKKKKKKKKKKKKKKK`,
                    }, { quoted: msg });
                    
                    if (process.env.PINTO_MESSAGE) {
                        await sock.sendMessage(chatId, {
                            text: process.env.PINTO_MESSAGE,
                        }, { quoted: msg });
                    }
                } else {
                    const size = (Math.random() * 39.9 + 0.1).toFixed(1);
                    replyText = `${nameArgument} tem ${size}cm de pinto! 🍆`;

                    await sock.sendMessage(chatId, {
                        text: replyText,
                    }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(chatId, {
                text: `Por favor, mencione um usuário ou forneça um nome com o comando ${pintoCommand} nome.`,
                }, { quoted: msg });
            }
        }
    }

    function checkCumprimentoPedrao() {
        const cumprimentos = ["bom dia", "boa tarde", "boa noite"];
        const variacoesPedrao = ["perdao", "perdão", "pedrão", "pedrao"];
        
        const textoLower = textMessage.toLowerCase();
        
        for (const cumprimento of cumprimentos) {
            for (const variacao of variacoesPedrao) {
                const patterns = [
                    `${cumprimento} ${variacao}`,
                    `${cumprimento}, ${variacao}`,
                    `${cumprimento} ${variacao}!`,
                    `${cumprimento}, ${variacao}!`
                ];
                
                for (const pattern of patterns) {
                    if (textoLower.startsWith(pattern)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    if (checkCumprimentoPedrao()) {
        const stickerPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'pedrao_sticker.webp');
        
        if (fs.existsSync(stickerPath)) {
            await sock.sendMessage(chatId, {
                sticker: fs.readFileSync(stickerPath),
            }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, {
            text: "O PERDÃO JÁ LEVOU 100% DA LEITADA KKKKKKKKKKKKKKKKK",
        }, { quoted: msg });
    }

    if (textMessage.startsWith(fazolCommand) || textMessage.toUpperCase().startsWith(fazolCommand.toUpperCase())) {
        const videoPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'MarioFazOL.mp4');

        if (fs.existsSync(videoPath)) {
            await sock.sendMessage(chatId, {
                video: fs.readFileSync(videoPath),
                caption: "FAZ O L CARALHOOOOOOOOOO",
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: "O vídeo do FAZOL não foi encontrado 😢",
            }, { quoted: msg });
        }
    }

    if (textMessage.startsWith(marcacoesCommand)) {
        const args = textMessage.slice(11).trim().toLowerCase();
        const isAdmin = admins.includes(sender);
        
        if (args === "on") {
            if (!isAdmin) {
                await sock.sendMessage(chatId, {
                    text: `❌ Você não tem permissão para usar este comando. Somente administradores podem usar \`${marcacoesCommand} on\`.`,
                }, { quoted: msg });
                return;
            }
            mentionsController.setMentionsEnabled(true);
            await sock.sendMessage(chatId, {
                text: "✅ Marcações ativadas! Agora os usuários podem ser mencionados (respeitando suas preferências individuais).",
            }, { quoted: msg });
        } else if (args === "off") {
            if (!isAdmin) {
                await sock.sendMessage(chatId, {
                    text: `❌ Você não tem permissão para usar este comando. Somente administradores podem usar \`${marcacoesCommand} off\`.`,
                }, { quoted: msg });
                return;
            }
            mentionsController.setMentionsEnabled(false);
            await sock.sendMessage(chatId, {
                text: "❌ Marcações desativadas! Os nomes serão exibidos no lugar das menções.",
            }, { quoted: msg });
        } else {
            const status = mentionsController.getMentionsEnabled() ? "ativadas" : "desativadas";
            await sock.sendMessage(chatId, {
                text: `📋 Status das marcações: ${status}\n\nUse ${marcacoesCommand} on para ativar ou ${marcacoesCommand} off para desativar.`,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith(marcarMeCommand) || textMessage.toLowerCase().startsWith(marcarMeCommand.toLowerCase())) {
        const args = textMessage.slice(9).trim().toLowerCase();
        
        const userJid = msg.key.participantAlt || msg.key.participant || sender;
        
        if (args === "on") {
            mentionsController.setUserMentionPreference(userJid, true);
            const globalStatus = mentionsController.getMentionsEnabled() ? "ativadas" : "desativadas";
            await sock.sendMessage(chatId, {
                text: `✅ Suas marcações foram ativadas!\n\nNota: As marcações globais estão ${globalStatus}. Sua preferência será respeitada quando as marcações globais estiverem ativadas.`,
            }, { quoted: msg });
        } else if (args === "off") {
            mentionsController.setUserMentionPreference(userJid, false);
            const globalStatus = mentionsController.getMentionsEnabled() ? "ativadas" : "desativadas";
            await sock.sendMessage(chatId, {
                text: `❌ Suas marcações foram desativadas!\n\nNota: As marcações globais estão ${globalStatus}. Você não será mencionado mesmo quando as marcações globais estiverem ativadas.`,
            }, { quoted: msg });
        } else {
            const userPref = mentionsController.getUserMentionPreference(userJid) ? "ativadas" : "desativadas";
            const globalStatus = mentionsController.getMentionsEnabled() ? "ativadas" : "desativadas";
            await sock.sendMessage(chatId, {
                text: `📋 Suas marcações pessoais: ${userPref}\n📋 Marcações globais: ${globalStatus}\n\nUse ${marcarMeCommand} on para ativar ou ${marcarMeCommand} off para desativar suas marcações pessoais.`,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith(setCustomNameCommand)) {
        const args = textMessage.slice(15).trim();
        
        const userJid = msg.key.participantAlt || msg.key.participant || sender;
        
        if (!args) {
            await sock.sendMessage(chatId, {
                text: `📝 *Uso:* ${setCustomNameCommand} "nome"\n\n*Exemplo:* ${setCustomNameCommand} "João Silva"\n\nO nome deve estar entre aspas.`,
            }, { quoted: msg });
            return;
        }
        
        const match = args.match(/^["'](.+?)["']$/);
        if (!match) {
            await sock.sendMessage(chatId, {
                text: `❌ O nome deve estar entre aspas!\n\n*Exemplo:* ${setCustomNameCommand} "João Silva"`,
            }, { quoted: msg });
            return;
        }
        
        const customName = match[1].trim();
        if (customName.length === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ O nome não pode estar vazio!",
            }, { quoted: msg });
            return;
        }
        
        if (customName.length > 50) {
            await sock.sendMessage(chatId, {
                text: "❌ O nome não pode ter mais de 50 caracteres!",
            }, { quoted: msg });
            return;
        }
        
        mentionsController.setCustomName(userJid, customName);
        await sock.sendMessage(chatId, {
            text: `✅ Nome personalizado definido como: "${customName}"\n\nUse ${customNameCommand} on para ativar ou ${customNameCommand} off para desativar.`,
        }, { quoted: msg });
        return;
    }

    if (textMessage.startsWith(customNameCommand)) {
        const args = textMessage.slice(customNameCommand.length).trim().toLowerCase();
        
        const userJid = msg.key.participantAlt || msg.key.participant || sender;
        
        if (args === "on") {
            mentionsController.setCustomNameEnabled(userJid, true);
            await sock.sendMessage(chatId, {
                text: "✅ Nome personalizado ativado! Seu nome personalizado será usado quando disponível.",
            }, { quoted: msg });
        } else if (args === "off") {
            mentionsController.setCustomNameEnabled(userJid, false);
            await sock.sendMessage(chatId, {
                text: "❌ Nome personalizado desativado! Seu pushName será usado quando disponível.",
            }, { quoted: msg });
        } else {
            const usersData = mentionsController.getUsersData();
            const user = usersData[userJid];
            let customNameStatus = "desativado";
            let customNameValue = null;
            
            if (user) {
                customNameStatus = user.customNameEnabled ? "ativado" : "desativado";
                customNameValue = user.customName || null;
            }
            
            let statusMessage = `📋 Status do nome personalizado: ${customNameStatus}`;
            if (customNameValue) {
                statusMessage += `\n📝 Nome atual: "${customNameValue}"`;
            } else {
                statusMessage += `\n📝 Nenhum nome personalizado definido. Use ${setCustomNameCommand} "nome" para definir.`;
            }
            statusMessage += `\n\nUse ${customNameCommand} on para ativar ou ${customNameCommand} off para desativar.`;
            
            await sock.sendMessage(chatId, {
                text: statusMessage,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith(shipCommand)) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const inputText = textMessage.slice(shipCommand.length).trim();
        
        if (!inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, mencione dois usuários ou forneça dois nomes.\nExemplo: ${shipCommand} João e Maria ou ${shipCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        let name1 = "";
        let name2 = "";
        let mentions = [];
        let mentionIndex = 0;

        if (inputText.toLowerCase().includes(" e ")) {
            const parts = inputText.split(/ e /i);
            name1 = parts[0].trim();
            name2 = parts.slice(1).join(" e ").trim();
        } else if (inputText.includes(" ")) {
            const spaceIndex = inputText.indexOf(" ");
            name1 = inputText.slice(0, spaceIndex).trim();
            name2 = inputText.slice(spaceIndex + 1).trim();
        } else if (mentionedJid.length === 2) {
            const mentionInfo1 = mentionsController.processSingleMention(mentionedJid[0], contactsCache);
            const mentionInfo2 = mentionsController.processSingleMention(mentionedJid[1], contactsCache);
            name1 = mentionInfo1.mentionText;
            name2 = mentionInfo2.mentionText;
            mentions = [...mentionInfo1.mentions, ...mentionInfo2.mentions];
        } else if (inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes separados por 'e' ou espaço.\nExemplo: ${shipCommand} João e Maria`,
            }, { quoted: msg });
            return;
        }

        const processName = (name) => {
            const lowerName = name.toLowerCase().trim();
            if (lowerName === "eu" || lowerName === "me") {
                return "Você";
            }
            
            if (name.includes("@") && mentionedJid.length > mentionIndex) {
                const mentionInfo = mentionsController.processSingleMention(mentionedJid[mentionIndex], contactsCache);
                mentions.push(...mentionInfo.mentions);
                mentionIndex++;
                return mentionInfo.mentionText;
            }
            
            return name;
        };

        if (name1 && name2) {
            name1 = processName(name1);
            name2 = processName(name2);
        }

        if (!name1 || !name2) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes.\nExemplo: ${shipCommand} João e Maria ou ${shipCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        const percentage = Math.floor(Math.random() * 101);
        const replyText = `${name1} e ${name2} tem ${percentage}% de chance de namorarem! 👫👫👫`;

        await sock.sendMessage(chatId, {
            text: replyText,
            mentions: mentions,
        }, { quoted: msg });
    }

    if (textMessage.startsWith(hugCommand)) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const inputText = textMessage.slice(hugCommand.length).trim();
        
        if (!inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, mencione dois usuários ou forneça dois nomes.\nExemplo: ${hugCommand} João e Maria ou ${hugCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        let name1 = "";
        let name2 = "";
        let mentions = [];
        let mentionIndex = 0;

        if (inputText.toLowerCase().includes(" e ")) {
            const parts = inputText.split(/ e /i);
            name1 = parts[0].trim();
            name2 = parts.slice(1).join(" e ").trim();
        } else if (inputText.includes(" ")) {
            const spaceIndex = inputText.indexOf(" ");
            name1 = inputText.slice(0, spaceIndex).trim();
            name2 = inputText.slice(spaceIndex + 1).trim();
        } else if (mentionedJid.length === 2) {
            const mentionInfo1 = mentionsController.processSingleMention(mentionedJid[0], contactsCache);
            const mentionInfo2 = mentionsController.processSingleMention(mentionedJid[1], contactsCache);
            name1 = mentionInfo1.mentionText;
            name2 = mentionInfo2.mentionText;
            mentions = [...mentionInfo1.mentions, ...mentionInfo2.mentions];
        } else if (inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes separados por 'e' ou espaço.\nExemplo: ${hugCommand} João e Maria`,
            }, { quoted: msg });
            return;
        }

        const processName = (name) => {
            const lowerName = name.toLowerCase().trim();
            if (lowerName === "eu" || lowerName === "me") {
                return "Você";
            }
            
            if (name.includes("@") && mentionedJid.length > mentionIndex) {
                const mentionInfo = mentionsController.processSingleMention(mentionedJid[mentionIndex], contactsCache);
                mentions.push(...mentionInfo.mentions);
                mentionIndex++;
                return mentionInfo.mentionText;
            }
            
            return name;
        };

        if (name1 && name2) {
            name1 = processName(name1);
            name2 = processName(name2);
        }

        if (!name1 || !name2) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes.\nExemplo: ${hugCommand} João e Maria ou ${hugCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        const replyText = `${name1} abraçou ${name2}!!! 🫂🫂🫂`;

        await sock.sendMessage(chatId, {
            text: replyText,
            mentions: mentions,
        }, { quoted: msg });
    }

    if (textMessage.startsWith(transarCommand)) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const inputText = textMessage.slice(transarCommand.length).trim();
        
        if (!inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, mencione dois usuários ou forneça dois nomes.\nExemplo: ${transarCommand} João e Maria ou ${transarCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        let name1 = "";
        let name2 = "";
        let mentions = [];
        let mentionIndex = 0;

        if (inputText.toLowerCase().includes(" e ")) {
            const parts = inputText.split(/ e /i);
            name1 = parts[0].trim();
            name2 = parts.slice(1).join(" e ").trim();
        } else if (inputText.includes(" ")) {
            const spaceIndex = inputText.indexOf(" ");
            name1 = inputText.slice(0, spaceIndex).trim();
            name2 = inputText.slice(spaceIndex + 1).trim();
        } else if (mentionedJid.length === 2) {
            const mentionInfo1 = mentionsController.processSingleMention(mentionedJid[0], contactsCache);
            const mentionInfo2 = mentionsController.processSingleMention(mentionedJid[1], contactsCache);
            name1 = mentionInfo1.mentionText;
            name2 = mentionInfo2.mentionText;
            mentions = [...mentionInfo1.mentions, ...mentionInfo2.mentions];
        } else if (inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes separados por 'e' ou espaço.\nExemplo: ${transarCommand} João e Maria`,
            }, { quoted: msg });
            return;
        }

        const processName = (name) => {
            const lowerName = name.toLowerCase().trim();
            if (lowerName === "eu" || lowerName === "me") {
                return "Você";
            }
            
            if (name.includes("@") && mentionedJid.length > mentionIndex) {
                const mentionInfo = mentionsController.processSingleMention(mentionedJid[mentionIndex], contactsCache);
                mentions.push(...mentionInfo.mentions);
                mentionIndex++;
                return mentionInfo.mentionText;
            }
            
            return name;
        };

        if (name1 && name2) {
            name1 = processName(name1);
            name2 = processName(name2);
        }

        if (!name1 || !name2) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes.\nExemplo: ${transarCommand} João e Maria ou ${transarCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        const percentage = Math.floor(Math.random() * 101);
        const replyText = `${name1} e ${name2} tem ${percentage}% de chance de transarem! 🔥🔥🔥`;

        await sock.sendMessage(chatId, {
            text: replyText,
            mentions: mentions,
        }, { quoted: msg });
    }

    if (textMessage.startsWith(arrebentarCommand)) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const inputText = textMessage.slice(arrebentarCommand.length).trim();
        
        if (!inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, mencione dois usuários ou forneça dois nomes.\nExemplo: ${arrebentarCommand} João e Maria ou ${arrebentarCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        let name1 = "";
        let name2 = "";
        let mentions = [];
        let mentionIndex = 0;

        if (inputText.toLowerCase().includes(" e ")) {
            const parts = inputText.split(/ e /i);
            name1 = parts[0].trim();
            name2 = parts.slice(1).join(" e ").trim();
        } else if (inputText.includes(" ")) {
            const spaceIndex = inputText.indexOf(" ");
            name1 = inputText.slice(0, spaceIndex).trim();
            name2 = inputText.slice(spaceIndex + 1).trim();
        } else if (mentionedJid.length === 2) {
            const mentionInfo1 = mentionsController.processSingleMention(mentionedJid[0], contactsCache);
            const mentionInfo2 = mentionsController.processSingleMention(mentionedJid[1], contactsCache);
            name1 = mentionInfo1.mentionText;
            name2 = mentionInfo2.mentionText;
            mentions = [...mentionInfo1.mentions, ...mentionInfo2.mentions];
        } else if (inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes separados por 'e' ou espaço.\nExemplo: ${arrebentarCommand} João e Maria`,
            }, { quoted: msg });
            return;
        }

        const processName = (name) => {
            const lowerName = name.toLowerCase().trim();
            if (lowerName === "eu" || lowerName === "me") {
                return "Você";
            }
            
            if (name.includes("@") && mentionedJid.length > mentionIndex) {
                const mentionInfo = mentionsController.processSingleMention(mentionedJid[mentionIndex], contactsCache);
                mentions.push(...mentionInfo.mentions);
                mentionIndex++;
                return mentionInfo.mentionText;
            }
            
            return name;
        };

        if (name1 && name2) {
            name1 = processName(name1);
            name2 = processName(name2);
        }

        if (!name1 || !name2) {
            await sock.sendMessage(chatId, {
                text: `Por favor, forneça dois nomes.\nExemplo: ${arrebentarCommand} João e Maria ou ${arrebentarCommand} eu e Maria`,
            }, { quoted: msg });
            return;
        }

        const percentage = Math.floor(Math.random() * 101);
        const replyText = `${name1} tem ${percentage}% de chance de arrebentar ${name2}! 💥💥💥`;

        await sock.sendMessage(chatId, {
            text: replyText,
            mentions: mentions,
        }, { quoted: msg });
    }

    if (textMessage.startsWith(vumvumCommand)) {
        const audioPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'vumvum.mp3');

        if (fs.existsSync(audioPath)) {
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(audioPath),
		mimetype: 'audio/mp4',
                fileName: 'vumvum.mp3',
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: "❌ O áudio do VUMVUM não foi encontrado 😢",
            }, { quoted: msg });
        }
    }

    // ===== Comandos de foto de perfil (pfp) =====

    if (textMessage.toLowerCase() === pfpCommand.toLowerCase() || textMessage.toLowerCase().startsWith(`${pfpCommand.toLowerCase()} `)) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpCommand} @usuario ou ${pfpCommand} me\n\n*Exemplos:*\n• ${pfpCommand} @usuario - Foto de outro usuário\n• ${pfpCommand} me - Sua própria foto\n• ${pfpCommand} - Sua própria foto`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: `📸 Foto de perfil de ${mentionInfo.mentionText}\n\n✅ Carregada do cache\n🕐 Última atualização: ${user.profilePictureUpdatedAt ? new Date(user.profilePictureUpdatedAt).toLocaleString('pt-BR') : 'N/A'}`,
                    mentions: mentionInfo.mentions
                }, { quoted: msg });
                return;
            }

            const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

            if (!profilePictureUrl) {
                await sock.sendMessage(chatId, {
                    text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                }, { quoted: msg });
                return;
            }

            const base64Image = await downloadImageAsBase64(profilePictureUrl);
            const base64Data = base64Image.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');

            if (key) {
                usersData[key].profilePicture = base64Image;
                usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                saveUsersData(usersData);
            }

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `📸 Foto de perfil de ${mentionInfo.mentionText}\n\n🔄 Buscada do WhatsApp`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao buscar foto de perfil:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao buscar foto de perfil: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith(pfpDeadCommand.toLowerCase())) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpDeadCommand} @usuario ou ${pfpDeadCommand} me\n\n*Exemplos:*\n• ${pfpDeadCommand} @usuario - Foto de outro usuário\n• ${pfpDeadCommand} me - Sua própria foto\n• ${pfpDeadCommand} - Sua própria foto`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let imageBuffer = null;
            
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

                if (!profilePictureUrl) {
                    await sock.sendMessage(chatId, {
                        text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                    }, { quoted: msg });
                    return;
                }

                const base64Image = await downloadImageAsBase64(profilePictureUrl);
                const base64Data = base64Image.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');

                if (key) {
                    usersData[key].profilePicture = base64Image;
                    usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                    saveUsersData(usersData);
                }
            }

            const grayscaleBuffer = await applyGrayscaleFilter(imageBuffer);

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: grayscaleBuffer,
                caption: `🪦 ${mentionInfo.mentionText} ⚰️`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao processar pfpdead:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao processar imagem: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith(pfpGayCommand.toLowerCase())) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpGayCommand} @usuario ou ${pfpGayCommand} me\n\n*Exemplos:*\n• ${pfpGayCommand} @usuario - Foto de outro usuário\n• ${pfpGayCommand} me - Sua própria foto\n• ${pfpGayCommand} - Sua própria foto`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let imageBuffer = null;
            
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

                if (!profilePictureUrl) {
                    await sock.sendMessage(chatId, {
                        text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                    }, { quoted: msg });
                    return;
                }

                const base64Image = await downloadImageAsBase64(profilePictureUrl);
                const base64Data = base64Image.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');

                if (key) {
                    usersData[key].profilePicture = base64Image;
                    usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                    saveUsersData(usersData);
                }
            }

            const lgbtBuffer = await applyLGBTFilter(imageBuffer);

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: lgbtBuffer,
                caption: `🌈 ${mentionInfo.mentionText} 🏳️‍🌈`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao processar pfpgay:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao processar imagem: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase() === pfpBolsonaroCommand.toLowerCase() || textMessage.toLowerCase().startsWith(`${pfpBolsonaroCommand.toLowerCase()} `)) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpBolsonaroCommand} @usuario ou ${pfpBolsonaroCommand} me\n\n*Exemplos:*\n• ${pfpBolsonaroCommand} @usuario - Foto de outro usuário\n• ${pfpBolsonaroCommand} me - Sua própria foto\n• ${pfpBolsonaroCommand} - Sua própria foto`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let imageBuffer = null;
            
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

                if (!profilePictureUrl) {
                    await sock.sendMessage(chatId, {
                        text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                    }, { quoted: msg });
                    return;
                }

                const base64Image = await downloadImageAsBase64(profilePictureUrl);
                const base64Data = base64Image.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');

                if (key) {
                    usersData[key].profilePicture = base64Image;
                    usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                    saveUsersData(usersData);
                }
            }

            const bolsonaroBuffer = await applyBolsonaroFilter(imageBuffer);

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: bolsonaroBuffer,
                caption: `🇧🇷 ${mentionInfo.mentionText} 2026`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao processar pfpbolsonaro:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao processar imagem: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith(pfpBolsonaro2Command.toLowerCase())) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpBolsonaro2Command} @usuario ou ${pfpBolsonaro2Command} me\n\n*Exemplos:*\n• ${pfpBolsonaro2Command} @usuario\n• ${pfpBolsonaro2Command} me\n• ${pfpBolsonaro2Command}`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let imageBuffer = null;
            
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

                if (!profilePictureUrl) {
                    await sock.sendMessage(chatId, {
                        text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                    }, { quoted: msg });
                    return;
                }

                const base64Image = await downloadImageAsBase64(profilePictureUrl);
                const base64Data = base64Image.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');

                if (key) {
                    usersData[key].profilePicture = base64Image;
                    usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                    saveUsersData(usersData);
                }
            }

            const bolsonaro2Buffer = await applyBolsonaro2Filter(imageBuffer);

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: bolsonaro2Buffer,
                caption: `🇧🇷 ${mentionInfo.mentionText} COM BOLSONARO`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao processar pfpbolsonaro2:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao processar imagem: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith(pfpBolsonaro3Command.toLowerCase())) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `📝 *Uso:* ${pfpBolsonaro3Command} @usuario ou ${pfpBolsonaro3Command} me\n\n*Exemplos:*\n• ${pfpBolsonaro3Command} @usuario\n• ${pfpBolsonaro3Command} me\n• ${pfpBolsonaro3Command}`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let imageBuffer = null;
            
            let usersData = loadUsersData();
            const { key, user } = findUserByJid(usersData, targetUserId);

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

                if (!profilePictureUrl) {
                    await sock.sendMessage(chatId, {
                        text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                    }, { quoted: msg });
                    return;
                }

                const base64Image = await downloadImageAsBase64(profilePictureUrl);
                const base64Data = base64Image.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');

                if (key) {
                    usersData[key].profilePicture = base64Image;
                    usersData[key].profilePictureUpdatedAt = new Date().toISOString();
                    saveUsersData(usersData);
                }
            }

            const framedBuffer = await applyBolsonaro3Filter(imageBuffer);

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: framedBuffer,
                caption: `🟢 ${mentionInfo.mentionText} DEUS, PÁTRIA, FAMÍLIA, LIBERDADE 🟡`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao processar pfpbolsonaro3:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao processar imagem: ${error.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.startsWith(rankingGayCommand)) {
        if (!isGroup) {
            await sock.sendMessage(chatId, {
                text: "❌ Este comando só funciona em grupos!",
            }, { quoted: msg });
            return;
        }

        try {
            console.log('========== DEBUG !rankingGay ==========');
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];
            
            console.log(`[DEBUG] Total de participantes no grupo: ${participants.length}`);
            console.log('[DEBUG] Todos os participantes:');
            participants.forEach((p, index) => {
                console.log(`  ${index + 1}. ${p.id} (admin: ${p.admin || false})`);
            });
            
            if (participants.length < 3) {
                await sock.sendMessage(chatId, {
                    text: "❌ O grupo precisa ter pelo menos 3 membros para fazer o ranking!",
                }, { quoted: msg });
                return;
            }

            let botJids = [];
            try {
                if (sock.user?.id) {
                    const botId = sock.user.id;
                    const botNumber = botId.split(":")[0];
                    if (botNumber) {
                        botJids.push(botNumber + "@s.whatsapp.net");
                        botJids.push(botNumber + "@c.us");
                    }
                    if (botId.includes("@")) {
                        botJids.push(botId);
                    }
                }
                if (sock.user?.jid) {
                    botJids.push(sock.user.jid);
                }
                console.log(`[DEBUG] Bot JIDs identificados: ${JSON.stringify(botJids)}`);
            } catch (error) {
                console.error('Erro ao obter botNumber:', error);
            }
            
            const validParticipants = participants
                .map(p => p.id)
                .filter(jid => {
                    if (jid.includes('@g.us')) {
                        console.log(`[DEBUG] Filtrado (é grupo): ${jid}`);
                        return false;
                    }
                    const isBot = botJids.some(botJid => {
                        if (jid === botJid) return true;
                        const jidNumber = jid.split("@")[0].split(":")[0];
                        const botNumber = botJid.split("@")[0].split(":")[0];
                        if (jidNumber === botNumber) return true;
                        return false;
                    });
                    if (isBot) {
                        console.log(`[DEBUG] Filtrado (é o bot): ${jid}`);
                        return false;
                    }
                    return true;
                });

            console.log(`[DEBUG] Participantes válidos após filtrar: ${validParticipants.length}`);
            console.log('[DEBUG] Lista de participantes válidos:');
            validParticipants.forEach((jid, index) => {
                console.log(`  ${index + 1}. ${jid}`);
            });

            if (validParticipants.length < 3) {
                await sock.sendMessage(chatId, {
                    text: "❌ Não há participantes suficientes para fazer o ranking!",
                }, { quoted: msg });
                return;
            }

            const shuffled = [...validParticipants].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 3);
            
            console.log('[DEBUG] 3 participantes selecionados aleatoriamente:');
            selected.forEach((jid, index) => {
                console.log(`  ${index + 1}. ${jid}`);
            });
            console.log('========================================');

            const messages = [
                process.env.RANKING_GAY_MESSAGE_1,
                process.env.RANKING_GAY_MESSAGE_2,
                process.env.RANKING_GAY_MESSAGE_3
            ];

            for (let i = 0; i < selected.length; i++) {
                const userJid = selected[i];
                const mentionInfo = mentionsController.processSingleMention(userJid, contactsCache);
                
                console.log(`[DEBUG] Enviando mensagem ${i + 1} para: ${userJid} (${mentionInfo.mentionText})`);
                
                await sock.sendMessage(chatId, {
                    text: `${mentionInfo.mentionText}! ${messages[i]}`,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.error('Erro ao executar !rankingGay:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao gerar o ranking. Tente novamente!",
            }, { quoted: msg });
        }
    }

}

module.exports = jokesCommandsBot;
