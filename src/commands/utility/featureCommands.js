const { admins } = require('../../config/adm');
const repo = require('../../database/repository');

async function featureCommandsBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!textMessage || !textMessage.toLowerCase().startsWith('!feature')) {
        return;
    }

    const parts = textMessage.trim().split(' ');
    const subcommand = (parts[1] || '').toLowerCase();

    if (!subcommand || subcommand === 'help') {
        await sock.sendMessage(chatId, {
            text: "🛠 *Sistema de Sugestões de Features*\n\n" +
                  "• !feature add descrição da feature\n" +
                  "• !feature lista\n" +
                  "• !feature finish número\n" +
                  "• !feature remove número"
        }, { quoted: msg });
        return;
    }

    if (subcommand === 'add') {
        const description = parts.slice(2).join(' ').trim();
        if (!description) {
            await sock.sendMessage(chatId, {
                text: "✏️ Uso: !feature add descrição da feature"
            }, { quoted: msg });
            return;
        }

        try {
            const newFeature = await repo.addFeature(description, sender);
            await sock.sendMessage(chatId, {
                text: `✅ Feature #${newFeature.id} adicionada:\n${newFeature.description}`
            }, { quoted: msg });
        } catch (err) {
            console.error('[DEBUG] Erro ao salvar feature:', err);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao salvar a feature. Tente novamente mais tarde."
            }, { quoted: msg });
        }
        return;
    }

    if (subcommand === 'lista') {
        try {
            const features = await repo.getFeatures();
            if (features.length === 0) {
                await sock.sendMessage(chatId, {
                    text: "📭 Nenhuma feature cadastrada ainda.\nUse *!feature add descrição* para criar uma."
                }, { quoted: msg });
                return;
            }

            let message = "🛠 *Lista de Features*\n\n";
            for (const f of features) {
                const statusIcon = f.status === 'finished' ? '✅' : '📝';
                message += `#${f.id} ${statusIcon} ${f.description}\n`;
            }

            await sock.sendMessage(chatId, { text: message }, { quoted: msg });
        } catch (err) {
            console.error('[DEBUG] Erro ao ler features:', err);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao carregar features. Tente novamente mais tarde."
            }, { quoted: msg });
        }
        return;
    }

    if (subcommand === 'finish') {
        const num = parseInt(parts[2], 10);
        if (isNaN(num) || num <= 0) {
            await sock.sendMessage(chatId, {
                text: "✏️ Uso: !feature finish número\nEx: !feature finish 2"
            }, { quoted: msg });
            return;
        }

        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Apenas administradores podem usar *!feature finish*."
            }, { quoted: msg });
            return;
        }

        try {
            const features = await repo.getFeatures();
            const feature = features.find(f => f.id === num);
            if (!feature) {
                await sock.sendMessage(chatId, {
                    text: `❌ Feature #${num} não encontrada.`
                }, { quoted: msg });
                return;
            }

            await repo.updateFeatureStatus(num, 'finished');
            await sock.sendMessage(chatId, {
                text: `✅ Feature #${num} marcada como *finalizada*:\n${feature.description}`
            }, { quoted: msg });
        } catch (err) {
            console.error('[DEBUG] Erro ao atualizar feature:', err);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao atualizar a feature. Tente novamente mais tarde."
            }, { quoted: msg });
        }
        return;
    }

    if (subcommand === 'remove') {
        const num = parseInt(parts[2], 10);
        if (isNaN(num) || num <= 0) {
            await sock.sendMessage(chatId, {
                text: "✏️ Uso: !feature remove número\nEx: !feature remove 3"
            }, { quoted: msg });
            return;
        }

        try {
            const features = await repo.getFeatures();
            const feature = features.find(f => f.id === num);
            if (!feature) {
                await sock.sendMessage(chatId, {
                    text: `❌ Feature #${num} não encontrada.`
                }, { quoted: msg });
                return;
            }

            await repo.removeFeature(num);
            await sock.sendMessage(chatId, {
                text: `🗑 Feature removida:\n${feature.description}`
            }, { quoted: msg });
        } catch (err) {
            console.error('[DEBUG] Erro ao remover feature:', err);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao remover a feature. Tente novamente mais tarde."
            }, { quoted: msg });
        }
        return;
    }

    await sock.sendMessage(chatId, {
        text: "❓ Subcomando inválido.\nUse:\n• !feature add descrição\n• !feature lista\n• !feature finish número\n• !feature remove número"
    }, { quoted: msg });
}

module.exports = featureCommandsBot;
