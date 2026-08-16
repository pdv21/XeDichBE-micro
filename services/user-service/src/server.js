require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`[user-service] Server is running on port ${PORT}`);
});
