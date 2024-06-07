const express = require('express');
const bodyParser = require('body-parser'); 
const routes = require('./routes');

const app = express();
const port = 3000;

// Middleware for parsing JSON requests
app.use(bodyParser.json()); 

// Use routes defined in routes.js
app.use('/api', routes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
