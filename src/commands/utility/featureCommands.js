const fs = require('fs');
const path = require('path');
const { admins } = require('../../config/adm');
const { PREFIX } = require('../../config/prefix');
const features = require('../../config/features');

const FEATURES_FILE = path.join(__dirname, '..', '..', '..', 'data', 'features.json');

function readFeatures() {
    try {
        if (!fs.existsSync(FEATURES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(FEATURES_FILE, 'utf8');
        if (!data.trim()) return [];
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch (err) {
        console.error('[DEBUG] Erro ao ler features.json:', err);
        return [];
    }
}

function writeFeatures(features) {
    try {
        const dir = path.dirname(FEATURES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(FEATURES_FILE, JSON.stringify(features, null, 2));
        return true;
    } catch (err) {
        console.error('[DEBUG] Erro ao salvar features.json:', err);
        return false;
    }
}

async function featureCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    if (!features.utility?.feature?.enabled) return;

    const chatId = msg.key.remoteJid;
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const featureCommand = `${PREFIX}feature`;
    if (!textMessage || !textMessage.toLowerCase().startsWith(featureCommand.toLowerCase())) {
        return;
    }

    const parts = textMessage.trim().split(' ');
    const subcommand = (parts[1] || '').toLowerCase();

    if (!subcommand || subcommand === 'help') {
        await sock.sendMessage(chatId, {
            text: "🛠 *Sistema de Sugestões de Features*\n\n" +
                  `• ${featureCommand} add descrição da feature\n` +
                  `• ${featureCommand} lista\n` +
                  `• ${featureCommand} finish número\n` +
                  `• ${featureCommand} remove número`
        }, { quoted: msg });
        return;
    }

    if (subcommand === 'add') {
        const description = parts.slice(2).join(' ').trim();
        if (!description) {
            await sock.sendMessage(chatId, {
                text: `✏️ Uso: ${featureCommand} add descrição da feature`
            }, { quoted: msg });
            return;
        }

        const features = readFeatures();
        const newFeature = {
            id: features.length + 1,
            description,
            status: "pending",
            createdAt: new Date().toISOString(),
            createdBy: sender
        };
        features.push(newFeature);

        if (!writeFeatures(features)) {
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao salvar a feature. Tente novamente mais tarde."
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `✅ Feature #${newFeature.id} adicionada:\n${newFeature.description}`
        }, { quoted: msg });
        return;
    }

    if (subcommand === 'lista') {
        const features = readFeatures();
        if (features.length === 0) {
            await sock.sendMessage(chatId, {
                text: `📭 Nenhuma feature cadastrada ainda.\nUse *${featureCommand} add descrição* para criar uma.`
            }, { quoted: msg });
            return;
        }

        let message = "🛠 *Lista de Features*\n\n";
        for (const f of features) {
            const statusIcon = f.status === 'finished' ? '✅' : '📝';
            message += `#${f.id} ${statusIcon} ${f.description}\n`;
        }

        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
        return;
    }

    if (subcommand === 'finish') {
        const num = parseInt(parts[2], 10);
        if (isNaN(num) || num <= 0) {
            await sock.sendMessage(chatId, {
                text: `✏️ Uso: ${featureCommand} finish número\nEx: ${featureCommand} finish 2`
            }, { quoted: msg });
            return;
        }

        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: `❌ Apenas administradores podem usar *${featureCommand} finish*.`
            }, { quoted: msg });
            return;
        }

        const features = readFeatures();
        const index = features.findIndex(f => f.id === num);
        if (index === -1) {
            await sock.sendMessage(chatId, {
                text: `❌ Feature #${num} não encontrada.`
            }, { quoted: msg });
            return;
        }

        features[index].status = 'finished';
        features[index].finishedAt = new Date().toISOString();

        if (!writeFeatures(features)) {
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao atualizar a feature. Tente novamente mais tarde."
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `✅ Feature #${num} marcada como *finalizada*:\n${features[index].description}`
        }, { quoted: msg });
        return;
    }

    if (subcommand === 'remove') {
        const num = parseInt(parts[2], 10);
        if (isNaN(num) || num <= 0) {
            await sock.sendMessage(chatId, {
                text: `✏️ Uso: ${featureCommand} remove número\nEx: ${featureCommand} remove 3`
            }, { quoted: msg });
            return;
        }

        let features = readFeatures();
        const index = features.findIndex(f => f.id === num);
        if (index === -1) {
            await sock.sendMessage(chatId, {
                text: `❌ Feature #${num} não encontrada.`
            }, { quoted: msg });
            return;
        }

        const removed = features.splice(index, 1)[0];

        features = features.map((f, idx) => ({
            ...f,
            id: idx + 1
        }));

        if (!writeFeatures(features)) {
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao remover a feature. Tente novamente mais tarde."
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `🗑 Feature removida:\n${removed.description}`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, {
            text: `❓ Subcomando inválido.\nUse:\n• ${featureCommand} add descrição\n• ${featureCommand} lista\n• ${featureCommand} finish número\n• ${featureCommand} remove número`
    }, { quoted: msg });
}

module.exports = featureCommandsBot;

