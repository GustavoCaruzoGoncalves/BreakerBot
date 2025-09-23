async function menuCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const sender = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log(`[DEBUG] Mensagem recebida de ${sender}: ${textMessage}`);

    if (textMessage.toLowerCase().startsWith("!menu") || textMessage.toLowerCase().startsWith("!ajuda") || textMessage.toLowerCase().startsWith("!help") || textMessage.toLowerCase().startsWith("!sobre")) {
        console.log("[DEBUG] Enviando menu de comandos...");
        const menuText = `📌 *Menu de Comandos:*

🎛️ *Comandos Gerais:*
✅ *!menu* - Exibe esta lista de comandos.

🖼️ *Figurinhas e Mídia:*
✅ *!sticker* - Cria uma figurinha a partir de uma imagem, vídeo ou GIF.
✅ *!fsticker* - Cria uma figurinha quadrada (512x512) a partir de uma imagem, vídeo ou GIF.
✅ *!toimg* - Converte uma figurinha de volta para imagem PNG.
✅ *!play <nome ou link>* - Baixa uma música do YouTube e envia no WhatsApp.
✅ *!playmp4 <nome ou link>* - Baixa um vídeo do YouTube e envia no WhatsApp.

📊 *Comandos de zueiras:*
✅ *!ship* - Calcula a % de duas pessoas namorarem.
✅ *!gay* - Calcula a % de gay da pessoa.
✅ *!corno* - Calcula a % de corno da pessoa.
✅ *!hetero* - Calcula a % de hétero da pessoa.
✅ *!chato* - Calcula a % de chato da pessoa.
✅ *!petista* - Calcula a % de petista da pessoa.
✅ *!bolsonarista* - Calcula a % de bolsonarista da pessoa.
✅ *!leitada* - Calcula a % de leitada que a pessoa levou.
✅ *!fazol* ou *!FAZOL* - FAZ O L CARALHOOOOOOOOOO.

🤖 *IA, Bots e APIs:*
✅ *!gpt3* - Fale com o Chat GPT-3 sem contexto (respostas únicas).
✅ *!gpt4* - Fale com o Chat GPT-4 com contexto (ele lembra o que foi dito) ou use o comando marcando uma imagem para ele fazer uma análise.
✅ *!grok* - Fale com o Grok.
✅ *!grokangry* - Fale com o Grok sendo rude.
✅ *!grokimg* - Gere imagens com o Grok.
✅ *!lyrics* "Cantor" "Música" - Pesquisa músicas.
✅ *!lyrics* escolha (numero) - Retorna a letra da música escolhida.

🎮 *Jogos:*
✅ *!trivia* - Brinque de acertar respostas. Use *!trivia start* para começar e *!trivia resposta <sua resposta>* para responder.

🎯 *Sistema de Níveis:*
✅ *!niveis* - Explica como funciona o sistema de níveis.
✅ *!me* - Mostra seu status atual (nível, XP, elo, prestígio).
✅ *!elos* - Lista todos os elos disponíveis.
✅ *!prestigio* - Faz prestígio (nível 10+).
✅ *!ranking* - Mostra o top 10 usuários.
`;

        await sock.sendMessage(sender, { text: menuText }, { quoted: msg });
    }
}

module.exports = menuCommandBot;
