const fs = require('fs');
const path = require('path');
const { swaggerSpec } = require('./swagger');

const destination = path.join(__dirname, '..', '..', 'openapi.json');
fs.writeFileSync(destination, JSON.stringify(swaggerSpec, null, 2));
console.log(`Wrote ${destination}`);
