require("dotenv").config();
const { db, initDb } = require("./config/db");
const environment = require("./config/env");
const {packLessons} = require("./utils/pack");
const fs = require("fs");

try {
  initDb();
  environment.validate();
} catch (error) {
  console.error("Server initialization error:", error);
  process.exit(1);
}

if (!fs.existsSync(environment.lessonsPath)) {
  fs.mkdirSync(environment.lessonsPath, {recursive: true});
}

if (!fs.existsSync(environment.cachePath)) {
  fs.mkdirSync(environment.cachePath, {recursive: true});
}

packLessons(environment.lessonsPath, environment.cachePath).catch((error) => {
  console.log("Error processing lessons: ", error);
  process.exit(1);
});

const app = require("./app");

const server = app.listen(environment.port, "0.0.0.0", () => {
  console.log(`Server running on port ${environment.port}`);
});

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch (error) {
      console.error("Error closing database:", error);
    }
    process.exit(0);
  })

  setTimeout(() => {
    console.error("Force shutdown");
    process.exit(1);
  }, 5000)
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
