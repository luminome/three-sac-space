const express = require('express');
const app = express();
const config = require('./config');
const port = process.env.PORT || config.default_port;

const pack = require(`${process.cwd()}/package.json`);

app.use(express.static('production/dist'));
app.use(express.static('production/static'));

app.listen(port, () => {
  console.log(`${pack.name} app listening at http://localhost:${port}`);
});
