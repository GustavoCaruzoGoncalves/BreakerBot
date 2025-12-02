const { default: axios } = require("axios");
require("dotenv").config();

let score = 0;
let questionIndex = 0;
let triviaQuestions = [];

const RATE_LIMIT_ERROR = 'rate-overlimit';

async function askZhipuQuiz() {
    try {
        const apiKey = process.env.ZHIPU_API_KEY;
        const response = await axios.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            {
                model: "glm-4.5",
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente que gera perguntas de quiz sobre cultura geral. Você deve gerar perguntas com 4 alternativas (A, B, C, D) seguindo o formato: 'Pergunta: [pergunta]' seguido de 'A) [opção]', 'B) [opção]', 'C) [opção]', 'D) [opção]' e por último 'Resposta correta: [letra]) [resposta]'."
                    },
                    {
                        role: "user",
                        content: "Gere 10 perguntas de cultura geral em português brasileiro com 4 alternativas cada."
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
        console.error("Erro Zhipu GLM-4.5 com quiz:", error?.response?.data || error);
        return null;
    }
}

function parseZhipuQuizResponse(response) {
    const questions = [];
    const lines = response.split('\n').filter(line => line.trim() !== '');
    
    let currentQuestion = null;
    let options = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('Pergunta:')) {
            if (currentQuestion && currentQuestion.answer) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question: line.replace('Pergunta:', '').trim(),
                options: [],
                answer: ''
            };
            options = [];
        } else if (line.match(/^[A-D]\)/)) {
            if (currentQuestion) {
                options.push(line);
                currentQuestion.options = options;
            }
        } else if (line.startsWith('Resposta correta:')) {
            if (currentQuestion) {
                const answerMatch = line.match(/^Resposta correta:\s*([A-D])\)/);
                if (answerMatch) {
                    currentQuestion.answer = answerMatch[1];
                }
            }
        }
    }
    
    if (currentQuestion && currentQuestion.answer) {
        questions.push(currentQuestion);
    }
    
    return questions;
}

async function sendMessageWithRetry(sock, chatId, message, retries = 3, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await sock.sendMessage(chatId, { text: message });
            break;
        } catch (err) {
            if (err.message.includes(RATE_LIMIT_ERROR) && attempt < retries) {
                console.log(`Rate limit excedido. Tentando novamente em ${delay / 1000} segundos...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('Erro ao enviar mensagem:', err);
                break;
            }
        }
    }
}

async function gamesCommandsBot(sock, { messages }) {
    const msg = messages[0];

    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text === "!trivia start") {
        questionIndex = 0;
        score = 0;
        
        await sendMessageWithRetry(sock, chatId, "Bem-vindo ao jogo de trivia! Gerando perguntas com IA... ⏳");
        
        const aiResponse = await askZhipuQuiz();
        
        if (!aiResponse) {
            await sendMessageWithRetry(sock, chatId, "Erro ao gerar perguntas. Tente novamente mais tarde.");
            return;
        }
        
        triviaQuestions = parseZhipuQuizResponse(aiResponse);
        
        if (triviaQuestions.length === 0) {
            await sendMessageWithRetry(sock, chatId, "Erro ao processar perguntas. Tente novamente.");
            return;
        }
        
        await sendMessageWithRetry(sock, chatId, `Perguntas geradas! Total: ${triviaQuestions.length} perguntas. Vamos começar! 🎮`);
        askNextQuestion(sock, chatId);
    }

    else if (text && text.startsWith("!trivia resposta")) {
        const userAnswer = text.split(" ")[2];
        if (!userAnswer) {
            await sendMessageWithRetry(sock, chatId, "Por favor, forneça uma resposta (A, B, C ou D). Exemplo: !trivia resposta A");
            return;
        }

        if (triviaQuestions.length === 0 || questionIndex >= triviaQuestions.length) {
            await sendMessageWithRetry(sock, chatId, "Nenhum jogo em andamento. Use !trivia start para começar.");
            return;
        }

        const correctAnswer = triviaQuestions[questionIndex].answer;
        
        if (userAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
            score++;
            await sendMessageWithRetry(sock, chatId, `✅ Resposta correta! Sua pontuação é: ${score}`);
        } else {
            await sendMessageWithRetry(sock, chatId, `❌ Resposta errada! A resposta correta era: ${correctAnswer}`);
        }

        questionIndex++;
        if (questionIndex < triviaQuestions.length) {
            askNextQuestion(sock, chatId);
        } else {
            await sendMessageWithRetry(sock, chatId, `🎉 Você terminou o jogo! Sua pontuação final é ${score} de ${triviaQuestions.length}`);
            triviaQuestions = [];
        }
    }
}

async function askNextQuestion(sock, chatId) {
    if (questionIndex < triviaQuestions.length) {
        setTimeout(async () => {
            const currentQ = triviaQuestions[questionIndex];
            const questionText = `
📝 Pergunta ${questionIndex + 1}/${triviaQuestions.length}:

${currentQ.question}

${currentQ.options.join('\n')}

Responda com: !trivia resposta [letra]
Exemplo: !trivia resposta A
            `.trim();
            
            await sendMessageWithRetry(sock, chatId, questionText);
        }, 1000);
    }
}

module.exports = gamesCommandsBot;
