async function menuCommandBot(sock, { messages }) {
    const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        const sender = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`[DEBUG] Mensagem recebida de ${sender}: ${textMessage}`);

        if (textMessage.startsWith("!menu")) {
            console.log("[DEBUG] Enviando menu de comandos...");
            const menuText = `📌 *Menu de Comandos:*\n
✅ *!menu* - Exibe esta lista de comandos.\n
✅ *!sticker* - Cria uma figurinha a partir de uma imagem.\n
✅ *!toimg* - Converte uma figurinha de volta para imagem PNG.\n
✅ *!play <nome ou link>* - Baixa uma música do YouTube e envia no WhatsApp.\n
✅ *!playmp4 <nome ou link>* - Baixa um vídeo do YouTube e envia no WhatsApp.\n
✅ *!ship* - Calcula a % de duas pessoas namorarem.\n
✅ *!gay* - Calcula a % de gay da pessoa.\n
✅ *!corno* - Calcula a % de corno da pessoa.\n
✅ *!hetero* - Calcula a % de hetero da pessoa.\n
✅ *!chato* - Calcula a % de chato da pessoa.\n
✅ *!gpt* - Fale com o Chat GPT.\n
✅ *!trivia* - Brinque de acertar respostas. Use !trivia start para começar e !trivia resposta (digite sua resposta agora) para responder!\n`;

            await sock.sendMessage(sender, { text: menuText }, { quoted: msg });
        }
}

module.exports = menuCommandBot;
