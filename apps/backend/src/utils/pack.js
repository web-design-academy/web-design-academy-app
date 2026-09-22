const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const path = require("path");
const {ZipArchive} = require("archiver");
const {finished} = require("node:stream/promises");
const crypto = require("node:crypto");

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

    const splitPath = sourcePath.split('/');
    metadata.id = splitPath[splitPath.length - 1];

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

module.exports = {
  packLessons
};
