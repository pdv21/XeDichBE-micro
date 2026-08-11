require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[api-gateway] Server is running on port ${PORT}`);
});
