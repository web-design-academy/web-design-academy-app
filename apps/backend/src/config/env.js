const {resolve} = require("node:path");

class Environment {
    /**
     * Indicates whether the application is running in production mode.
     * @type {boolean}
     */
    static isProduction = process.env.NODE_ENV === "production";
    /**
     * Google client ID for OAuth authentication.
     * @type {string}
     */
    static googleClientId = process.env.GOOGLE_CLIENT_ID;
    static googleAllowed = !!this.googleClientId;
    /**
     * GitHub app name, client ID and secret for GitHub App authentication.
     * @type {string}
     */
    static githubAppName = process.env.GITHUB_APP_NAME;
    static githubClientId = process.env.GITHUB_CLIENT_ID;
    static githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
    static githubAllowed = !!this.githubAppName && !!this.githubClientSecret && !!this.githubClientId;
    /**
     * Email domains allowed for registration, separated by commas.
     * @type {string[]}
     */
    static allowedDomainsArray = this.parseToLowerCase(process.env.EMAIL_DOMAINS, '/') ?? [];
    static allowedDomains = new Set(this.allowedDomainsArray);
    /**
     * Emails used to identify admin users, separated by commas.
     * @type {string[]}
     */
    static adminEmailsArray = this.parseToLowerCase(process.env.ADMIN_EMAILS);
    static adminEmails = new Set(this.adminEmailsArray);
    /**
     * Encryption key for sensitive data.
     * @type {string}
     */
    static encryptionKey = process.env.ENCRYPTION_KEY;
    /**
     * Secret key for JWT authentication.
     * @type {string}
     */
    static jwtSecret = process.env.JWT_SECRET;
    /**
     * Expiration time for JWT tokens.
     * @type {string}
     */
    static jwtExpiration = process.env.JWT_EXPIRATION ?? "7d";
    /**
     * CORS origins allowed for API requests.
     * @type {string[]}
     */
    static corsOriginsArray = this.parseKeepCase(process.env.CORS_ORIGINS) ?? ["http://localhost:5173", "http://127.0.0.1:5173", "https://webdesignacademy.org"];
    static corsOrigins = new Set(this.corsOriginsArray);
    /**
     * Base URL for the application.
     * Used to construct URLs for API requests, etc.
     * @type {string}
     */
    static baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
    /**
     * Frontend URL for the application.
     * @type {string}
     */
    static frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    /**
     * Port number for the application.
     * @type {number}
     */
    static port = process.env.PORT ?? 3000;
    /**
     * Name of the cookie used for session management.
     * @type {string}
     */
    static cookieName = process.env.COOKIE_NAME ?? "wda_session";
    /**
     * SQLite database file path.
     * @type {string}
     */
    static dbPath = process.env.DB_PATH ? resolve(__dirname, "../../", dbPath) : resolve(__dirname, "../../storage/db.sqlite");
    /**
     *
     * @type {string}
     */
    static lessonsPath = process.env.LESSONS_PATH ? resolve(__dirname, "../../", lessonsPath) : resolve(__dirname, "../../lessons");
    /**
     *
     * @type {string}
     */
    static cachePath = process.env.LESSONS_PATH ? resolve(__dirname, "../../", cachePath) : resolve(__dirname, "../../cache");

    /**
     * Parses a comma-separated list of emails into an array of lowercased emails.
     * @param value Value to be parsed.
     * @param separator Separator character for splitting the input string. Default is ','.
     * @returns {string[]} Array of lowercased strings.
     */
    static parseToLowerCase(value, separator = ',') {
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
    static parseKeepCase(value, separator = ',') {
        if (!value || typeof value !== "string") return undefined;
        return value
            .split(separator)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    /**
     * Validates the environment variables.
     */
    static validate() {
        if (this.isProduction) {
            if (!this.googleClientId) {
                throw new Error("GOOGLE_CLIENT_ID is not set in production mode");
            }
            if (!this.githubAppName) {
                throw new Error("GITHUB_APP_NAME is not set in production mode");
            }
            if (!this.githubClientId) {
                throw new Error("GITHUB_CLIENT_ID is not set in production mode");
            }
            if (!this.githubClientSecret) {
                throw new Error("GITHUB_CLIENT_SECRET is not set in production mode");
            }
        }

        if (!this.adminEmails || this.adminEmails.size === 0) {
            throw new Error("ADMIN_EMAILS is not set");
        }
        if (!this.jwtSecret || this.jwtSecret.length < 32) {
            throw new Error("JWT_SECRET is not set or too short (minimum 32 characters)");
        }
        if (!this.jwtExpiration) {
            throw new Error("JWT_EXPIRATION is not set");
        }
        if (!this.encryptionKey || this.encryptionKey.length < 32) {
            throw new Error("ENCRYPTION_KEY is not set or too short (minimum 32 characters)");
        }
        if (!this.corsOrigins || this.corsOrigins.size === 0) {
            throw new Error("CORS_ORIGINS is not set");
        }
        if (!this.baseUrl) {
            throw new Error("BASE_URL is not set");
        }
        if (!this.frontendUrl) {
            throw new Error("FRONTEND_URL is not set");
        }
        if (!this.port) {
            throw new Error("PORT is not set");
        }
        if (!this.dbPath) {
            throw new Error("DB_PATH is not set");
        }
        if (!this.cookieName) {
            throw new Error("COOKIE_NAME is not set");
        }
        if (!this.lessonsPath) {
            throw new Error("LESSONS_PATH is not set");
        }
        if (!this.cachePath) {
            throw new Error("CACHE_PATH is not set");
        }
    }
}

module.exports = Environment;
