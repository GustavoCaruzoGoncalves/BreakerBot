const path = require('path');
const fs = require('fs');
const { admins } = require('../../config/adm');
const { PREFIX } = require('../../config/prefix');
const features = require('../../config/features');

async function sendJsCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    if (!features.utility?.sendJs?.enabled) return;

    const chatId = msg.key.remoteJid;
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
    
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe) return;

    const jsCommand = `${PREFIX}js`;
    const sendJsonCommand = `${PREFIX}sendJson`;

    if (textMessage.startsWith(jsCommand)) {
        console.log(`[DEBUG] Comando ${jsCommand} detectado de ${sender} no chat ${chatId}`);

        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: `❌ Você não tem permissão para usar este comando. Apenas administradores podem executar ${jsCommand}.`,
            }, { quoted: msg });
            return;
        }

        try {
            const filePath = path.resolve(__dirname, '..', 'fun', 'jokesCommands.js');
            
            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, {
                    text: "❌ Arquivo jokesCommands.js não encontrado!",
                }, { quoted: msg });
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            await sock.sendMessage(chatId, {
                document: Buffer.from(fileContent, 'utf8'),
                fileName: 'jokesCommands.js',
                mimetype: 'application/javascript',
                caption: `📁 Arquivo jokesCommands.js enviado pelo comando ${jsCommand}`
            }, { quoted: msg });

            console.log(`[SUCCESS] Arquivo jokesCommands.js enviado para ${chatId}`);

        } catch (error) {
            console.error('[ERROR] Erro ao enviar arquivo:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao enviar o arquivo. Verifique os logs para mais detalhes.",
            }, { quoted: msg });
        }
    }

    if (textMessage.startsWith(sendJsonCommand)) {
        console.log(`[DEBUG] Comando ${sendJsonCommand} detectado de ${sender} no chat ${chatId}`);

        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: `❌ Você não tem permissão para usar este comando. Apenas administradores podem executar ${sendJsonCommand}.`,
            }, { quoted: msg });
            return;
        }

        try {
            const filePath = path.resolve(__dirname, '..', '..', '..', 'levels_info', 'users.json');
            
            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, {
                    text: "❌ Arquivo users.json não encontrado!",
                }, { quoted: msg });
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            await sock.sendMessage(chatId, {
                document: Buffer.from(fileContent, 'utf8'),
                fileName: 'users.json',
                mimetype: 'application/json',
                caption: `📊 Arquivo users.json (dados dos usuários) enviado pelo comando ${sendJsonCommand}`
            }, { quoted: msg });

            console.log(`[SUCCESS] Arquivo users.json enviado para ${chatId}`);

        } catch (error) {
            console.error('[ERROR] Erro ao enviar arquivo users.json:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao enviar o arquivo users.json. Verifique os logs para mais detalhes.",
            }, { quoted: msg });
        }
    }
}

module.exports = sendJsCommandBot;
