const asyncError = (asyncFun) => (req, res, next) => {
  Promise.resolve(asyncFun(req, res, next)).catch(next);
};

module.exports = asyncError;
