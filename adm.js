require("dotenv").config();

module.exports = {
    admins: process.env.ADMINS
        ? process.env.ADMINS.split(",").map(num => num.trim() + "@s.whatsapp.net")
        : []
};
