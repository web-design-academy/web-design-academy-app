const router = require('express').Router();
const { authenticateToken } = require("../middleware/auth");
const repository = require("../repositories/repository");
const { getRemoteRepository } = require("../services/github");
const asyncHandler = require("../middleware/asyncError")

router.use(authenticateToken);

router.get("/", asyncHandler(async (req, res) => {
  const page = req.params.page;
  const pageSize = req.params.pageSize;
  const total = await repository.getReposByUserCount(req.user.sub);
  const repositories = await repository.getReposByUser(req.user.sub, parseInt(pageSize), parseInt(page));
  res.json({total, repositories});
}));

router.post("/:id", asyncHandler(async (req, res) => {
  const repoId = req.params.id;
  const remote = await getRemoteRepository(req.user.sub, repoId);

  const savedRepo = await repository.createRepo(req.user.sub, remote);
  res.json(savedRepo);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const repoId = req.params.id;
  await repository.deleteRepo(req.user.sub, repoId);
  res.json({ success: true });
}));

router.get("/checkUpdates", asyncHandler(async (req, res) => {
  const repositories = await repository.getReposByUser(req.user.sub);

  const updatedRepos = [];

  for (const repo of repositories) {
    const remote = await getRemoteRepository(req.user.sub, repo.id);
    if (remote.sha !== repo.sha) {
      console.log("repo update, repo up... " + repo.name);
      updatedRepos.push(await repository.createRepo(req.user.sub, remote));
    }
  }

  res.json(updatedRepos);
}));

module.exports = router;
