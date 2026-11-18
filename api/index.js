const app = require('../dist/app');

module.exports = (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const originalPath = requestUrl.searchParams.get('__vercel_path');

  if (originalPath) {
    requestUrl.searchParams.delete('__vercel_path');
    req.url = `${originalPath}${requestUrl.search}`;
  }

  return app(req, res);
};
