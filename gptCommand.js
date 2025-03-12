const { default: axios } = require("axios");
require("dotenv").config();

async function gptCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (text.startsWith("!gpt")) {
        const query = text.replace("!gpt", "").trim();
        const response = await askChatGPT(query);
        await sock.sendMessage(chatId, { text: response });
    }

    async function askChatGPT(prompt) {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                },
                { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("Erro ao chamar a API:", error);
            return "Houve um erro ao processar sua mensagem.";
        }
    }
}

module.exports = gptCommandBot;
