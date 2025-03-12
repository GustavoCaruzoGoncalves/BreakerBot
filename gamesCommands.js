let score = 0;
let questionIndex = 0;

const triviaQuestions = [
    {
        question: "Qual é a capital da França?",
        answer: "Paris"
    },
    {
        question: "Qual é o maior planeta do sistema solar?",
        answer: "Júpiter"
    },
    {
        question: "Em que ano o Brasil foi descoberto?",
        answer: "1500"
    },
    {
        question: "Quem pintou a Mona Lisa?",
        answer: "Leonardo da Vinci"
    },
    {
        question: "Qual é o símbolo químico do ouro?",
        answer: "Au"
    }
];

const RATE_LIMIT_ERROR = 'rate-overlimit';

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
        await sendMessageWithRetry(sock, chatId, "Bem-vindo ao jogo de trivia! Vamos começar!");
        askNextQuestion(sock, chatId);
    }

    else if (text.startsWith("!trivia resposta")) {
        const userAnswer = text.split(" ")[2];
        if (!userAnswer) return;

        if (userAnswer.toLowerCase() === triviaQuestions[questionIndex].answer.toLowerCase()) {
            score++;
            await sendMessageWithRetry(sock, chatId, `Resposta correta! Sua pontuação é: ${score}`);
        } else {
            await sendMessageWithRetry(sock, chatId, "Resposta errada, tente novamente!");
        }

        questionIndex++;
        if (questionIndex < triviaQuestions.length) {
            askNextQuestion(sock, chatId);
        } else {
            await sendMessageWithRetry(sock, chatId, `Você terminou o jogo! Sua pontuação final é ${score} de ${triviaQuestions.length}`);
        }
    }
}

async function askNextQuestion(sock, chatId) {
    if (questionIndex < triviaQuestions.length) {
        setTimeout(async () => {
            await sendMessageWithRetry(sock, chatId, triviaQuestions[questionIndex].question);
        }, 1000);
    }
}

module.exports = gamesCommandsBot;
