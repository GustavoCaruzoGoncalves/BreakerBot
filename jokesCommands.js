const path = require('path');
const fs = require('fs');

async function jokesCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

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
            } else if (nameArgument == ! "eu" || nameArgument == ! "me" || nameArgument == ! "eu me" || nameArgument == ! "me eu") {
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

    if (textMessage.startsWith("!petista")) {
        console.log("[DEBUG] Comando !petista detectado");

        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const percentage = Math.floor(Math.random() * 101);
            const replyText = `@${userToMention.split('@')[0]} é ${percentage}% petista! 🚩🚩🚩`;

            await sock.sendMessage(sender, {
                text: replyText,
                mentions: [userToMention],
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(5).trim().toLowerCase();

            if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `Você é ${percentage}% petista! 🚩🚩🚩`;

                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [sender],
                }, { quoted: msg });
            } else if (nameArgument == ! "eu" || nameArgument == ! "me" || nameArgument == ! "eu me" || nameArgument == ! "me eu") {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `${nameArgument} você é ${percentage}% petista! 🚩🚩🚩`;

                await sock.sendMessage(sender, {
                    text: replyText,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: "Por favor, mencione um usuário ou forneça um nome com o comando !petista nome.",
                }, { quoted: msg });
            }
        }
    }

    if (textMessage.startsWith("!bolsonarista")) {
        console.log("[DEBUG] Comando !petista detectado");

        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

        if (mentionedJid && mentionedJid.length > 0) {
            const userToMention = mentionedJid[0];
            const percentage = Math.floor(Math.random() * 101);
            const replyText = `@${userToMention.split('@')[0]} é ${percentage}% bolsonarista! 🇧🇷🇧🇷🇧🇷`;

            await sock.sendMessage(sender, {
                text: replyText,
                mentions: [userToMention],
            }, { quoted: msg });
        } else {
            const nameArgument = textMessage.slice(5).trim().toLowerCase();

            if (nameArgument === "eu" || nameArgument === "me" || nameArgument === "eu me" || nameArgument === "me eu") {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `Você é ${percentage}% bolsonarista! 🇧🇷🇧🇷🇧🇷`;

                await sock.sendMessage(sender, {
                    text: replyText,
                    mentions: [sender],
                }, { quoted: msg });
            } else if (nameArgument == ! "eu" || nameArgument == ! "me" || nameArgument == ! "eu me" || nameArgument == ! "me eu") {
                const percentage = Math.floor(Math.random() * 101);
                const replyText = `${nameArgument} você é ${percentage}% bolsonarista! 🇧🇷🇧🇷🇧🇷`;

                await sock.sendMessage(sender, {
                    text: replyText,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: "Por favor, mencione um usuário ou forneça um nome com o comando !bolsonarista nome.",
                }, { quoted: msg });
            }
        }
    }

    if (textMessage.startsWith("!FAZOL")) {
        console.log("[DEBUG] Comando !FAZOL detectado");

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text && text.length > 0) {
            const mediaPath = path.join(
                'assets',
                'MarioFazOL.mp4'
            );

            if (!fs.existsSync(mediaPath)) {
                console.log("[ERRO] Arquivo de mídia não encontrado.");
                await sock.sendMessage(sender, { text: "Erro: vídeo não encontrado!" }, { quoted: msg });
                return;
            }

            const stickerBuffer = fs.readFileSync(mediaPath);

            const replyText = "FAZ O L CARALHOOOOOOOOOO";

            await sock.sendMessage(sender, {
                video: stickerBuffer,
                caption: replyText,
                mimetype: 'video/mp4'
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
}

module.exports = jokesCommandsBot;
