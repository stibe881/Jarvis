const fs = require('fs');
fs.writeFileSync('test.env', 'TEST_KEY="new_value"');
process.env.TEST_KEY = "";
const dotenv = require('dotenv');
dotenv.config({ path: 'test.env' });
console.log('TEST_KEY is:', process.env.TEST_KEY);
