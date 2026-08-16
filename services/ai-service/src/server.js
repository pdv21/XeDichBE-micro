require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 4005;

app.listen(PORT, () => {
  console.log(`[ai-service] Server is running on port ${PORT}`);
});
