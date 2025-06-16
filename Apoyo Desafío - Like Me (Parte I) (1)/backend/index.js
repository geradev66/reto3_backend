const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const validator = require('validator');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuración del cliente de PostgreSQL
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'likeme',
  password: '1234',
  port: 5432,
});

client.connect()
  .then(() => console.log('Conexión exitosa a PostgreSQL'))
  .catch(err => console.error('Error de conexión a PostgreSQL:', err.stack));

// Middleware para permitir solicitudes desde el frontend
app.use(cors({
  origin: 'http://localhost:5173',
}));

// Middleware para parsear JSON en las peticiones
app.use(express.json());

// Middleware para servir imágenes estáticas (opcional, si almacenas imágenes localmente)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Endpoint raíz
app.get('/', (req, res) => {
  res.send('Servidor Express corriendo 🚀');
});

// Endpoint para probar la conexión a la base de datos
app.get('/test-db', async (req, res) => {
  try {
    const result = await client.query('SELECT NOW()');
    res.json({ message: 'Conexión exitosa', time: result.rows[0].now });
  } catch (err) {
    console.error('Error en la conexión a la base de datos:', err.stack);
    res.status(500).json({ error: 'Error en la conexión a la base de datos' });
  }
});

// Obtener todos los posts
app.get('/posts', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM posts ORDER BY id DESC');
    console.log('Posts obtenidos:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener los posts:', err.stack);
    res.status(500).json({ error: 'Error al obtener los posts' });
  }
});

// Crear un nuevo post con link de imagen
app.post('/posts', async (req, res) => {
  const { titulo, img, descripcion } = req.body;
  console.log('Cuerpo de la solicitud:', req.body);
  console.log('Valor de img:', img);

  // Validar campos obligatorios
  if (!titulo || !descripcion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: título y descripción son requeridos' });
  }

  // Validar que img sea una URL válida o null
  if (img && !validator.isURL(img)) {
    return res.status(400).json({ error: 'El campo img debe ser una URL válida' });
  }

  try {
    const result = await client.query(
      'INSERT INTO posts (titulo, img, descripcion, likes) VALUES ($1, $2, $3, $4) RETURNING *',
      [titulo, img || null, descripcion, 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear el post:', err.stack);
    res.status(500).json({ error: 'Error al crear el post' });
  }
});

// Aumentar likes
app.put('/posts/like/:id', async (req, res) => {
  const { id } = req.params;

  // Validar que el ID sea un número entero
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'El ID debe ser un número entero' });
  }

  try {
    const result = await client.query(
      'UPDATE posts SET likes = likes + 1 WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar likes:', err.stack);
    res.status(500).json({ error: 'Error al actualizar likes' });
  }
});

// Eliminar post
app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;

  // Validar que el ID sea un número entero
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'El ID debe ser un número entero' });
  }

  try {
    const result = await client.query(
      'DELETE FROM posts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    res.json({ message: 'Post eliminado correctamente', post: result.rows[0] });
  } catch (err) {
    console.error('Error al eliminar el post:', err.stack);
    res.status(500).json({ error: 'Error al eliminar el post' });
  }
});






// Obtener todos los likes
app.get('/like', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM likes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener likes:', err.stack);
    res.status(500).json({ error: 'Error al obtener likes' });
  }
});

// Agregar un nuevo like (por post y usuario)
app.post('/like', async (req, res) => {
  const { post_id, user_id } = req.body;

  if (!post_id || !user_id) {
    return res.status(400).json({ error: 'Se requieren post_id y user_id' });
  }

  try {
    // Opcional: evitar duplicados (like duplicado por mismo usuario al mismo post)
    const existing = await client.query(
      'SELECT * FROM likes WHERE post_id = $1 AND user_id = $2',
      [post_id, user_id]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Ya existe un like para este post y usuario' });
    }

    const result = await client.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) RETURNING *',
      [post_id, user_id]
    );

    // También puedes aumentar el contador de likes en la tabla posts
    await client.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [post_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al insertar like:', err.stack);
    res.status(500).json({ error: 'Error al insertar like' });
  }
});

// Eliminar un like (por id)
app.delete('/like/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener el like antes de eliminarlo
    const like = await client.query('SELECT * FROM likes WHERE id = $1', [id]);

    if (like.rowCount === 0) {
      return res.status(404).json({ error: 'Like no encontrado' });
    }

    const postId = like.rows[0].post_id;

    await client.query('DELETE FROM likes WHERE id = $1', [id]);

    // Disminuir el contador de likes en la tabla posts
    await client.query('UPDATE posts SET likes = likes - 1 WHERE id = $1', [postId]);

    res.json({ message: 'Like eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar like:', err.stack);
    res.status(500).json({ error: 'Error al eliminar like' });
  }
});





// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});



