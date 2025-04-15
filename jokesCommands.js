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

    async function handleCommand({ command, emoji, customText }) {
        console.log(`[DEBUG] Comando ${command} detectado`);
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const percentage = getRandomPercentage();
            const replyText = `@${userToMention.split('@')[0]} é ${percentage}% ${customText}! ${emoji}`;

            await sock.sendMessage(sender, {
                text: replyText,
                mentions: [userToMention],
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(command.length).trim();


            if (isSelfReference(nameArgument)) {
                const percentage = getRandomPercentage();
                const replyText = `Você é ${percentage}% ${customText}! ${emoji}`;

                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [sender],
                }, { quoted: msg });
            } else if (nameArgument) {
                const percentage = getRandomPercentage();
                const replyText = `${nameArgument} é ${percentage}% ${customText}! ${emoji}`;

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
