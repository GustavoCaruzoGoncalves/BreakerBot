const axios = require('axios');
const cheerio = require('cheerio');

const API_KEY = 'REMOVED';
const searchResults = new Map();

function formatarLetraTextoCru(texto) {
  return texto
    .replace(/Translations\s*(?:[\s\S]*?)?Baby Lyrics\s*/i, '')
    .replace(/^\s*\d+\s+Contributors\s*/i, '')
    .replace(/\[Produced by[^\]]*\]/i, '')
    .replace(/\[([^\]]+)\]/g, '\n\n[$1]')
    .replace(/([a-z])([A-Z])/g, '$1\n$2')
    .replace(/([.?!])(?=\S)/g, '$1 ')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .slice(0, 4000);
}

async function lyricsCommandsBot(sock, { messages }) {
  const msg = messages[0];
  if (!msg.message || !msg.key.remoteJid) return;

  const sender = msg.key.remoteJid;
  const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

  if (textMessage.toLowerCase().startsWith('!lyrics escolha')) {
    const numeroEscolha = parseInt(textMessage.split(' ')[2], 10);
    if (isNaN(numeroEscolha)) {
      await sock.sendMessage(sender, {
        text: '❗ Número inválido. Use: *!lyrics escolha 1*',
      }, { quoted: msg });
      return;
    }

    const resultados = searchResults.get(sender);
    if (!resultados || !resultados[numeroEscolha - 1]) {
      await sock.sendMessage(sender, {
        text: '❗ Escolha inválida ou resultados expirados. Tente buscar novamente.',
      }, { quoted: msg });
      return;
    }

    const musicaSelecionada = resultados[numeroEscolha - 1].result;
    const songId = musicaSelecionada.id;

    try {
      const songRes = await axios.get(`https://api.genius.com/songs/${songId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      const embedContent = songRes.data.response.song.embed_content;
      const regexLink = /<a href='([^']+)'/;
      const match = embedContent.match(regexLink);
      const musicLink = match ? match[1] : null;

      if (!musicLink) {
        await sock.sendMessage(sender, {
          text: '❌ Não foi possível obter a letra da música.',
        }, { quoted: msg });
        return;
      }

      const pageRes = await axios.get(musicLink);
      const $ = cheerio.load(pageRes.data);

      let lyrics = '';

      $('.Lyrics__Container, [data-lyrics-container="true"]').each((_, el) => {
        const verso = $(el).text().trim();
        if (verso) lyrics += verso + '\n\n';
      });

      lyrics = lyrics.trim();

      if (!lyrics) {
        await sock.sendMessage(sender, {
          text: '❌ Não foi possível extrair a letra. Talvez esteja protegida.',
        }, { quoted: msg });
        return;
      }

      const letraFormatada = formatarLetraTextoCru(lyrics);

      await sock.sendMessage(sender, {
        text: `🎵 *${musicaSelecionada.title}* - ${musicaSelecionada.primary_artist.name}\n\n*Versão Com Formatação:*\n\n${letraFormatada}`,
      }, { quoted: msg });

    } catch (error) {
      console.error(error);
      await sock.sendMessage(sender, {
        text: '❌ Erro ao carregar a letra. Tente novamente mais tarde.',
      }, { quoted: msg });
    }
    return;
  }

  if (!textMessage.toLowerCase().startsWith('!lyrics')) return;

  const query = textMessage.slice('!lyrics'.length).trim();
  const regex = /"([^"]+)"/g;
  const matches = [];
  let match;

  while ((match = regex.exec(query)) !== null) matches.push(match[1]);
  if (matches.length !== 2) {
    await sock.sendMessage(sender, {
      text: '❗ Use o formato correto: *!lyrics "nome do cantor" "nome da música"*',
    }, { quoted: msg });
    return;
  }

  const artist = matches[0].trim();
  const title = matches[1].trim();

  try {
    const searchRes = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(title + ' ' + artist)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const hits = searchRes.data.response.hits;
    if (!hits || hits.length === 0) {
      await sock.sendMessage(sender, {
        text: '🔍 Música não encontrada. Verifique o nome do artista e da música.',
      }, { quoted: msg });
      return;
    }

    searchResults.set(sender, hits);

    const lista = hits
      .slice(0, 10)
      .map((hit, i) => `*${i + 1}.* ${hit.result.title} - ${hit.result.primary_artist.name}`)
      .join('\n');

    await sock.sendMessage(sender, {
      text: `🎵 Resultados encontrados:\n\n${lista}\n\nResponda com *!lyrics escolha N* para ver a letra.`,
    }, { quoted: msg });
  } catch (error) {
    console.error(error);
    await sock.sendMessage(sender, {
      text: '❌ Erro ao buscar músicas. Tente novamente mais tarde.',
    }, { quoted: msg });
  }
}

module.exports = lyricsCommandsBot;
