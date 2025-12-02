const path = require('path');
const fs = require('fs');
const mentionsController = require('../../controllers/mentionsController');
const { admins } = require('../../config/adm');

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
            
            if (isPedraoNumber(userToMention) && textMessage.startsWith("!leitada")) {
                percentage = 100;
                replyText = `${mentionInfo.mentionText} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                
                const stickerPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'pedrao_sticker.webp');
                if (fs.existsSync(stickerPath)) {
                    await sock.sendMessage(chatId, {
                        sticker: fs.readFileSync(stickerPath),
                    }, { quoted: msg });
                }
            } else if (textMessage.startsWith("!leitada")){
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
                
                if (textMessage.startsWith("!leitada")){
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
                
                if (isPedraoVariation(nameArgument) && textMessage.startsWith("!leitada")) {
                    percentage = 100;
                    replyText = `${nameArgument} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                    
                    const stickerPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'pedrao_sticker.webp');
                    if (fs.existsSync(stickerPath)) {
                        await sock.sendMessage(chatId, {
                            sticker: fs.readFileSync(stickerPath),
                        }, { quoted: msg });
                    }
                } else if (textMessage.startsWith("!leitada")){
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

    if (textMessage.startsWith("!gay")) {
        await handleCommand({
            command: "!gay",
            emoji: "🏳‍🌈🏳‍🌈🏳‍🌈",
            customText: "gay"
        });
    }

    if (textMessage.startsWith("!corno")) {
        await handleCommand({
            command: "!corno",
            emoji: "🐂🐂🐂",
            customText: "corno"
        });
    }

    if (textMessage.startsWith("!hetero")) {
        await handleCommand({
            command: "!hetero",
            emoji: "🩲",
            customText: "hétero"
        });
    }

    if (textMessage.startsWith("!chato")) {
        await handleCommand({
            command: "!chato",
            emoji: "😡",
            customText: "chato"
        });
    }

    if (textMessage.startsWith("!petista")) {
        await handleCommand({
            command: "!petista",
            emoji: "🚩🚩🚩",
            customText: "petista"
        });
    }

    if (textMessage.startsWith("!bolsonarista")) {
        await handleCommand({
            command: "!bolsonarista",
            emoji: "🇧🇷🇧🇷🇧🇷",
            customText: "bolsonarista"
        });
    }

    if (textMessage.startsWith("!leitada")) {
        await handleCommand({
            command: "!leitada",
            emoji: "🥛🥛🥛",
            customText: "de leitada"
        });
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

    if (textMessage.startsWith("!fazol") || textMessage.startsWith("!FAZOL")) {
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

    if (textMessage.startsWith("!marcacoes")) {
        const args = textMessage.slice(11).trim().toLowerCase();
        const isAdmin = admins.includes(sender);
        
        if (args === "on") {
            if (!isAdmin) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você não tem permissão para usar este comando. Somente administradores podem usar `!marcacoes on`.",
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
                    text: "❌ Você não tem permissão para usar este comando. Somente administradores podem usar `!marcacoes off`.",
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
                text: `📋 Status das marcações: ${status}\n\nUse !marcacoes on para ativar ou !marcacoes off para desativar.`,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith("!marcarMe") || textMessage.startsWith("!marcarme")) {
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
                text: `📋 Suas marcações pessoais: ${userPref}\n📋 Marcações globais: ${globalStatus}\n\nUse !marcarMe on para ativar ou !marcarMe off para desativar suas marcações pessoais.`,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith("!setCustomName")) {
        const args = textMessage.slice(15).trim();
        
        const userJid = msg.key.participantAlt || msg.key.participant || sender;
        
        if (!args) {
            await sock.sendMessage(chatId, {
                text: "📝 *Uso:* !setCustomName \"nome\"\n\n*Exemplo:* !setCustomName \"João Silva\"\n\nO nome deve estar entre aspas.",
            }, { quoted: msg });
            return;
        }
        
        const match = args.match(/^["'](.+?)["']$/);
        if (!match) {
            await sock.sendMessage(chatId, {
                text: "❌ O nome deve estar entre aspas!\n\n*Exemplo:* !setCustomName \"João Silva\"",
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
            text: `✅ Nome personalizado definido como: "${customName}"\n\nUse !customName on para ativar ou !customName off para desativar.`,
        }, { quoted: msg });
        return;
    }

    if (textMessage.startsWith("!customName")) {
        const args = textMessage.slice(12).trim().toLowerCase();
        
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
                statusMessage += `\n📝 Nenhum nome personalizado definido. Use !setCustomName "nome" para definir.`;
            }
            statusMessage += `\n\nUse !customName on para ativar ou !customName off para desativar.`;
            
            await sock.sendMessage(chatId, {
                text: statusMessage,
            }, { quoted: msg });
        }
        return;
    }

    if (textMessage.startsWith("!ship")) {
        console.log("[DEBUG] Comando !ship detectado");
        console.log('========== LOG DE MENÇÃO (!ship) ==========');
        console.log('[DEBUG] Mensagem completa (msg):', JSON.stringify(msg, null, 2));
        console.log('[DEBUG] msg.key:', JSON.stringify(msg.key, null, 2));
        console.log('[DEBUG] msg.message:', JSON.stringify(msg.message, null, 2));
        console.log('[DEBUG] msg.message.extendedTextMessage:', JSON.stringify(msg.message.extendedTextMessage, null, 2));
        console.log('[DEBUG] contextInfo:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo, null, 2));
        console.log('[DEBUG] mentionedJid:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo?.mentionedJid, null, 2));
        console.log('[DEBUG] participantAlt:', msg.key.participantAlt);
        console.log('[DEBUG] participant:', msg.key.participant);
        console.log('[DEBUG] sender:', sender);
        console.log('===========================================');

        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length === 2) {
            const userToMention1 = mentionedJid[0];
            const userToMention2 = mentionedJid[1];
            const mentionInfo1 = mentionsController.processSingleMention(userToMention1, contactsCache);
            const mentionInfo2 = mentionsController.processSingleMention(userToMention2, contactsCache);
            
            const mentions = [...mentionInfo1.mentions, ...mentionInfo2.mentions];
            const percentage = Math.floor(Math.random() * 101);
            let replyText = `${mentionInfo1.mentionText} e ${mentionInfo2.mentionText} tem ${percentage}% de chance de namorarem! 👫👫👫`;
            
            if ((!mentionInfo1.hasName && !mentionInfo1.canMention) || (!mentionInfo2.hasName && !mentionInfo2.canMention)) {
                replyText += `\n\n💡 Dica: os usuários precisam enviar alguma mensagem para que seus nomes apareçam quando as menções estão desativadas, ou podem adicionar um nome personalizado para que assim possam ser chamados`;
            }

            await sock.sendMessage(chatId, {
                text: replyText,
                mentions: mentions,
            }, { quoted: msg });

        } else {
            const args = textMessage.slice(5).trim().split(" ");
            const nameArgument = args[0];
            const nameArgument2 = args.slice(1).join(" ");

            if ((nameArgument.toLowerCase() === "eu" || nameArgument.toLowerCase() === "me") && !nameArgument2) {
                const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
                
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `Você e ${mentionInfo.mentionText} tem ${percentage}% de chance de namorarem! 👫👫👫`;

                await sock.sendMessage(chatId, {
                    text: replyText,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });

            } else if (nameArgument && nameArgument2 && mentionedJid?.length === 1) {
                const userMentioned = mentionedJid[0];
                const mentionInfo = mentionsController.processSingleMention(userMentioned, contactsCache);
                const percentage = Math.floor(Math.random() * 101);

                const isFirstMention = nameArgument.includes("@");
                const replyText = isFirstMention
                    ? `${mentionInfo.mentionText} e ${nameArgument2} tem ${percentage}% de chance de namorarem! 👫👫👫`
                    : `${nameArgument} e ${mentionInfo.mentionText} tem ${percentage}% de chance de namorarem! 👫👫👫`;

                await sock.sendMessage(chatId, {
                    text: replyText,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });

            } else if (nameArgument && nameArgument2) {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `${nameArgument} e ${nameArgument2} tem ${percentage}% de chance de namorarem! 👫👫👫`;

                await sock.sendMessage(chatId, {
                    text: replyText,
                }, { quoted: msg });

            } else {
                await sock.sendMessage(chatId, {
                    text: "Por favor, mencione dois usuários ou forneça dois nomes com o comando !ship nome1 nome2.",
                }, { quoted: msg });
            }
        }
    }

}

module.exports = jokesCommandsBot;
