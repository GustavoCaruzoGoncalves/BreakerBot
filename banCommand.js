const { admins } = require("./adm");

async function banCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid.endsWith("@g.us")) return;

    const groupId = msg.key.remoteJid;
    
    // Identificar o usuário corretamente: em grupos usa participantAlt, em privado usa remoteJid
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const isAdmin = admins.includes(sender);
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

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

        const groupMetadata = await sock.groupMetadata(groupId);
        const botNumber = (await sock.user.id.split(":")[0]) + "@s.whatsapp.net";
        const botInGroup = groupMetadata.participants.find(p => p.id === botNumber);

        if (!botInGroup || !botInGroup.admin) {
            await sock.sendMessage(groupId, {
                text: "⚠️ Eu preciso ser administrador para poder remover alguém do grupo."
            });
            return;
        }

        await sock.groupParticipantsUpdate(groupId, [mentionedJid], "remove");
        await sock.sendMessage(groupId, {
            text: `✅ Usuário removido com sucesso.`
        });
    }
}

module.exports = banCommandBot;
