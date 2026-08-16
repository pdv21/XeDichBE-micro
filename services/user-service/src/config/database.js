const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    // TiDB Cloud (production) bắt buộc TLS trên Public Endpoint — MySQL local
    // (docker-compose) không cấu hình SSL nên chỉ bật khi production, tránh
    // reject cert self-signed lúc dev.
    ssl: process.env.NODE_ENV === 'production' ? { minVersion: 'TLSv1.2' } : undefined
});

module.exports = pool;
