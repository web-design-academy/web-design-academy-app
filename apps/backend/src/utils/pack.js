const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const path = require("path");
const {ZipArchive} = require("archiver");
const {finished} = require("node:stream/promises");
const crypto = require("node:crypto");
const chokidar = require("chokidar");

async function packLesson(sourcePath, outputPath) {
  const lessonName = path.basename(sourcePath);
  const output = fs.createWriteStream(outputPath);
  const hash = crypto.createHash("sha256");
  const archive = new ZipArchive("zip", {
    zlib: 9,
  });

  archive.on("data", (data) => {
    hash.update(data)
  });

  archive.on("warning", (error) => {
    console.warn("Lesson packing warning: " + error);
  });

  archive.on("error", (error) => {
    console.warn("Lesson packing error: " + error);
  });

  archive.pipe(output);
  archive.directory(sourcePath, lessonName);

  await Promise.all([
    archive.finalize(),
    finished(output)
  ]);

  try {
    const targetJsonPath = outputPath.replace(/\.zip$/i, ".json");
    const sourceBuffer = await fsAsync.readFile(path.join(sourcePath, `${lessonName}.json`));
    const metadata = JSON.parse(sourceBuffer.toString());
    metadata.sha = hash.digest("hex");

    await fsAsync.writeFile(targetJsonPath, JSON.stringify(metadata));
  } catch (err) {
    console.error(`Copy error: ${err.message}`);
  }
}

async function packLessons(sourceDir, outputDir) {
  await fsAsync.rm(outputDir, {recursive: true, force: true});
  await fsAsync.mkdir(outputDir, {recursive: true});
  const entries = await fsAsync.readdir(sourceDir, {withFileTypes: true});

  const directories = entries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith(".")
  );

  for (const directory of directories) {
    const currentPath = path.join(sourceDir, directory.name);
    const destination = path.join(outputDir, `${directory.name}.zip`);
    await packLesson(currentPath, destination);
  }

  console.log("Successfully packed all lessons");
}

function watchLessons(sourceDir, outputDir, debounceMs = 500) {
  const debounce = new Map();

  const watcher = chokidar.watch(sourceDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on("all", (event, filePath) => {
    const lessonName = path.relative(sourceDir, filePath).split(path.sep)[0];
    if (!lessonName)
      return;

    if (debounce.has(lessonName))
      clearTimeout(debounce.get(lessonName));

    const timer = setTimeout(async () => {
      debounce.delete(lessonName);

      const sourcePath = path.join(sourceDir, lessonName);
      const destination = path.join(outputDir, `${lessonName}`);

      try {
        const stat = await fsAsync.stat(sourcePath);
        if (stat.isDirectory()) {
          await packLesson(sourcePath, `${destination}.zip`);
          console.log(`Repacked lesson ${lessonName}`);
        }
      } catch {
        try {
          await fsAsync.rm(`${destination}.zip`);
        } catch (e) {
        }

        try {
          await fsAsync.rm(`${destination}.json`);
        } catch (e) {
        }
        console.log(`Deleted lesson ${lessonName}`);
      }
    }, debounceMs);

    debounce.set(lessonName, timer);
  });
}

module.exports = {
  packLessons,
  watchLessons
};
