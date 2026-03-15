const { admins } = require('../../config/adm');
const mentionsController = require('../../controllers/mentionsController');
const repo = require('../../database/repository');

async function loadUsersData() {
    try {
        return await repo.getAllUsers();
    } catch (error) {
        console.error('Erro ao carregar users:', error);
        return {};
    }
}

async function loadParticipantes() {
    try {
        return await repo.getAmigoSecretoAll();
    } catch (error) {
        console.error('Erro ao carregar participantes:', error);
        return {};
    }
}

async function saveParticipantes(data) {
    try {
        for (const [groupId, groupData] of Object.entries(data)) {
            await repo.saveAmigoSecretoGroup(groupId, groupData);
        }
    } catch (error) {
        console.error('Erro ao salvar participantes:', error);
    }
}

function getParticipantName(jid, usersData, contactsCache) {
    if (usersData[jid]?.pushName) {
        return usersData[jid].pushName;
    }
    
    for (const [userId, userData] of Object.entries(usersData)) {
        if (userData.jid === jid && userData.pushName) {
            return userData.pushName;
        }
    }
    
    if (contactsCache && contactsCache[jid]) {
        const contact = contactsCache[jid];
        if (contact.notify) return contact.notify;
        if (contact.name) return contact.name;
        if (contact.pushname) return contact.pushname;
    }
    
    return jid.split('@')[0];
}

async function atualizarNomesParticipantes(participantesData, chatId, usersData, contactsCache) {
    const grupo = participantesData[chatId];
    if (!grupo || !grupo.participantes || grupo.participantes.length === 0) return false;

    let alterou = false;
    const nomes = grupo.nomes || {};

    for (const jid of grupo.participantes) {
        const nomeAtual = nomes[jid];
        if (nomeAtual && /^Participante \d+$/.test(nomeAtual)) {
            const nomeReal = getParticipantName(jid, usersData, contactsCache);
            const numero = jid.split('@')[0];
            if (nomeReal && nomeReal.trim() && nomeReal !== numero) {
                nomes[jid] = nomeReal;
                alterou = true;
            }
        }
    }

    if (alterou) grupo.nomes = nomes;
    return alterou;
}

async function findGroupByName(sock, nomeGrupo) {
    try {
        const groups = await sock.groupFetchAllParticipating();
        for (const groupId in groups) {
            const group = groups[groupId];
            if (group.subject && group.subject.toLowerCase() === nomeGrupo.toLowerCase()) {
                return groupId;
            }
        }
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
    }
    return null;
}

function sortearAmigoSecreto(participantes) {
    if (participantes.length < 2) {
        return null;
    }

    if (participantes.length === 2) {
        return {
            [participantes[0]]: participantes[1],
            [participantes[1]]: participantes[0]
        };
    }

    let sorteio = {};
    let tentativas = 0;
    const maxTentativas = 100;

    while (tentativas < maxTentativas) {
        const disponiveis = [...participantes];
        let valido = true;
        sorteio = {};

        for (let i = disponiveis.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [disponiveis[i], disponiveis[j]] = [disponiveis[j], disponiveis[i]];
        }

        for (let i = 0; i < participantes.length; i++) {
            if (participantes[i] === disponiveis[i]) {
                valido = false;
                break;
            }
            sorteio[participantes[i]] = disponiveis[i];
        }

        if (valido) {
            return sorteio;
        }

        tentativas++;
    }

    const disponiveis = [...participantes];
    sorteio = {};
    for (let i = 0; i < participantes.length; i++) {
        let index = (i + 1) % participantes.length;
        sorteio[participantes[i]] = disponiveis[index];
    }

    return sorteio;
}

function findParticipantJid(participant, participantAlt, participantes) {
    if (participant && participantes.includes(participant)) {
        return participant;
    }
    if (participantAlt && participantes.includes(participantAlt)) {
        return participantAlt;
    }
    return null;
}

async function amigoSecretoCommandBot(sock, { messages }, contactsCache = {}) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;

    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe) return;

    if (!textMessage.toLowerCase().startsWith('!amigosecreto')) return;

    const partes = textMessage.toLowerCase().split(' ');
    const comando = partes[1];
    const subComando = partes[2];

    if (chatId.endsWith('@g.us')) {
        const participantesData = await loadParticipantes();
        const usersData = await loadUsersData();
        if (await atualizarNomesParticipantes(participantesData, chatId, usersData, contactsCache)) {
            await saveParticipantes(participantesData);
        }
    }

    if (comando === 'listapresente') {
        if (subComando === 'add') {
            if (!isGroup) {
                await sock.sendMessage(chatId, {
                    text: "❌ Este comando só pode ser usado em grupos!",
                }, { quoted: msg });
                return;
            }

            const participantesData = await loadParticipantes();
            if (!participantesData[chatId] || !participantesData[chatId].participantes) {
                await sock.sendMessage(chatId, {
                    text: "❌ Nenhum participante adicionado ao amigo secreto ainda!\n\n💡 Use *!amigoSecreto add* primeiro para adicionar participantes.",
                }, { quoted: msg });
                return;
            }

            const participantes = participantesData[chatId].participantes;
            const participant = msg.key.participant;
            const participantAlt = msg.key.participantAlt;
            
            const participantJid = findParticipantJid(participant, participantAlt, participantes);
            
            if (!participantJid) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você não está na lista de participantes do amigo secreto!",
                }, { quoted: msg });
                return;
            }

            const presente = textMessage.slice('!amigosecreto listapresente add'.length).trim();

            if (!presente) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você precisa especificar o presente que deseja!\n\n💡 Use: !amigoSecreto listaPresente add <presente desejado>",
                }, { quoted: msg });
                return;
            }

            if (!participantesData[chatId].presentes) {
                participantesData[chatId].presentes = {};
            }

            const presenteAtual = participantesData[chatId].presentes[participantJid];
            if (presenteAtual) {
                participantesData[chatId].presentes[participantJid] = `${presenteAtual}, ${presente}`;
            } else {
                participantesData[chatId].presentes[participantJid] = presente;
            }
            await saveParticipantes(participantesData);

            await sock.sendMessage(chatId, {
                text: `✅ Presente adicionado com sucesso!\n\n🎁 Seus desejos: *${participantesData[chatId].presentes[participantJid]}*`,
            }, { quoted: msg });
            return;

        } else if (subComando === 'delete') {
            if (!isGroup) {
                await sock.sendMessage(chatId, {
                    text: "❌ Este comando só pode ser usado em grupos!",
                }, { quoted: msg });
                return;
            }

            const participantesData = await loadParticipantes();
            if (!participantesData[chatId] || !participantesData[chatId].participantes) {
                await sock.sendMessage(chatId, {
                    text: "❌ Nenhum participante adicionado ao amigo secreto ainda!\n\n💡 Use *!amigoSecreto add* primeiro para adicionar participantes.",
                }, { quoted: msg });
                return;
            }

            const participantes = participantesData[chatId].participantes;
            const participant = msg.key.participant;
            const participantAlt = msg.key.participantAlt;
            
            const participantJid = findParticipantJid(participant, participantAlt, participantes);
            
            if (!participantJid) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você não está na lista de participantes do amigo secreto!",
                }, { quoted: msg });
                return;
            }

            if (!participantesData[chatId].presentes || !participantesData[chatId].presentes[participantJid]) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você não tem nenhum presente cadastrado!",
                }, { quoted: msg });
                return;
            }

            delete participantesData[chatId].presentes[participantJid];
            await saveParticipantes(participantesData);

            await sock.sendMessage(chatId, {
                text: `✅ Presente removido com sucesso!`,
            }, { quoted: msg });
            return;

        } else if (subComando === 'edit') {
            if (!isGroup) {
                await sock.sendMessage(chatId, {
                    text: "❌ Este comando só pode ser usado em grupos!",
                }, { quoted: msg });
                return;
            }

            const participantesData = await loadParticipantes();
            if (!participantesData[chatId] || !participantesData[chatId].participantes) {
                await sock.sendMessage(chatId, {
                    text: "❌ Nenhum participante adicionado ao amigo secreto ainda!\n\n💡 Use *!amigoSecreto add* primeiro para adicionar participantes.",
                }, { quoted: msg });
                return;
            }

            const participantes = participantesData[chatId].participantes;
            const participant = msg.key.participant;
            const participantAlt = msg.key.participantAlt;
            
            const participantJid = findParticipantJid(participant, participantAlt, participantes);
            
            if (!participantJid) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você não está na lista de participantes do amigo secreto!",
                }, { quoted: msg });
                return;
            }

            const presente = textMessage.slice('!amigosecreto listapresente edit'.length).trim();

            if (!presente) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você precisa especificar o novo presente!\n\n💡 Use: !amigoSecreto listaPresente edit <novo presente>",
                }, { quoted: msg });
                return;
            }

            if (!participantesData[chatId].presentes) {
                participantesData[chatId].presentes = {};
            }

            participantesData[chatId].presentes[participantJid] = presente;
            await saveParticipantes(participantesData);

            await sock.sendMessage(chatId, {
                text: `✅ Presente editado com sucesso!\n\n🎁 Seu desejo: *${presente}*`,
            }, { quoted: msg });
            return;

        } else if (subComando === 'grupo') {
            if (isGroup) {
                await sock.sendMessage(chatId, {
                    text: "❌ Este comando só pode ser usado no privado!",
                }, { quoted: msg });
                return;
            }

            const match = textMessage.match(/grupo\s+["'](.+?)["']/i);
            if (!match) {
                await sock.sendMessage(chatId, {
                    text: "❌ Você precisa especificar o nome do grupo entre aspas!\n\n💡 Use: !amigoSecreto listaPresente grupo \"Nome do Grupo\"",
                }, { quoted: msg });
                return;
            }

            const nomeGrupo = match[1];
            const groupId = await findGroupByName(sock, nomeGrupo);

            if (!groupId) {
                await sock.sendMessage(chatId, {
                    text: `❌ Grupo "${nomeGrupo}" não encontrado!`,
                }, { quoted: msg });
                return;
            }

            const participantesData = await loadParticipantes();
            if (!participantesData[groupId] || !participantesData[groupId].participantes) {
                await sock.sendMessage(chatId, {
                    text: "❌ Nenhum participante adicionado ao amigo secreto neste grupo!",
                }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(groupId);
                const participantes = participantesData[groupId].participantes;
                const presentesGrupo = participantesData[groupId].presentes || {};

                let mensagemLista = `📋 *Lista de Presentes - ${groupMetadata.subject}*\n\n`;

                const participantesComPresente = [];
                const participantesSemPresente = [];

                for (const participante of participantes) {
                    if (presentesGrupo[participante]) {
                        participantesComPresente.push({ jid: participante, presente: presentesGrupo[participante] });
                    } else {
                        participantesSemPresente.push(participante);
                    }
                }

                if (participantesComPresente.length > 0) {
                    mensagemLista += `🎁 *Com presentes:*\n`;
                    participantesComPresente.forEach((item, index) => {
                        mensagemLista += `${index + 1}. @${item.jid.split('@')[0]} - *${item.presente}*\n`;
                    });
                    mensagemLista += `\n`;
                }

                if (participantesSemPresente.length > 0) {
                    mensagemLista += `⚠️ *Ainda não escolheram:*\n`;
                    participantesSemPresente.forEach((jid, index) => {
                        mensagemLista += `${index + 1}. @${jid.split('@')[0]}\n`;
                    });
                }

                const mentions = [
                    ...participantesComPresente.map(item => item.jid),
                    ...participantesSemPresente
                ];

                await sock.sendMessage(chatId, {
                    text: mensagemLista,
                    mentions: mentions
                }, { quoted: msg });

            } catch (error) {
                console.error('Erro ao obter dados do grupo:', error);
                await sock.sendMessage(chatId, {
                    text: "❌ Erro ao obter informações do grupo.",
                }, { quoted: msg });
            }
            return;

        } else {
            if (!isGroup) {
                await sock.sendMessage(chatId, {
                    text: "❌ Este comando só pode ser usado em grupos!\n\n💡 Para usar no privado, use: !amigoSecreto listaPresente grupo \"Nome do Grupo\"",
                }, { quoted: msg });
                return;
            }

            const participantesData = await loadParticipantes();
            if (!participantesData[chatId] || !participantesData[chatId].participantes) {
                await sock.sendMessage(chatId, {
                    text: "❌ Nenhum participante adicionado ao amigo secreto ainda!\n\n💡 Use *!amigoSecreto add* primeiro para adicionar participantes.",
                }, { quoted: msg });
                return;
            }

            const participantes = participantesData[chatId].participantes;
            const presentesGrupo = participantesData[chatId].presentes || {};

            let mensagemLista = `📋 *Lista de Presentes*\n\n`;

            const participantesComPresente = [];
            const participantesSemPresente = [];

            for (const participante of participantes) {
                if (presentesGrupo[participante]) {
                    participantesComPresente.push({ jid: participante, presente: presentesGrupo[participante] });
                } else {
                    participantesSemPresente.push(participante);
                }
            }

            if (participantesComPresente.length > 0) {
                mensagemLista += `🎁 *Com presentes:*\n`;
                participantesComPresente.forEach((item, index) => {
                    mensagemLista += `${index + 1}. @${item.jid.split('@')[0]} - *${item.presente}*\n`;
                });
                mensagemLista += `\n`;
            }

            if (participantesSemPresente.length > 0) {
                mensagemLista += `⚠️ *Ainda não escolheram:*\n`;
                participantesSemPresente.forEach((jid, index) => {
                    mensagemLista += `${index + 1}. @${jid.split('@')[0]}\n`;
                });
            }

            const mentions = [
                ...participantesComPresente.map(item => item.jid),
                ...participantesSemPresente
            ];

            await sock.sendMessage(chatId, {
                text: mensagemLista,
                mentions: mentions
            }, { quoted: msg });
            return;
        }
    }

    if (!admins.includes(sender)) {
        await sock.sendMessage(chatId, {
            text: "❌ Você não tem permissão para usar este comando. Apenas administradores podem usar comandos de amigo secreto.",
        }, { quoted: msg });
        return;
    }

    if (!isGroup) {
        await sock.sendMessage(chatId, {
            text: "❌ Este comando só pode ser usado em grupos!",
        }, { quoted: msg });
        return;
    }

    if (comando === 'add') {
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        const palavras = textMessage.toLowerCase().split(/\s+/);
        const incluirAdmin = palavras.includes('me') || palavras.includes('eu');
        
        let participantesList = [];
        
        let posicaoMe = -1;
        for (let i = 0; i < palavras.length; i++) {
            if (palavras[i] === 'me' || palavras[i] === 'eu') {
                posicaoMe = i;
                break;
            }
        }
        
        if (incluirAdmin) {
            if (posicaoMe === 2) {
                participantesList.push(sender);
                participantesList.push(...mentionedJid);
            } else if (posicaoMe > 2) {
                const posicaoNaLista = Math.min(posicaoMe - 2, mentionedJid.length);
                participantesList.push(...mentionedJid.slice(0, posicaoNaLista));
                participantesList.push(sender);
                participantesList.push(...mentionedJid.slice(posicaoNaLista));
            } else {
                participantesList.push(sender);
                participantesList.push(...mentionedJid);
            }
        } else {
            participantesList = [...mentionedJid];
        }
        
        if (participantesList.length === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ Você precisa marcar os participantes ou escrever 'me'/'eu' para se adicionar!\n\n💡 Use: !amigoSecreto add @participante1 @participante2 ...\n💡 Ou: !amigoSecreto add me @participante1 @participante2 ...",
            }, { quoted: msg });
            return;
        }

        const participantesUnicos = [];
        const vistos = new Set();
        for (const jid of participantesList) {
            if (!vistos.has(jid)) {
                participantesUnicos.push(jid);
                vistos.add(jid);
            }
        }
        
        const participantesData = await loadParticipantes();
        
        let groupName = "Grupo Desconhecido";
        let groupMetadata = null;
        try {
            groupMetadata = await sock.groupMetadata(chatId);
            groupName = groupMetadata.subject || "Grupo Desconhecido";
        } catch (error) {
            console.error('Erro ao obter nome do grupo:', error);
        }
        
        const usersData = await loadUsersData();
        const nomes = {};
        
        participantesUnicos.forEach((jid, index) => {
            const nomeReal = getParticipantName(jid, usersData, contactsCache);
            const numero = jid.split('@')[0];
            nomes[jid] = (nomeReal && nomeReal.trim() && nomeReal !== numero)
                ? nomeReal
                : `Participante ${index + 1}`;
        });
        
        if (!participantesData[chatId]) {
            participantesData[chatId] = {
                groupName: groupName,
                participantes: [],
                presentes: {},
                nomes: {},
                sorteio: null
            };
        }
        participantesData[chatId].groupName = groupName;
        participantesData[chatId].participantes = participantesUnicos;
        participantesData[chatId].nomes = nomes;
        participantesData[chatId].sorteio = null;
        if (!participantesData[chatId].presentes) {
            participantesData[chatId].presentes = {};
        }
        await saveParticipantes(participantesData);

        let mensagemConfirmacao = `✅ *Participantes adicionados ao Amigo Secreto!*\n\n`;
        mensagemConfirmacao += `📋 *Total de participantes:* ${participantesUnicos.length}\n\n`;
        mensagemConfirmacao += `👥 *Participantes:*\n`;
        participantesUnicos.forEach((jid, index) => {
            const numero = jid.split('@')[0];
            const nome = nomes[jid];
            const temNomeReal = nome && nome.trim() && nome !== numero;
            mensagemConfirmacao += `${index + 1}. ${temNomeReal ? nome + ' (@' + numero + ')' : '@' + numero}\n`;
        });
        mensagemConfirmacao += `\n💡 Use *!amigoSecreto sortear* para realizar o sorteio!`;

        await sock.sendMessage(chatId, {
            text: mensagemConfirmacao,
            mentions: participantesUnicos
        }, { quoted: msg });

    } else if (comando === 'sortear') {
        const participantesData = await loadParticipantes();
        const participantes = participantesData[chatId]?.participantes || [];
        const nomes = participantesData[chatId]?.nomes || {};
        const presentes = participantesData[chatId]?.presentes || {};

        if (participantes.length < 2) {
            await sock.sendMessage(chatId, {
                text: "❌ É necessário pelo menos 2 participantes para realizar o sorteio!\n\n💡 Use *!amigoSecreto add* marcando os participantes primeiro.",
            }, { quoted: msg });
            return;
        }

        const sorteio = sortearAmigoSecreto(participantes);

        if (!sorteio) {
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao realizar o sorteio. Tente novamente.",
            }, { quoted: msg });
            return;
        }

        participantesData[chatId].sorteio = sorteio;
        participantesData[chatId].sorteioData = new Date().toISOString();
        await saveParticipantes(participantesData);

        let nomeGrupo = "o grupo";
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            nomeGrupo = groupMetadata.subject || "o grupo";
        } catch (error) {
            console.error('Erro ao obter nome do grupo:', error);
        }

        let sucessos = 0;
        let falhas = 0;

        for (const [participante, amigoSecreto] of Object.entries(sorteio)) {
            try {
                const nomeAmigoSecreto = nomes[amigoSecreto] || amigoSecreto.split('@')[0];
                const presenteDesejado = presentes[amigoSecreto];
                
                let mensagemPV = `🎁 *Amigo Secreto Sorteado!*\n\n` +
                    `📱 *Grupo:* ${nomeGrupo}\n\n` +
                    `🎉 Parabéns! Você foi sorteado para presentear:\n\n` +
                    `👤 *${nomeAmigoSecreto}* (@${amigoSecreto.split('@')[0]})\n`;
                
                if (presenteDesejado) {
                    mensagemPV += `\n🎁 *Presente desejado:* ${presenteDesejado}\n`;
                }
                
                mensagemPV += `\n💝 Boa sorte com o presente!`;

                await sock.sendMessage(participante, { 
                    text: mensagemPV,
                    mentions: [amigoSecreto]
                });
                sucessos++;
                
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Erro ao enviar mensagem para ${participante}:`, error);
                falhas++;
            }
        }

        let mensagemConfirmacao = `✅ *Sorteio realizado com sucesso!*\n\n`;
        mensagemConfirmacao += `📤 Mensagens enviadas: ${sucessos}\n`;
        if (falhas > 0) {
            mensagemConfirmacao += `⚠️ Falhas: ${falhas}\n`;
        }
        mensagemConfirmacao += `\n💬 Todos os participantes receberam no privado quem é seu amigo secreto!\n\n`;
        mensagemConfirmacao += `👥 *Participantes do sorteio:*\n`;
        participantes.forEach((jid, index) => {
            const numero = jid.split('@')[0];
            const nome = nomes[jid];
            const temNomeReal = nome && nome.trim() && nome !== numero;
            mensagemConfirmacao += `${index + 1}. ${temNomeReal ? nome : '@' + numero}\n`;
        });

        await sock.sendMessage(chatId, {
            text: mensagemConfirmacao,
            mentions: participantes
        }, { quoted: msg });

    } else if (comando === 'lista') {
        const participantesData = await loadParticipantes();
        const participantes = participantesData[chatId]?.participantes || [];

        if (participantes.length === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ Nenhum participante adicionado ainda!\n\n💡 Use *!amigoSecreto add* marcando os participantes primeiro.",
            }, { quoted: msg });
            return;
        }

        let mensagemLista = `📋 *Lista de Participantes do Amigo Secreto*\n\n`;
        mensagemLista += `👥 *Total de participantes:* ${participantes.length}\n\n`;
        mensagemLista += `*Participantes:*\n`;
        participantes.forEach((jid, index) => {
            mensagemLista += `${index + 1}. @${jid.split('@')[0]}\n`;
        });
        mensagemLista += `\n💡 Use *!amigoSecreto sortear* para realizar o sorteio!`;

        await sock.sendMessage(chatId, {
            text: mensagemLista,
            mentions: participantes
        }, { quoted: msg });

    } else {
        await sock.sendMessage(chatId, {
            text: `📖 *Como usar o Amigo Secreto:*\n\n` +
                `✅ *!amigoSecreto add* - Marque todos os participantes\n` +
                `   Você pode escrever "me" ou "eu" para se adicionar\n` +
                `📋 *!amigoSecreto lista* - Mostra a lista de participantes\n` +
                `🎁 *!amigoSecreto listaPresente add <presente>* - Adiciona seu desejo de presente\n` +
                `   (Use múltiplas vezes para adicionar mais presentes)\n` +
                `✏️ *!amigoSecreto listaPresente edit <presente>* - Edita seu presente\n` +
                `🗑️ *!amigoSecreto listaPresente delete* - Remove seu presente\n` +
                `📋 *!amigoSecreto listaPresente* - Lista todos os presentes do grupo\n` +
                `📋 *!amigoSecreto listaPresente grupo "nome"* - Lista presentes no PV\n` +
                `🎲 *!amigoSecreto sortear* - Realiza o sorteio e envia no PV de cada um\n\n` +
                `💡 Exemplos:\n` +
                `   !amigoSecreto add @pessoa1 @pessoa2 @pessoa3\n` +
                `   !amigoSecreto add me @pessoa1 @pessoa2\n` +
                `   !amigoSecreto listaPresente add Um livro\n` +
                `   !amigoSecreto listaPresente add Um caderno`,
        }, { quoted: msg });
    }
}

module.exports = amigoSecretoCommandBot;
