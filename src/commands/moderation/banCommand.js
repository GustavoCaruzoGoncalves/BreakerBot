const { admins } = require("../../config/adm");
const repo = require("../../database/repository");

async function banCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid.endsWith("@g.us")) return;

    const groupId = msg.key.remoteJid;
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const isAdmin = admins.includes(sender);
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    const rawMentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const mentionedJid = rawMentioned ? ((await repo.findUserIdByJid(rawMentioned)) || rawMentioned) : null;

    if (text.startsWith("!ban")) {
        if (!isAdmin) {
            await sock.sendMessage(groupId, {
                text: "❌ Você não tem permissão para usar este comando. Somente administradores podem usar `!ban`."
            });
            return;
        }

        if (!mentionedJid) {
            await sock.sendMessage(groupId, {
                text: "❌ Você precisa marcar alguém para banir. Exemplo: `!ban @usuario`"
            });
            return;
        }

        try {
            await sock.groupParticipantsUpdate(groupId, [mentionedJid], "remove");
            await sock.sendMessage(groupId, {
                text: `✅ Usuário removido com sucesso.`
            });
        } catch (err) {
            const errMsg = (err?.message || String(err)).toLowerCase();
            if (errMsg.includes('admin') || errMsg.includes('permission') || errMsg.includes('401') || errMsg.includes('403')) {
                await sock.sendMessage(groupId, {
                    text: "⚠️ Eu preciso ser administrador do grupo para poder remover alguém."
                });
            } else {
                await sock.sendMessage(groupId, {
                    text: `❌ Erro ao remover: ${err?.message || err}`
                });
            }
        }
    }
}

module.exports = banCommandBot;
