const path = require('path');
const fs = require('fs');

async function jokesCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

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
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            let percentage = getRandomPercentage();
            let replyText;
            
            if (isPedraoNumber(userToMention) && textMessage.startsWith("!leitada")) {
                percentage = 100;
                replyText = `@${userToMention.split('@')[0]} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                
                const stickerPath = path.resolve(__dirname, 'assets', 'pedrao_sticker.webp');
                if (fs.existsSync(stickerPath)) {
                    await sock.sendMessage(sender, {
                        sticker: fs.readFileSync(stickerPath),
                    }, { quoted: msg });
                }
            } else if (textMessage.startsWith("!leitada")){
                replyText = `@${userToMention.split('@')[0]} levou ${percentage}% ${customText}! ${emoji}`;
            } else {
                replyText = `@${userToMention.split('@')[0]} é ${percentage}% ${customText}! ${emoji}`;
            }

            await sock.sendMessage(sender, {
                text: replyText,
                mentions: [userToMention],
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(command.length).trim();


            if (isSelfReference(nameArgument)) {
                let percentage = getRandomPercentage();
                let replyText;
                if (textMessage.startsWith("!leitada")){
                    replyText = `Você levou ${percentage}% ${customText}! ${emoji}`;
                } else {
                    replyText = `Você é ${percentage}% ${customText}! ${emoji}`;
                }

                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [sender],
                }, { quoted: msg });
            } else if (nameArgument) {
                let percentage = getRandomPercentage();
                let replyText;
                
                if (isPedraoVariation(nameArgument) && textMessage.startsWith("!leitada")) {
                    percentage = 100;
                    replyText = `${nameArgument} levou ${percentage}% ${customText}! ${emoji} KKKKKKKKKKK`;
                    
                    const stickerPath = path.resolve(__dirname, 'assets', 'pedrao_sticker.webp');
                    if (fs.existsSync(stickerPath)) {
                        await sock.sendMessage(sender, {
                            sticker: fs.readFileSync(stickerPath),
                        }, { quoted: msg });
                    }
                } else if (textMessage.startsWith("!leitada")){
                    replyText = `${nameArgument} levou ${percentage}% ${customText}! ${emoji}`;
                } else {
                    replyText = `${nameArgument} é ${percentage}% ${customText}! ${emoji}`;
                }

                await sock.sendMessage(sender, {
                    text: replyText,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
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
        const stickerPath = path.resolve(__dirname, 'assets', 'pedrao_sticker.webp');
        
        if (fs.existsSync(stickerPath)) {
            await sock.sendMessage(sender, {
                sticker: fs.readFileSync(stickerPath),
            }, { quoted: msg });
        }
        
        await sock.sendMessage(sender, {
            text: "O PERDÃO JÁ LEVOU 100% DA LEITADA KKKKKKKKKKKKKKKKK",
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!fazol") || textMessage.startsWith("!FAZOL")) {
        const videoPath = path.resolve(__dirname, 'assets', 'MarioFazOL.mp4');

        if (fs.existsSync(videoPath)) {
            await sock.sendMessage(sender, {
                video: fs.readFileSync(videoPath),
                caption: "FAZ O L CARALHOOOOOOOOOO",
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: "O vídeo do FAZOL não foi encontrado 😢",
            }, { quoted: msg });
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

            } else if (nameArgument && nameArgument2 && mentionedJid?.length === 1) {
                const userMentioned = mentionedJid[0];
                const percentage = Math.floor(Math.random() * 101);

                const isFirstMention = nameArgument.includes("@");
                const replyText = isFirstMention
                    ? `@${userMentioned.split('@')[0]} e ${nameArgument2} tem ${percentage}% de chance de namorarem! 👫👫👫`
                    : `${nameArgument} e @${userMentioned.split('@')[0]} tem ${percentage}% de chance de namorarem! 👫👫👫`;

                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [userMentioned],
                }, { quoted: msg });

            } else if (nameArgument && nameArgument2) {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `${nameArgument} e ${nameArgument2} tem ${percentage}% de chance de namorarem! 👫👫👫`;

                await sock.sendMessage(sender, {
                    text: replyText,
                }, { quoted: msg });

            } else {
                await sock.sendMessage(sender, {
                    text: "Por favor, mencione dois usuários ou forneça dois nomes com o comando !ship nome1 nome2.",
                }, { quoted: msg });
            }
        }
    }

}

module.exports = jokesCommandsBot;
