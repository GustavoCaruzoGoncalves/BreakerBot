const { default: axios } = require("axios");
require("dotenv").config();
const mentionsController = require("../../controllers/mentionsController");
const { PREFIX } = require("../../config/prefix");

const playerGames = new Map();

const RATE_LIMIT_ERROR = 'rate-overlimit';

function getPlayerId(msg) {
    return msg.key.participant || msg.key.participantAlt || msg.key.remoteJid;
}

function getPlayerGame(playerId) {
    if (!playerGames.has(playerId)) {
        playerGames.set(playerId, {
            score: 0,
            questionIndex: 0,
            triviaQuestions: []
        });
    }
    return playerGames.get(playerId);
}

function resetPlayerGame(playerId) {
    playerGames.set(playerId, {
        score: 0,
        questionIndex: 0,
        triviaQuestions: []
    });
    return playerGames.get(playerId);
}

function clearPlayerGame(playerId) {
    playerGames.delete(playerId);
}

async function askGptQuiz() {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-5",
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
        console.error("Erro GPT-5 com quiz:", error?.response?.data || error);
        return null;
    }
}

function parseGptQuizResponse(response) {
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

async function sendMessageWithRetry(sock, chatId, message, mentions = [], retries = 3, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await sock.sendMessage(chatId, { text: message, mentions });
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

function getPlayerMentionPrefix(playerId) {
    const mentionInfo = mentionsController.processSingleMention(playerId);
    return {
        prefix: `🎯 Jogo de ${mentionInfo.mentionText}\n\n`,
        mentions: mentionInfo.mentions
    };
}

async function gamesCommandsBot(sock, { messages }) {
    const msg = messages[0];

    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const playerId = getPlayerId(msg);

    const triviaCommand = `${PREFIX}trivia`;

    if (text === `${triviaCommand} start`) {
        const playerGame = resetPlayerGame(playerId);
        const { prefix, mentions } = getPlayerMentionPrefix(playerId);
        
        await sendMessageWithRetry(sock, chatId, `${prefix}Bem-vindo ao jogo de trivia! Gerando perguntas com IA... ⏳`, mentions);
        
        const aiResponse = await askGptQuiz();
        
        if (!aiResponse) {
            await sendMessageWithRetry(sock, chatId, `${prefix}Erro ao gerar perguntas. Tente novamente mais tarde.`, mentions);
            clearPlayerGame(playerId);
            return;
        }
        
        playerGame.triviaQuestions = parseGptQuizResponse(aiResponse);
        
        if (playerGame.triviaQuestions.length === 0) {
            await sendMessageWithRetry(sock, chatId, `${prefix}Erro ao processar perguntas. Tente novamente.`, mentions);
            clearPlayerGame(playerId);
            return;
        }
        
        await sendMessageWithRetry(sock, chatId, `${prefix}Perguntas geradas! Total: ${playerGame.triviaQuestions.length} perguntas. Vamos começar! 🎮`, mentions);
        askNextQuestion(sock, chatId, playerId);
    }

    else if (text && text.startsWith(`${triviaCommand} resposta`)) {
        const userAnswer = text.split(" ")[2];
        const { prefix, mentions } = getPlayerMentionPrefix(playerId);
        
        if (!userAnswer) {
            await sendMessageWithRetry(sock, chatId, `${prefix}Por favor, forneça uma resposta (A, B, C ou D). Exemplo: ${triviaCommand} resposta A`, mentions);
            return;
        }

        const playerGame = getPlayerGame(playerId);

        if (playerGame.triviaQuestions.length === 0 || playerGame.questionIndex >= playerGame.triviaQuestions.length) {
            await sendMessageWithRetry(sock, chatId, `${prefix}Nenhum jogo em andamento. Use !trivia start para começar.`, mentions);
            return;
        }

        const correctAnswer = playerGame.triviaQuestions[playerGame.questionIndex].answer;
        
        if (userAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
            playerGame.score++;
            await sendMessageWithRetry(sock, chatId, `${prefix}✅ Resposta correta! Sua pontuação é: ${playerGame.score}`, mentions);
        } else {
            await sendMessageWithRetry(sock, chatId, `${prefix}❌ Resposta errada! A resposta correta era: ${correctAnswer}`, mentions);
        }

        playerGame.questionIndex++;
        if (playerGame.questionIndex < playerGame.triviaQuestions.length) {
            askNextQuestion(sock, chatId, playerId);
        } else {
            await sendMessageWithRetry(sock, chatId, `${prefix}🎉 Você terminou o jogo! Sua pontuação final é ${playerGame.score} de ${playerGame.triviaQuestions.length}`, mentions);
            clearPlayerGame(playerId);
        }
    }
}

async function askNextQuestion(sock, chatId, playerId) {
    const playerGame = getPlayerGame(playerId);
    const { prefix, mentions } = getPlayerMentionPrefix(playerId);
    
    if (playerGame.questionIndex < playerGame.triviaQuestions.length) {
        setTimeout(async () => {
            const currentQ = playerGame.triviaQuestions[playerGame.questionIndex];
            const questionText = `${prefix}📝 Pergunta ${playerGame.questionIndex + 1}/${playerGame.triviaQuestions.length}:

${currentQ.question}

${currentQ.options.join('\n')}

Responda com: !trivia resposta [letra]
Exemplo: !trivia resposta A`;
            
            await sendMessageWithRetry(sock, chatId, questionText, mentions);
        }, 1000);
    }
}

module.exports = gamesCommandsBot;
