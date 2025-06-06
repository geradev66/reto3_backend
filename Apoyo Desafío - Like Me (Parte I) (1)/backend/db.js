const {Client} = require('pg');
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'likeme',
    password: '1234',
    port: 5432,
});
client.connect()
.then(() => console.log('Conexión exitosa a PostgreSQL'))
.catch(err => console.error('Error de conexión', err.stack));

module.exports = client;  // <-- Exporta el cliente