/**
 * Parses a comma-separated list of emails into an array of lowercased emails.
 * @param value Value to be parsed.
 * @param separator Separator character for splitting the input string. Default is ','.
 * @returns {string[]} Array of lowercased strings.
 */
function parseToLowerCase(value, separator = ',') {
  if (!value || typeof value !== "string") return undefined;
  return value
    .split(separator)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Parses a comma-separated list of values into an array of values, preserving the original case.
 * @param value {string} Value to be parsed.
 * @param separator {string} Separator character for splitting the input string. Default is ','.
 * @returns {string[]} Array of strings, preserving the original case.
 */
function parseKeepCase(value, separator = ',') {
  if (!value || typeof value !== "string") return undefined;
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Indicates whether the application is running in production mode.
 * @type {boolean}
 */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Google client ID for OAuth authentication.
 * @type {string}
 */
const googleClientId = process.env.GOOGLE_CLIENT_ID;

/**
 * GitHub client ID and secret for OAuth authentication.
 * @type {string}
 */
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

/**
 * Email domains allowed for registration, separated by commas.
 * @type {string[]}
 */
const allowedDomainsArray = parseToLowerCase(process.env.EMAIL_DOMAINS, '/') ?? [];
const allowedDomains = new Set(allowedDomainsArray);

/**
 * Emails used to identify admin users, separated by commas.
 * @type {string[]}
 */
const adminEmailsArray = parseToLowerCase(process.env.ADMIN_EMAILS);
const adminEmails = new Set(adminEmailsArray);

/**
 * Secret key for JWT authentication.
 * @type {string}
 */
const jwtSecret = process.env.JWT_SECRET;

/**
 * Expiration time for JWT tokens.
 * @type {string}
 */
const jwtExpiration = process.env.JWT_EXPIRATION ?? "7d";

/**
 * Encryption key for sensitive data.
 * @type {string}
 */
const encryptionKey = process.env.ENCRYPTION_KEY;

/**
 * CORS origins allowed for API requests.
 * @type {string[]}
 */
const corsOriginsArray = parseKeepCase(process.env.CORS_ORIGINS) ?? ["http://localhost:5173", "http://127.0.0.1:5173", "https://webdesignacademy.org"];
const corsOrigins = new Set(corsOriginsArray);

/**
 * Base URL for the application.
 * Used to construct URLs for API requests, etc.
 * @type {string}
 */
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * Frontend URL for the application.
 * @type {string}
 */
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

/**
 * Port number for the application.
 * @type {number}
 */
const port = process.env.PORT ?? 3000;

/**
 * SQLite database file path.
 * Relative to the backend directory.
 * @type {string}
 */
const dbPath = process.env.DB_PATH ?? "./storage/db.sqlite";

/**
 * Name of the cookie used for session management.
 * @type {string}
 */
const cookieName = process.env.COOKIE_NAME ?? "wda_session";

/**
 * Validates the environment variables.
 */
function validate() {
  if (isProduction) {
    if (!googleClientId) {
      throw new Error("GOOGLE_CLIENT_ID is not set in production mode");
    }
    if (!githubClientId) {
      throw new Error("GITHUB_CLIENT_ID is not set in production mode");
    }
    if (!githubClientSecret) {
      throw new Error("GITHUB_CLIENT_SECRET is not set in production mode");
    }
  }

  if (!adminEmails || adminEmails.size === 0) {
    throw new Error("ADMIN_EMAILS is not set");
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET is not set or too short (minimum 32 characters)");
  }
  if (!jwtExpiration) {
    throw new Error("JWT_EXPIRATION is not set");
  }
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("ENCRYPTION_KEY is not set or too short (minimum 32 characters)");
  }
  if (!corsOrigins || corsOrigins.size === 0) {
    throw new Error("CORS_ORIGINS is not set");
  }
  if (!baseUrl) {
    throw new Error("BASE_URL is not set");
  }
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not set");
  }
  if (!port) {
    throw new Error("PORT is not set");
  }
  if (!dbPath) {
    throw new Error("DB_PATH is not set");
  }
  if (!cookieName) {
    throw new Error("COOKIE_NAME is not set");
  }
}

module.exports = {
  isProduction,
  googleClientId,
  githubClientId,
  githubClientSecret,
  allowedDomains,
  adminEmails,
  jwtSecret,
  jwtExpiration,
  encryptionKey,
  corsOrigins,
  baseUrl,
  frontendUrl,
  port,
  dbPath,
  cookieName,
  validate,
}
