const { PREFIX } = require("../../config/prefix");
const features = require("../../config/features");

async function menuCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    if (!features.utility?.menu?.enabled) return;

    const sender = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // #region agent log
    try {
        fetch('http://127.0.0.1:7318/ingest/b4c0730a-0fc4-4150-81cd-58837ff2aca9', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': '95a2dd',
            },
            body: JSON.stringify({
                sessionId: '95a2dd',
                runId: 'menu-run-1',
                hypothesisId: 'A',
                location: 'menuCommand.js:entry',
                message: 'menuCommandBot entry',
                data: {
                    sender,
                    messageType,
                    textMessage,
                    PREFIX
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
    } catch (_) {}
    // #endregion agent log

    const lower = textMessage.toLowerCase();
    const prefixLower = PREFIX.toLowerCase();

    if (
        lower.startsWith(`${prefixLower}menu`) ||
        lower.startsWith(`${prefixLower}ajuda`) ||
        lower.startsWith(`${prefixLower}help`) ||
        lower.startsWith(`${prefixLower}sobre`)
    ) {
        // #region agent log
        try {
            fetch('http://127.0.0.1:7318/ingest/b4c0730a-0fc4-4150-81cd-58837ff2aca9', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '95a2dd',
                },
                body: JSON.stringify({
                    sessionId: '95a2dd',
                    runId: 'menu-run-1',
                    hypothesisId: 'B',
                    location: 'menuCommand.js:branch',
                    message: 'menuCommandBot matched menu prefix',
                    data: {
                        textMessage,
                        PREFIX,
                        prefixLower
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
        } catch (_) {}
        // #endregion agent log
        const p = PREFIX;
        const menuText = `📌 *Menu de Comandos:*

🎛️ *Comandos Gerais:*
✅ *${p}menu* - Exibe esta lista de comandos.

🖼️ *Figurinhas e Mídia:*
✅ *${p}sticker* - Cria uma figurinha a partir de uma imagem, vídeo ou GIF.
✅ *${p}fsticker* - Cria uma figurinha quadrada (512x512) a partir de uma imagem, vídeo ou GIF.
✅ *${p}toimg* - Converte uma figurinha de volta para imagem PNG.
✅ *${p}play <nome ou link>* - Baixa uma música do YouTube e envia no WhatsApp.
✅ *${p}playmp4 <nome ou link>* - Baixa um vídeo do YouTube e envia no WhatsApp.

📊 *Comandos de zueiras:*
✅ *${p}ship* - Calcula a % de duas pessoas namorarem.
✅ *${p}gay* - Calcula a % de gay da pessoa.
✅ *${p}corno* - Calcula a % de corno da pessoa.
✅ *${p}hetero* - Calcula a % de hétero da pessoa.
✅ *${p}chato* - Calcula a % de chato da pessoa.
✅ *${p}petista* - Calcula a % de petista da pessoa.
✅ *${p}bolsonarista* - Calcula a % de bolsonarista da pessoa.
✅ *${p}leitada* - Calcula a % de leitada que a pessoa levou.
✅ *${p}fazol* ou *${p.toUpperCase()}FAZOL* - FAZ O L CARALHOOOOOOOOOO.

🤖 *IA, Bots e APIs:*
✅ *${p}gpt3* - Fale com o Chat GPT-3 sem contexto (respostas únicas).
✅ *${p}gpt4* - Fale com o Chat GPT-4 com contexto (ele lembra o que foi dito) ou use o comando marcando uma imagem para ele fazer uma análise.
✅ *${p}grok* - Fale com o Grok.
✅ *${p}grokangry* - Fale com o Grok sendo rude.
✅ *${p}grokimg* - Gere imagens com o Grok.
✅ *${p}lyrics* "Cantor" "Música" - Pesquisa músicas.
✅ *${p}lyrics* escolha (numero) - Retorna a letra da música escolhida.

🎮 *Jogos:*
✅ *${p}trivia* - Brinque de acertar respostas. Use *${p}trivia start* para começar e *${p}trivia resposta <sua resposta>* para responder.

🎯 *Sistema de Níveis:*
✅ *${p}niveis* - Explica como funciona o sistema de níveis.
✅ *${p}me* - Mostra seu status atual (nível, XP, elo, prestígio).
✅ *${p}elos* - Lista todos os elos disponíveis.
✅ *${p}prestigio* - Faz prestígio (nível 10+).
✅ *${p}ranking* - Mostra o top 10 usuários.
`;

        await sock.sendMessage(sender, { text: menuText }, { quoted: msg });
    }
}

module.exports = menuCommandBot;
