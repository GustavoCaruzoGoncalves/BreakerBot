const { default: axios } = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
require("dotenv").config();
const { admins } = require("./adm");

const chatMemory = {};

async function gptCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

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

    if (text && !text.startsWith("!gpt4")) {
        chatMemory[chatId].push({ role: "user", content: text });

        if (chatMemory[chatId].length > 30) {
            chatMemory[chatId] = chatMemory[chatId].slice(-30);
        }
    }

    if (text.startsWith("!reset")) {
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

    if (text.startsWith("!gpt4")) {
        let prompt = text.replace("!gpt4", "").trim();
        let imageBuffer = null;

        if (msg.message.imageMessage) {
            imageBuffer = await downloadMediaMessage(msg, "buffer");
        }

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedMsg = { message: quoted };
            imageBuffer = await downloadMediaMessage(quotedMsg, "buffer");
        }

        if (imageBuffer) {
            const base64Image = imageBuffer.toString("base64");
            const response = await askChatGPT4WithImage(base64Image, prompt);
            await sock.sendMessage(chatId, { text: response });
        } else {
            chatMemory[chatId].push({ role: "user", content: prompt });
            const response = await askChatGPT4(chatMemory[chatId]);
            chatMemory[chatId].push({ role: "assistant", content: response });
            await sock.sendMessage(chatId, { text: response });
        }
    }

    if (text.startsWith("!gpt3")) {
        const query = text.replace("!gpt3", "").trim();
        const response = await askChatGPT3(query);
        await sock.sendMessage(chatId, { text: response });
    }

    async function askChatGPT3(prompt) {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
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
            console.error("Erro GPT-3:", error?.response?.data || error);
            return "Erro ao processar mensagem com GPT-3.";
        }
    }

    async function askChatGPT4(messages) {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            const systemMessage = {
                role: "system",
                content: "Você é um assistente que leva muito em conta as informações passadas pelo usuário. Se o usuário afirmar algo e te perguntar sobre, você tem que reafirmar isso com convicção."
            };

            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4o",
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
            console.error("Erro GPT-4:", error?.response?.data || error);
            return "Erro ao processar mensagem com GPT-4.";
        }
    }

    async function askChatGPT4WithImage(base64Image, prompt) {
        try {
            const apiKey = process.env.OPENAI_API_KEY;

            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4o",
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
            console.error("Erro GPT-4 com imagem:", error?.response?.data || error);
            return "Erro ao processar imagem com GPT-4.";
        }
    }
}

module.exports = gptCommandBot;
