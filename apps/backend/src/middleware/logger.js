function logger(req, res, next) {
  const url = req.url;

  console.log(`--> Request to ${req.method} ${url}`);
  res.on('finish', () => {
    console.log(`<-- Response ${res.statusCode} to ${req.method} ${url}`);
  });
  next();
}

module.exports = logger;
