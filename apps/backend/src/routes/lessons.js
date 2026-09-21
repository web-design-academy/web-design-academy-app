const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const environment = require("../config/env");
const ServerError = require("../errors/ServerError");
const router = express.Router();
const asyncHandler = require("../middleware/asyncError")

router.get("/", asyncHandler(async (req, res) => {
  if (!fs.existsSync(environment.cachePath))
    return res.json([]);

  const entries = await fsAsync.readdir(environment.cachePath, {withFileTypes: true});
  const jsons = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json")
  );

  const lessons = await Promise.all(
    jsons.map(async (file) => {
      const slug = path.basename(file.name, ".json");
      const filePath = path.join(environment.cachePath, file.name);

      try {
        const content = await fsAsync.readFile(filePath, "utf-8");
        const metadata = JSON.parse(content.toString());

        console.log({
          slug,
          ...metadata,
        });

        return {
          slug,
          ...metadata,
        };
      } catch (error) {
        return {
          slug
        }
      }
    })
  );

  res.json(lessons);
}));

router.get("/:slug", asyncHandler((req, res) => {
  const slug = req.params.slug;

  if (!/^[a-zA-Z0-9_-]+$/.test(slug))
    throw new ServerError("Invalid lesson slug", 400);

  const lessonPath = path.join(environment.cachePath, `${slug}.zip`);
  if (!fs.existsSync(lessonPath))
    throw new ServerError("Lesson not found", 404);

  res.download(lessonPath, `${slug}.zip`);
}));

module.exports = router;