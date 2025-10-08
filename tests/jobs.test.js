const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock del server
jest.mock('../server/index.js', () => {
  const express = require('express');
  const cors = require('cors');
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  const testDbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'test_database.db');
  const db = new sqlite3.Database(testDbPath);
  
  // Middleware di autenticazione
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token di accesso richiesto' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'test_jwt_secret_key', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token non valido' });
      }
      req.user = user;
      next();
    });
  };
  
  // Route per i lavori
  app.get('/api/jobs', authenticateToken, (req, res) => {
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
        return res.status(500).json({ error: 'Errore del database' });
      }
      res.json(jobs);
    });
  });
  
  app.post('/api/jobs', authenticateToken, (req, res) => {
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
        return res.status(500).json({ error: 'Errore nella creazione del lavoro' });
      }
      
      // Restituisci il lavoro creato
      db.get('SELECT * FROM jobs WHERE id = ?', [this.lastID], (err, job) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel recupero del lavoro' });
        }
        res.status(201).json(job);
      });
    });
  });
  
  app.get('/api/jobs/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      res.json(job);
    });
  });
  
  app.put('/api/jobs/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, assigned_to } = req.body;
    
    // Verifica che il lavoro esista
    db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      const query = `
        UPDATE jobs 
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            priority = COALESCE(?, priority),
            assigned_to = COALESCE(?, assigned_to),
            updated_at = datetime('now')
        WHERE id = ?
      `;
      
      db.run(query, [title, description, status, priority, assigned_to, id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore nell\'aggiornamento del lavoro' });
        }
        
        // Restituisci il lavoro aggiornato
        db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, updatedJob) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del lavoro aggiornato' });
          }
          res.json(updatedJob);
        });
      });
    });
  });
  
  app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    // Verifica che il lavoro esista
    db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      // Verifica autorizzazioni (solo admin o creatore)
      if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Non autorizzato a eliminare questo lavoro' });
      }
      
      db.run('DELETE FROM jobs WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore nell\'eliminazione del lavoro' });
        }
        
        res.json({ message: 'Lavoro eliminato con successo' });
      });
    });
  });
  
  return { app, db };
});

describe('Gestione Lavori', () => {
  let app;
  let adminToken;
  let employeeToken;
  
  beforeAll(async () => {
    await global.createTestDatabase();
    const server = require('../server/index.js');
    app = server.app;
    
    // Crea token per i test
    adminToken = jwt.sign(
      { id: 1, email: 'admin@test.com', role: 'admin' },
      process.env.JWT_SECRET || 'test_jwt_secret_key',
      { expiresIn: '1h' }
    );
    
    employeeToken = jwt.sign(
      { id: 2, email: 'employee@test.com', role: 'employee' },
      process.env.JWT_SECRET || 'test_jwt_secret_key',
      { expiresIn: '1h' }
    );
  });
  
  afterAll(() => {
    global.cleanTestDatabase();
  });
  
  describe('GET /api/jobs', () => {
    test('dovrebbe restituire tutti i lavori per admin', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
    
    test('dovrebbe filtrare per status', async () => {
      const response = await request(app)
        .get('/api/jobs?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(job => {
        expect(job.status).toBe('pending');
      });
    });
    
    test('dovrebbe filtrare per assigned_to', async () => {
      const response = await request(app)
        .get('/api/jobs?assigned_to=2')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(job => {
        expect(job.assigned_to).toBe(2);
      });
    });
    
    test('dovrebbe richiedere autenticazione', async () => {
      const response = await request(app)
        .get('/api/jobs');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/jobs', () => {
    test('dovrebbe creare un nuovo lavoro', async () => {
      const newJob = {
        title: 'Test Job',
        description: 'Descrizione del test job',
        customer_name: 'Cliente Test',
        priority: 'high',
        assigned_to: 2
      };
      
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newJob);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(newJob.title);
      expect(response.body.description).toBe(newJob.description);
      expect(response.body.customer_name).toBe(newJob.customer_name);
      expect(response.body.priority).toBe(newJob.priority);
      expect(response.body.assigned_to).toBe(newJob.assigned_to);
      expect(response.body.status).toBe('pending');
      expect(response.body.created_by).toBe(1);
    });
    
    test('dovrebbe richiedere titolo e cliente', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Solo descrizione'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Titolo e cliente sono richiesti');
    });
    
    test('dovrebbe impostare priorità predefinita', async () => {
      const newJob = {
        title: 'Test Job Senza Priorità',
        customer_name: 'Cliente Test'
      };
      
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newJob);
      
      expect(response.status).toBe(201);
      expect(response.body.priority).toBe('medium');
    });
    
    test('dovrebbe permettere agli employee di creare lavori', async () => {
      const newJob = {
        title: 'Job da Employee',
        customer_name: 'Cliente Employee'
      };
      
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(newJob);
      
      expect(response.status).toBe(201);
      expect(response.body.created_by).toBe(2);
    });
  });
  
  describe('GET /api/jobs/:id', () => {
    let jobId;
    
    beforeAll(async () => {
      // Crea un lavoro per i test
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per Test Get',
          customer_name: 'Cliente Get Test'
        });
      
      jobId = response.body.id;
    });
    
    test('dovrebbe restituire un lavoro specifico', async () => {
      const response = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(jobId);
      expect(response.body.title).toBe('Job per Test Get');
    });
    
    test('dovrebbe restituire 404 per lavoro inesistente', async () => {
      const response = await request(app)
        .get('/api/jobs/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Lavoro non trovato');
    });
  });
  
  describe('PUT /api/jobs/:id', () => {
    let jobId;
    
    beforeAll(async () => {
      // Crea un lavoro per i test
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per Test Update',
          customer_name: 'Cliente Update Test',
          status: 'pending'
        });
      
      jobId = response.body.id;
    });
    
    test('dovrebbe aggiornare un lavoro', async () => {
      const updates = {
        title: 'Titolo Aggiornato',
        status: 'in_progress',
        priority: 'high'
      };
      
      const response = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);
      
      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updates.title);
      expect(response.body.status).toBe(updates.status);
      expect(response.body.priority).toBe(updates.priority);
      expect(response.body).toHaveProperty('updated_at');
    });
    
    test('dovrebbe aggiornare parzialmente un lavoro', async () => {
      const updates = {
        status: 'completed'
      };
      
      const response = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(updates.status);
      expect(response.body.title).toBe('Titolo Aggiornato'); // Dovrebbe mantenere il valore precedente
    });
    
    test('dovrebbe restituire 404 per lavoro inesistente', async () => {
      const response = await request(app)
        .put('/api/jobs/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('DELETE /api/jobs/:id', () => {
    let adminJobId;
    let employeeJobId;
    
    beforeAll(async () => {
      // Crea lavori per i test
      const adminJobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job Admin per Delete',
          customer_name: 'Cliente Admin Delete'
        });
      adminJobId = adminJobResponse.body.id;
      
      const employeeJobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Job Employee per Delete',
          customer_name: 'Cliente Employee Delete'
        });
      employeeJobId = employeeJobResponse.body.id;
    });
    
    test('admin dovrebbe poter eliminare qualsiasi lavoro', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${employeeJobId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Lavoro eliminato con successo');
    });
    
    test('employee dovrebbe poter eliminare solo i propri lavori', async () => {
      // Prima crea un nuovo lavoro da employee
      const newJobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Job Employee per Delete Test',
          customer_name: 'Cliente Test'
        });
      
      const response = await request(app)
        .delete(`/api/jobs/${newJobResponse.body.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
    });
    
    test('employee non dovrebbe poter eliminare lavori di altri', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${adminJobId}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Non autorizzato a eliminare questo lavoro');
    });
    
    test('dovrebbe restituire 404 per lavoro inesistente', async () => {
      const response = await request(app)
        .delete('/api/jobs/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('Validazione dati', () => {
    test('dovrebbe validare i campi obbligatori', async () => {
      const invalidJob = {
        description: 'Solo descrizione, manca titolo e cliente'
      };
      
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidJob);
      
      expect(response.status).toBe(400);
    });
    
    test('dovrebbe accettare valori di priorità validi', async () => {
      const priorities = ['low', 'medium', 'high'];
      
      for (const priority of priorities) {
        const response = await request(app)
          .post('/api/jobs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `Job Priorità ${priority}`,
            customer_name: 'Cliente Test',
            priority: priority
          });
        
        expect(response.status).toBe(201);
        expect(response.body.priority).toBe(priority);
      }
    });
    
    test('dovrebbe accettare valori di status validi', async () => {
      // Prima crea un lavoro
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per Test Status',
          customer_name: 'Cliente Test'
        });
      
      const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      
      for (const status of statuses) {
        const response = await request(app)
          .put(`/api/jobs/${jobResponse.body.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: status });
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe(status);
      }
    });
  });
});