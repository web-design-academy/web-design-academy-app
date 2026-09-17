const crypto = require('crypto');
const { ServerError } = require('../errors/ServerError');

const ALGORITHM = 'aes-256-GCM';
const IV_LENGTH = 12;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

function encrypt(input) {
    const vector = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, vector);

    const encrypted = cipher.update(input, "utf8", "hex") + cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${vector.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(input) {
    const parts = input.split(":");
    if (parts.length !== 3) {
        throw new ServerError("Invalid input. Expected: iv:authTag:encrypted", 400);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(parts[0], "hex"), parts[2]);
    decipher.setAuthTag(Buffer.from(parts[1], "hex"));
    return decipher.update(parts[2], "hex", "utf8") + decipher.final("utf8");
}

module.exports = { encrypt, decrypt };
