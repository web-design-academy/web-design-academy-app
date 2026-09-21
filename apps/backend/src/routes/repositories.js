const router = require('express').Router();
const { authenticateToken } = require("../middleware/auth");
const repository = require("../repositories/repository");
const { getRemoteRepository } = require("../services/github");
const asyncHandler = require("../middleware/asyncError")

router.use(authenticateToken);

router.get("/", asyncHandler(async (req, res) => {
  const repositories = await repository.getReposByUser(req.user.sub);
  res.json(repositories);
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

router.get("/updates", asyncHandler(async (req, res) => {
  const repositories = await repository.getReposByUser(req.user.sub);

  const updatableRepos = [];

  for (const repo of repositories) {
    const remote = await getRemoteRepository(req.user.sub, repo.id);
    if (remote.pushed_at > repo.pushed_at || remote.updated_at > repo.updated_at) {
      console.log("repo update, repo up... " + repo.name);
      updatableRepos.push(remote);
    }
  }

  res.json(updatableRepos);
}));

router.get("/updates/:id", asyncHandler(async (req, res) => {
  const repoId = req.params.id;
  const remote = await getRemoteRepository(req.user.sub, repoId);
  const updated = repository.updateRepo(req.user.sub, repoId, remote);
  res.json(updated);
}));

module.exports = router;
