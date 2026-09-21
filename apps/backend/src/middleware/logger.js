function logger(req, res, next) {
  res.on('finish', () => {
    console.log(`--> Request to ${req.method} ${req.url} with response ${res.statusCode}`);
  });
  next();
}

module.exports = logger;
