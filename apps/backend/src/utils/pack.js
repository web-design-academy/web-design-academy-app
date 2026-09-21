const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const path = require("path");
const {ZipArchive} = require("archiver");
const {finished} = require("node:stream/promises");

async function packLesson(sourcePath, outputPath) {
  const output = fs.createWriteStream(outputPath);
  const archive = new ZipArchive("zip", {
    zlib: 9,
  });

  archive.on("warning", (error) => {
    console.warn("Lesson packing warning: " + error);
  });

  archive.on("error", (error) => {
    console.warn("Lesson packing error: " + error);
  });

  archive.pipe(output);
  archive.directory(sourcePath, false);

  await Promise.all([
    archive.finalize(),
    finished(output)
  ]);

  const lessonName = path.basename(sourcePath);
  const sourceJsonPath = path.join(sourcePath, `${lessonName}.json`);
  const targetJsonPath = outputPath.replace(/\.zip$/i, ".json");

  try {
    await fsAsync.access(sourceJsonPath);
    await fsAsync.copyFile(sourceJsonPath, targetJsonPath);
  } catch (err) {
    console.error(`Copy error: ${err.message}`);
  }
}

async function packLessons(sourceDir, outputDir) {
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
