require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 4003;

app.listen(PORT, () => {
  console.log(`[transport-service] Server is running on port ${PORT}`);
});
