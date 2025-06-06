const express = require('express')
const client = require('./db');
const cors = require('cors');
const app = express()
const PORT = 3000


app.use(express.json())

app.get('/', (req, res) => {
  res.send('Servidor Express corriendo 🚀');
});


app.use(cors({
  origin: 'http://localhost:5173',
}));


// GET:  obtener los datos post 

app.get('/posts', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM posts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Error al obtener los posts');
  }
});


// POST: Crear un nuevo post



app.post('/posts', async (req, res) => {
  const { titulo, img = null, descripcion } = req.body;

  if (!titulo || !descripcion) {
  return res.status(400).json({ error: 'Faltan campos obligatorios' });
}

  try {
    const result = await client.query(
        'INSERT INTO posts (titulo, img, descripcion, likes) VALUES ($1, $2, $3, $4) RETURNING *',
    [titulo, img, descripcion, 0]
);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear el post:', err);
    res.status(500).send('Error al crear el post');
  }
});



app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});


