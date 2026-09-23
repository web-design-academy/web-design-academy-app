function logger(req, res, next) {
  const url = req.url;
  res.on('finish', () => {
    console.log(`--> Request to ${req.method} ${url} with response ${res.statusCode}`);
  });
  next();
}

module.exports = logger;
