const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware per autenticazione
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di accesso richiesto' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
};

// Route di login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono richiesti' });
  }

  const db = req.app.locals.db;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Password comparison error:', err);
        return res.status(500).json({ error: 'Errore di autenticazione' });
      }
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    });
  });
});

// Route per logout
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout effettuato con successo' });
});

// Route per il profilo utente
router.get('/profile', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  
  db.get('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json(user);
  });
});

// Route per dashboard stats
router.get('/dashboard/stats', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  
  const queries = [
    'SELECT COUNT(*) as total_jobs FROM jobs',
    'SELECT COUNT(*) as pending_jobs FROM jobs WHERE status = "pending"',
    'SELECT COUNT(*) as in_progress_jobs FROM jobs WHERE status = "in_progress"',
    'SELECT COUNT(*) as completed_jobs FROM jobs WHERE status = "completed"',
    'SELECT COUNT(*) as total_customers FROM customers'
  ];
  
  let results = {};
  let completed = 0;
  
  queries.forEach((query, index) => {
    db.get(query, (err, result) => {
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      const key = Object.keys(result)[0];
      results[key] = result[key];
      completed++;
      
      if (completed === queries.length) {
        res.json(results);
      }
    });
  });
});

// Route per i lavori
router.get('/jobs', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const { status, assigned_to } = req.query;
  
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (assigned_to) {
    query += ' AND assigned_to = ?';
    params.push(assigned_to);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, jobs) => {
    if (err) {
      console.error('Jobs query error:', err);
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(jobs);
  });
});

// Route per creare un nuovo lavoro
router.post('/jobs', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const { title, description, customer_name, priority, assigned_to } = req.body;
  
  if (!title || !customer_name) {
    return res.status(400).json({ error: 'Titolo e cliente sono richiesti' });
  }
  
  const query = `
    INSERT INTO jobs (title, description, customer_name, priority, assigned_to, created_by, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `;
  
  db.run(query, [title, description, customer_name, priority || 'medium', assigned_to, req.user.id], function(err) {
    if (err) {
      console.error('Job creation error:', err);
      return res.status(500).json({ error: 'Errore nella creazione del lavoro' });
    }
    
    db.get('SELECT * FROM jobs WHERE id = ?', [this.lastID], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero del lavoro creato' });
      }
      res.status(201).json(job);
    });
  });
});

// Route per i clienti
router.get('/customers', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT * FROM customers ORDER BY name', (err, customers) => {
    if (err) {
      console.error('Customers query error:', err);
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(customers);
  });
});

// Route per creare un nuovo cliente
router.post('/customers', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const { name, email, phone, address } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Nome è richiesto' });
  }
  
  const query = `
    INSERT INTO customers (name, email, phone, address, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `;
  
  db.run(query, [name, email, phone, address], function(err) {
    if (err) {
      console.error('Customer creation error:', err);
      return res.status(500).json({ error: 'Errore nella creazione del cliente' });
    }
    
    db.get('SELECT * FROM customers WHERE id = ?', [this.lastID], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero del cliente creato' });
      }
      res.status(201).json(customer);
    });
  });
});

module.exports = router;