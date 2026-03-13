const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { default: axios } = require('axios');
const memeTemplateService = require('../../services/memeTemplateService');
const features = require('../../config/features');

async function memeCommandsBot(sock, { messages }) {
  const msg = messages[0];
  if (!msg.message || !msg.key.remoteJid) return;

  if (!features.media?.memes?.enabled) return;

  const sender = msg.key.remoteJid;
  const messageType = Object.keys(msg.message)[0];

  const isImage = messageType === 'imageMessage';
  const isReplyToImage =
    msg.message.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage;
  const mentionedJid =
    msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  const messageWithText =
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.extendedTextMessage?.text ||
    msg.message.conversation ||
    '';

  const { PREFIX } = require('../../config/prefix');
  const kratosCommand = `${PREFIX}kratos`;

  if (!messageWithText.startsWith(kratosCommand)) {
    return;
  }

  let userText = messageWithText.replace(kratosCommand, '').trim();

  // Se houver menção, remove o primeiro token que começa com '@' do texto
  if (mentionedJid) {
    userText = userText.replace(/^@\S+\s*/i, '').trim();
  }

  if (!isImage && !isReplyToImage && !mentionedJid) {
    await sock.sendMessage(
      sender,
      {
        text:
          `Envie/responda uma imagem com \`${kratosCommand} <texto>\` ou use \`${kratosCommand} @usuario <texto>\` para usar a foto de perfil.`,
      },
      { quoted: msg },
    );
    return;
  }

  try {
    let mediaBuffer;

    if (isImage || isReplyToImage) {
      let mediaMessage;

      if (isImage) {
        mediaMessage = msg.message.imageMessage;
      } else if (isReplyToImage) {
        mediaMessage =
          msg.message.extendedTextMessage.contextInfo.quotedMessage
            .imageMessage;
      }

      mediaBuffer = await downloadMediaMessage(
        { message: { imageMessage: mediaMessage } },
        'buffer',
      );
    } else if (mentionedJid) {
      try {
        const url = await sock
          .profilePictureUrl(mentionedJid, 'image')
          .catch(() => null);

        if (!url) {
          await sock.sendMessage(
            sender,
            {
              text:
                'Não consegui pegar a foto de perfil desse usuário. Tente enviar uma imagem manualmente.',
            },
            { quoted: msg },
          );
          return;
        }

        const response = await axios.get(url, {
          responseType: 'arraybuffer',
        });
        mediaBuffer = Buffer.from(response.data);
      } catch (e) {
        console.error(
          '[ERRO] Falha ao baixar foto de perfil para kratos:',
          e,
        );
        await sock.sendMessage(
          sender,
          {
            text:
              'Erro ao baixar a foto de perfil. Tente de novo ou envie uma imagem manualmente.',
          },
          { quoted: msg },
        );
        return;
      }
    }

    if (!mediaBuffer) {
      await sock.sendMessage(
        sender,
        { text: 'Erro ao baixar a imagem. Tente novamente!' },
        { quoted: msg },
      );
      return;
    }

    const templateId = memeTemplateService.getTemplateByCommand(messageWithText);
    if (!templateId) {
      await sock.sendMessage(
        sender,
        { text: 'Template de meme não configurado para este comando.' },
        { quoted: msg },
      );
      return;
    }

    const template = await memeTemplateService.getTemplate(templateId);

    const imageRegion = template.regions.image;
    const textRegion = template.regions.text_main;
    const textCenterRegion = template.regions.text_center;

    if (!imageRegion || !textRegion) {
      await sock.sendMessage(
        sender,
        {
          text: 'Template de meme inválido. Regiões de imagem ou texto não encontradas.',
        },
        { quoted: msg },
      );
      return;
    }

    // Redimensiona a imagem do usuário preservando proporção
    const resizedUserBuffer = await sharp(mediaBuffer)
      .resize(imageRegion.width, imageRegion.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    // Descobre o tamanho final da imagem redimensionada
    const resizedMeta = await sharp(resizedUserBuffer).metadata();
    const userWidth = resizedMeta.width || imageRegion.width;
    const userHeight = resizedMeta.height || imageRegion.height;

    // Centraliza dentro do retângulo da área vermelha
    const canvasWidth = imageRegion.width;
    const canvasHeight = imageRegion.height;

    const offsetLeft = Math.round((canvasWidth - userWidth) / 2);
    const offsetTop = Math.round((canvasHeight - userHeight) / 2);

    // Cria um canvas transparente do tamanho da região e coloca a imagem centralizada
    const userImageResized = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: resizedUserBuffer,
          left: offsetLeft,
          top: offsetTop,
        },
      ])
      .png()
      .toBuffer();

    const textToRender =
      userText.length > 0 ? userText : 'Kratos está sem palavras...';

    const svg = createTextSvg(
      textRegion.width,
      textRegion.height,
      textToRender,
    );

    const svgBuffer = Buffer.from(svg);

    let textLeft = textRegion.x;
    let textTop = textRegion.y;

    if (textCenterRegion) {
      const centerX =
        textCenterRegion.x + Math.floor(textCenterRegion.width / 2);
      const centerY =
        textCenterRegion.y + Math.floor(textCenterRegion.height / 2);

      textLeft = Math.round(centerX - textRegion.width / 2);
      textTop = Math.round(centerY - textRegion.height / 2);
    }

    const composed = await sharp(template.basePath)
      .composite([
        {
          input: userImageResized,
          left: imageRegion.x,
          top: imageRegion.y,
        },
        {
          input: svgBuffer,
          left: textLeft,
          top: textTop,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    await sock.sendMessage(
      sender,
      {
        image: composed,
      },
      { quoted: msg },
    );
  } catch (err) {
    console.error('[ERRO] Falha ao gerar meme kratos:', err);
    await sock.sendMessage(
      sender,
      { text: 'Erro ao gerar o meme do Kratos. Tente novamente mais tarde.' },
      { quoted: msg },
    );
  }
}

function escapeSvgText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTextSvg(width, height, text) {
  const safeText = escapeSvgText(text);

  // Quebra o texto em múltiplas linhas para caber melhor no balão
  const maxCharsPerLine = 16;
  const words = safeText.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const tspans = lines
    .map((line, idx) => {
      const dy = idx === 0 ? '0' : '1.2em';
      return `<tspan x="50%" dy="${dy}">${line}</tspan>`;
    })
    .join('');

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text {
      fill: white;
      font-family: 'Impact', 'Arial Black', sans-serif;
      font-size: 32px;
      font-weight: bold;
      paint-order: stroke;
      stroke: black;
      stroke-width: 3px;
    }
  </style>
  <rect width="100%" height="100%" fill="transparent" />
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="text">
    ${tspans}
  </text>
</svg>
`;
}

module.exports = memeCommandsBot;

