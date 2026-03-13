require("dotenv").config();

if (!process.env.BOT_PREFIX) {
  throw new Error(
    "BOT_PREFIX não definido no ambiente. Configure BOT_PREFIX no arquivo .env.",
  );
}

const PREFIX = process.env.BOT_PREFIX;

module.exports = { PREFIX };

