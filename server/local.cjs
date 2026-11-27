const { createServer } = require('node:http');
const access = require('../api/access.js');

const port = Number(process.env.PORT || 8765);
createServer(access).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
