const path = require('path');
const sharp = require('sharp');
const { PREFIX, PREFIX_REGEX } = require('../config/prefix');

// Configuração estática dos templates de meme
// Para adicionar novos templates, basta incluir novos objetos neste array.
const TEMPLATE_DEFINITIONS = [
  {
    id: 'kratos',
    command: 'kratos',
    basePath: path.join(
      __dirname,
      '..',
      'templates',
      'memes',
      'kratos',
      'Kratos.jpg',
    ),
    maskPath: path.join(
      __dirname,
      '..',
      'templates',
      'memes',
      'kratos',
      'KratosEDIT.jpg',
    ),
    colorMap: {
      // Cores exatas usadas na máscara:
      // vermelho FF0500 -> (255, 5, 0)
      // verde 00FF3E -> (0, 255, 62)
      image: { r: 255, g: 5, b: 0 }, // área vermelha para encaixar a foto
      text_main: { r: 0, g: 255, b: 62 }, // área verde para o texto
      text_center: { r: 0, g: 91, b: 255 }, // ponto azul indicando centro visual do texto
    },
  },
];

// Cache em memória para evitar reprocessar máscaras em cada chamada
const templateCache = {};

async function loadTemplateDefinition(templateId) {
  const definition = TEMPLATE_DEFINITIONS.find((t) => t.id === templateId);
  if (!definition) {
    throw new Error(`Template de meme não encontrado: ${templateId}`);
  }
  return definition;
}

/**
 * Dado um caminho de máscara e um mapa de cores, calcula os bounding boxes
 * para cada cor relevante.
 *
 * Retorna algo como:
 * {
 *   image: { x, y, width, height },
 *   text_main: { x, y, width, height },
 * }
 */
async function computeRegionsFromMask(maskPath, colorMap) {
  const image = sharp(maskPath);
  const { width, height } = await image.metadata();

  // Lê pixels como dados brutos RGBA
  const raw = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: false });

  const regions = {};

  // Inicializa limites para cada cor
  Object.keys(colorMap).forEach((key) => {
    regions[key] = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
  });

  // Percorre todos os pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      const a = raw[idx + 3];

      // Ignora pixels totalmente transparentes
      if (a === 0) continue;

      for (const [regionKey, color] of Object.entries(colorMap)) {
        // Usamos uma pequena tolerância por causa da compressão JPEG
        const tolerance = 40;
        const isMatch =
          Math.abs(r - color.r) <= tolerance &&
          Math.abs(g - color.g) <= tolerance &&
          Math.abs(b - color.b) <= tolerance;

        if (isMatch) {
          const region = regions[regionKey];
          if (x < region.minX) region.minX = x;
          if (y < region.minY) region.minY = y;
          if (x > region.maxX) region.maxX = x;
          if (y > region.maxY) region.maxY = y;
        }
      }
    }
  }

  // Converte limites em caixas finais e remove regiões não utilizadas
  const finalRegions = {};

  for (const [key, bounds] of Object.entries(regions)) {
    if (
      bounds.minX === Infinity ||
      bounds.minY === Infinity ||
      bounds.maxX === -Infinity ||
      bounds.maxY === -Infinity
    ) {
      // Nenhum pixel com essa cor foi encontrado; ignorar região
      continue;
    }

    finalRegions[key] = {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
    };
  }

  // Também loga no console para depuração em runtime
  console.log('[MEME TEMPLATE] Máscara processada:', {
    maskPath,
    width,
    height,
    regionKeys: Object.keys(finalRegions),
    regions: finalRegions,
  });

  // #region agent log
  fetch('http://127.0.0.1:7318/ingest/b4c0730a-0fc4-4150-81cd-58837ff2aca9', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '5ff40e',
    },
    body: JSON.stringify({
      sessionId: '5ff40e',
      runId: 'computeRegions',
      hypothesisId: 'H-path-or-colors',
      location: 'memeTemplateService.js:90',
      message: 'Regiões calculadas a partir da máscara',
      data: {
        maskPath,
        width,
        height,
        regionKeys: Object.keys(finalRegions),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return finalRegions;
}

async function getTemplate(templateId) {
  if (templateCache[templateId]) {
    return templateCache[templateId];
  }

  const definition = await loadTemplateDefinition(templateId);

  const regions = await computeRegionsFromMask(
    definition.maskPath,
    definition.colorMap,
  );

  const template = {
    id: definition.id,
    command: definition.command,
    basePath: definition.basePath,
    regions,
  };

  templateCache[templateId] = template;
  return template;
}

function getTemplateByCommand(commandText) {
  const text = (commandText || '').trim().toLowerCase();
  const def = TEMPLATE_DEFINITIONS.find((t) => {
    const base = t.command.toLowerCase();
    return (
      text.startsWith(PREFIX.toLowerCase() + base)
    );
  });
  return def ? def.id : null;
}

module.exports = {
  getTemplate,
  getTemplateByCommand,
};

