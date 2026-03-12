const PREFIX = (process.env.BOT_PREFIX || '#').trim() || '#';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PREFIX_REGEX = escapeRegex(PREFIX);

module.exports = {
  PREFIX,
  PREFIX_REGEX,
};

