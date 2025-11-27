const { default: axios } = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
require("dotenv").config();
const { admins } = require("../../config/adm");

const chatMemory = {};

async function zhipuCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const messageType = Object.keys(msg.message)[0];
    const isImageWithCaption = messageType === "imageMessage" && msg.message.imageMessage.caption;
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        (isImageWithCaption ? msg.message.imageMessage.caption : "") ||
        "";

    if (msg.key.fromMe) return;

    if (!chatMemory[chatId]) {
        chatMemory[chatId] = [];
    }

    if (text && !text.startsWith("!zhipu")) {
        chatMemory[chatId].push({ role: "user", content: text });

        if (chatMemory[chatId].length > 30) {
            chatMemory[chatId] = chatMemory[chatId].slice(-30);
        }
    }

    if (text.startsWith("!resetZhipu")) {
        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Você não tem permissão para usar esse comando. Somente administradores podem usar `!reset`."
            });
            return;
        }

        delete chatMemory[chatId];
        await sock.sendMessage(chatId, { text: "✅ Histórico de memória apagado com sucesso." });
        return;
    }

    if (text.startsWith("!zhipu")) {
        let userPrompt = text.replace("!zhipu", "").trim();
        let imageBuffer = null;

        const promptMessages = [];

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (quoted?.imageMessage) {
            const fakeMsg = { message: quoted };
            imageBuffer = await downloadMediaMessage(fakeMsg, "buffer");
        } else if (msg.message.imageMessage) {
            imageBuffer = await downloadMediaMessage(msg, "buffer");
        }

        if (imageBuffer) {
            const base64Image = imageBuffer.toString("base64");
            const promptImagem = userPrompt || "Descreva essa imagem.";
            const response = await askZhipuWithImage(base64Image, promptImagem);

            if (!chatMemory[chatId]) chatMemory[chatId] = [];
            chatMemory[chatId].push({ role: "user", content: promptImagem });
            chatMemory[chatId].push({ role: "assistant", content: response });

            await sock.sendMessage(chatId, { text: response });
            return;
        }

        const quotedText =
            quoted?.conversation ||
            quoted?.extendedTextMessage?.text ||
            quoted?.imageMessage?.caption ||
            quoted?.videoMessage?.caption;

        if (quotedText) {
            promptMessages.push({ role: "user", content: quotedText });
        }

        if (userPrompt.length === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ Digite uma pergunta junto com `!zhipu`."
            });
            return;
        }

        promptMessages.push({ role: "user", content: userPrompt });

        const finalMessages = [
            { role: "system", content: "Você é um assistente que responde de forma direta e com base nas mensagens marcadas como contexto. Suas respostas anteriores também são consideradas parte da conversa." },
            ...(chatMemory[chatId] || []),
            ...promptMessages
        ];

        const response = await askZhipu(finalMessages);

        if (!chatMemory[chatId]) chatMemory[chatId] = [];
        chatMemory[chatId].push(...promptMessages);
        chatMemory[chatId].push({ role: "assistant", content: response });

        if (chatMemory[chatId].length > 30) {
            chatMemory[chatId] = chatMemory[chatId].slice(-30);
        }

        await sock.sendMessage(chatId, { text: response });
    }

    async function askZhipu(messages) {
        try {
            const apiKey = process.env.ZHIPU_API_KEY;
            const systemMessage = {
                role: "system",
                content: "Você é um assistente que leva muito em conta as informações passadas pelo usuário, mas ele não é absoluto, quando se tratar de coisas, pessoas e acontecimentos públicos ao invés desses mesmos cenários só que em contextos de imaginação pelo usuário, valide as informações. Se o usuário afirmar algo, você tem que reafirmar isso com convicção, mas se o usuário fizer uma pergunta, ou seja, terminar com interrogração, você não deve só anotar e afirmar que aquilo é contexto, só deve-se considerar contexto o que é afirmado pelo usuário. O que não for informado ou não estiver no contexto, você não avisa que não está no contexto e que pesquisou para responder, apenas use sua base e responda-o.",
            };

            const response = await axios.post(
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                {
                    model: "glm-4.5",
                    messages: [systemMessage, ...messages],
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("Erro Zhipu GLM-4.5:", error?.response?.data || error);
            return "Erro ao processar mensagem com Zhipu GLM-4.5.";
        }
    }

    async function askZhipuWithImage(base64Image, prompt) {
        try {
            const apiKey = process.env.ZHIPU_API_KEY;

            const response = await axios.post(
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                {
                    model: "glm-4.5",
                    messages: [
                        {
                            role: "system",
                            content: "Você é um assistente que interpreta imagens e responde de forma precisa com base na imagem e no texto enviado pelo usuário."
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt || "Descreva essa imagem." },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("Erro Zhipu GLM-4.5 com imagem:", error?.response?.data || error);
            return "Erro ao processar imagem com Zhipu GLM-4.5.";
        }
    }
}

module.exports = zhipuCommandBot;
