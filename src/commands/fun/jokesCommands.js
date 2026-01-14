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

//    const poopNumber = process.env.IGOR_NUMBER;
//    console.log(`[DEBUG COCÔ] Sender: ${sender}`);
//    console.log(`[DEBUG COCÔ] Esperado: ${poopNumber}@s.whatsapp.net`);
//    console.log(`[DEBUG COCÔ] Match: ${sender === poopNumber + "@s.whatsapp.net"}`);
//    console.log(`[DEBUG COCÔ] Sender includes: ${sender.includes(poopNumber)}`);
//
//    if (sender.includes(poopNumber)) {
//        try {
//            await sock.sendMessage(chatId, {
//                react: {
//                    text: "💩",
//                    key: msg.key
//                }
//            });
//            console.log(`[DEBUG COCO] Reação enviada com sucesso!`);
//        } catch (err) {
//            console.error(`[DEBUG COCO] Erro ao enviar reação:`, err);
//        }
//    }

    const heartNumber = process.env.JOAO_NUMBER;
    console.log(`[DEBUG CORAÇÃO] Sender: ${sender}`);
    console.log(`[DEBUG CORAÇÃO] Esperado: ${heartNumber}@s.whatsapp.net`);
    console.log(`[DEBUG CORAÇÃO] Match: ${sender === heartNumber + "@s.whatsapp.net"}`);
    console.log(`[DEBUG CORAÇÃO] Sender includes: ${sender.includes(heartNumber)}`);

    if (sender.includes(heartNumber)) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "❤️",
                    key: msg.key
                }
            });
            console.log(`[DEBUG CORAÇÃO] Reação enviada com sucesso!`);
        } catch (err) {
            console.error(`[DEBUG CORAÇÃO] Erro ao enviar reação:`, err);
        }
    }

    const tomateNumber = process.env.DUDA_NUMBER;
    console.log(`[DEBUG TOMATE] Sender: ${sender}`);
    console.log(`[DEBUG TOMATE] Esperado: ${tomateNumber}@s.whatsapp.net`);
    console.log(`[DEBUG TOMATE] Match: ${sender === tomateNumber + "@s.whatsapp.net"}`);
    console.log(`[DEBUG TOMATE] Sender includes: ${sender.includes(tomateNumber)}`);

    if (sender.includes(tomateNumber)) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "🐈",
                    key: msg.key
                }
            });
            console.log(`[DEBUG TOMATE] Reação enviada com sucesso!`);
        } catch (err) {
            console.error(`[DEBUG TOMATE] Erro ao enviar reação:`, err);
        }
    }

    const jegueNumber = process.env.BRUNO_NUMBER;
    console.log(`[DEBUG JEGUE] Sender: ${sender}`);
    console.log(`[DEBUG JEGUE] Esperado: ${jegueNumber}@s.whatsapp.net`);
    console.log(`[DEBUG JEGUE] Match: ${sender === jegueNumber + "@s.whatsapp.net"}`);
    console.log(`[DEBUG JEGUE] Sender includes: ${sender.includes(jegueNumber)}`);
    
    if (sender.includes(jegueNumber)) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "🫏",
                    key: msg.key
                }
            });
            console.log(`[DEBUG JEGUE] Reação enviada com sucesso!`);
        } catch (err) {
            console.error(`[DEBUG JEGUE] Erro ao enviar reação:`, err);
        }
    }

    const fogoNumber = process.env.SYNISTER_NUMBER;
    console.log(`[DEBUG FOGO] Sender: ${sender}`);
    console.log(`[DEBUG FOGO] Esperado: ${fogoNumber}@s.whatsapp.net`);
    console.log(`[DEBUG FOGO] Match: ${sender === fogoNumber + "@s.whatsapp.net"}`);
    console.log(`[DEBUG FOGO] Sender includes: ${sender.includes(fogoNumber)}`);

    if (sender.includes(fogoNumber)) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "🔥",
                    key: msg.key
                }
            });
            console.log(`[DEBUG FOGO] Reação enviada com sucesso!`);
        } catch (err) {
            console.error(`[DEBUG FOGO] Erro ao enviar reação:`, err);
        }
    }

    const hedgehogNumber = process.env.FULVIO_NUMBER;
    console.log(`[DEBUG HEDGEHOG] Sender: ${sender}`);
    console.log(`[DEBUG HEDGEHOG] Esperado: ${hedgehogNumber}@s.whatsapp.net`);
    console.log(`[DEBUG HEDGEHOG] Match: ${sender === hedgehogNumber + "@s.whatsapp.net"}`);
    console.log(`[DEBUG HEDGEHOG] Sender includes: ${sender.includes(hedgehogNumber)}`);

    if (sender.includes(hedgehogNumber)) {
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "🦔",
                    key: msg.key
                }
            });
            console.log(`[DEBUG HEDGEHOG] Reação enviada com sucesso!`);
        } catch (err) {
            console.error(`[DEBUG HEDGEHOG] Erro ao enviar reação:`, err);
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

    if (textMessage.startsWith("!burro")) {
        await handleCommand({
            command: "!burro",
            emoji: "🫏🫏🫏",
            customText: "burro"
        });
    }

    if (textMessage.startsWith("!pinto")) {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
        const isSpecial = Math.random() < 0.01;
        
        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const mentionInfo = mentionsController.processSingleMention(userToMention, contactsCache);
            let replyText;
            
            if (isSpecial) {
                replyText = `${mentionInfo.mentionText}! ${process.env.PINTO_MESSAGE}`;
            } else {
                const size = (Math.random() * 39.9 + 0.1).toFixed(1);
                replyText = `${mentionInfo.mentionText} tem ${size}cm de pinto! 🍆`;
            }
            
            if (!mentionInfo.hasName && !mentionInfo.canMention) {
                replyText += `\n\n💡 Dica: os usuários precisam enviar alguma mensagem para que seus nomes apareçam quando as menções estão desativadas, ou podem adicionar um nome personalizado para que assim possam ser chamados`;
            }

            await sock.sendMessage(chatId, {
                text: replyText,
                mentions: mentionInfo.mentions,
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(6).trim();

            if (isSelfReference(nameArgument)) {
                const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
                let replyText;
                
                if (isSpecial) {
                    replyText = `${mentionInfo.mentionText}! ${process.env.PINTO_MESSAGE || 'Caralho, esse aí cruzou de São Paulo ao Paraguai! Puta rola grande! 😂😂😂'}`;
                } else {
                    const size = (Math.random() * 39.9 + 0.1).toFixed(1); // 0.1 a 40.0cm
                    replyText = `${mentionInfo.mentionText} tem ${size}cm de pinto! 🍆`;
                }

                if (!mentionInfo.hasName && !mentionInfo.canMention) {
                    replyText += `\n\n💡 Dica: os usuários precisam enviar alguma mensagem para que seus nomes apareçam quando as menções estão desativadas, ou podem adicionar um nome personalizado para que assim possam ser chamados`;
                }

                await sock.sendMessage(chatId, {
                    text: replyText,
                    mentions: mentionInfo.mentions,
                }, { quoted: msg });
            } else if (nameArgument) {
                let replyText;
                
                if (isSpecial) {
                    replyText = `${nameArgument}! ${process.env.PINTO_MESSAGE}`;
                } else {
                    const size = (Math.random() * 39.9 + 0.1).toFixed(1); // 0.1 a 40.0cm
                    replyText = `${nameArgument} tem ${size}cm de pinto! 🍆`;
                }

                await sock.sendMessage(chatId, {
                    text: replyText,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, {
                    text: `Por favor, mencione um usuário ou forneça um nome com o comando !pinto nome.`,
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
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const inputText = textMessage.slice(5).trim();
        
        if (!inputText && mentionedJid.length === 0) {
            await sock.sendMessage(chatId, {
                text: "Por favor, mencione dois usuários ou forneça dois nomes.\nExemplo: !ship João e Maria ou !ship eu e Maria",
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
                text: "Por favor, forneça dois nomes separados por 'e' ou espaço.\nExemplo: !ship João e Maria",
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
                text: "Por favor, forneça dois nomes.\nExemplo: !ship João e Maria ou !ship eu e Maria",
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

    if (textMessage.startsWith("!vumvum")) {
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

    if (textMessage.startsWith("!rankingGay")) {
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
