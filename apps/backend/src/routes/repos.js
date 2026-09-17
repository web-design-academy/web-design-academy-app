const router = require('express').Router();
const { authenticateToken } = require("../middleware/auth");
const repository = require("../repositories/repo");
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

module.exports = router;
