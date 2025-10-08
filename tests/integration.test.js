const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock del server completo
jest.mock('../server/index.js', () => {
  const express = require('express');
  const cors = require('cors');
  const sqlite3 = require('sqlite3').verbose();
  const bcrypt = require('bcryptjs');
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
  
  // Route di autenticazione
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono richiesti' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          return res.status(500).json({ error: 'Errore di autenticazione' });
        }
        
        if (!isMatch) {
          return res.status(401).json({ error: 'Credenziali non valide' });
        }
        
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || 'test_jwt_secret_key',
          { expiresIn: '24h' }
        );
        
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        });
      });
    });
  });
  
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
      
      db.get('SELECT * FROM jobs WHERE id = ?', [this.lastID], (err, job) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel recupero del lavoro' });
        }
        res.status(201).json(job);
      });
    });
  });
  
  app.put('/api/jobs/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      db.run('UPDATE jobs SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore nell\'aggiornamento del lavoro' });
        }
        
        db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, updatedJob) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del lavoro aggiornato' });
          }
          res.json(updatedJob);
        });
      });
    });
  });
  
  // Route per time logs
  app.post('/api/time-logs', authenticateToken, (req, res) => {
    const { job_id, start_time, notes } = req.body;
    
    if (!job_id) {
      return res.status(400).json({ error: 'Job ID è richiesto' });
    }
    
    // Verifica che il lavoro esista
    db.get('SELECT * FROM jobs WHERE id = ?', [job_id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      const query = `
        INSERT INTO time_logs (job_id, user_id, start_time, notes, active, created_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
      `;
      
      db.run(query, [job_id, req.user.id, start_time || new Date().toISOString(), notes], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore nella creazione del time log' });
        }
        
        db.get('SELECT * FROM time_logs WHERE id = ?', [this.lastID], (err, timeLog) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del time log' });
          }
          res.status(201).json(timeLog);
        });
      });
    });
  });
  
  app.put('/api/time-logs/:id/stop', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { end_time, notes } = req.body;
    
    db.get('SELECT * FROM time_logs WHERE id = ? AND user_id = ?', [id, req.user.id], (err, timeLog) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!timeLog) {
        return res.status(404).json({ error: 'Time log non trovato' });
      }
      
      if (!timeLog.active) {
        return res.status(400).json({ error: 'Time log già fermato' });
      }
      
      const endTime = end_time || new Date().toISOString();
      const startTime = new Date(timeLog.start_time);
      const duration = Math.floor((new Date(endTime) - startTime) / 1000); // durata in secondi
      
      const query = `
        UPDATE time_logs 
        SET end_time = ?, duration = ?, notes = COALESCE(?, notes), active = 0
        WHERE id = ?
      `;
      
      db.run(query, [endTime, duration, notes, id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore nell\'aggiornamento del time log' });
        }
        
        db.get('SELECT * FROM time_logs WHERE id = ?', [id], (err, updatedTimeLog) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del time log aggiornato' });
          }
          res.json(updatedTimeLog);
        });
      });
    });
  });
  
  // Route per clienti
  app.get('/api/customers', authenticateToken, (req, res) => {
    db.all('SELECT * FROM customers ORDER BY name', (err, customers) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      res.json(customers);
    });
  });
  
  app.post('/api/customers', authenticateToken, (req, res) => {
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
        return res.status(500).json({ error: 'Errore nella creazione del cliente' });
      }
      
      db.get('SELECT * FROM customers WHERE id = ?', [this.lastID], (err, customer) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel recupero del cliente' });
        }
        res.status(201).json(customer);
      });
    });
  });
  
  return { app, db };
});

describe('Test di Integrazione', () => {
  let app;
  let adminToken;
  let employeeToken;
  
  beforeAll(async () => {
    await global.createTestDatabase();
    const server = require('../server/index.js');
    app = server.app;
    
    // Ottieni token per i test
    const adminLogin = await request(app)
      .post('/api/login')
      .send({
        email: 'admin@test.com',
        password: 'admin123'
      });
    
    const employeeLogin = await request(app)
      .post('/api/login')
      .send({
        email: 'employee@test.com',
        password: 'employee123'
      });
    
    adminToken = adminLogin.body.token;
    employeeToken = employeeLogin.body.token;
  });
  
  afterAll(() => {
    global.cleanTestDatabase();
  });
  
  describe('Flusso completo di gestione lavoro', () => {
    let customerId;
    let jobId;
    let timeLogId;
    
    test('1. Dovrebbe creare un nuovo cliente', async () => {
      const customerData = {
        name: 'Cliente Integrazione Test',
        email: 'cliente@test.com',
        phone: '+39 123 456 7890',
        address: 'Via Test 123, Milano'
      };
      
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(customerData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(customerData.name);
      expect(response.body.email).toBe(customerData.email);
      
      customerId = response.body.id;
    });
    
    test('2. Dovrebbe creare un nuovo lavoro per il cliente', async () => {
      const jobData = {
        title: 'Lavoro di Integrazione Test',
        description: 'Descrizione dettagliata del lavoro di test',
        customer_name: 'Cliente Integrazione Test',
        priority: 'high',
        assigned_to: 2 // Employee
      };
      
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(jobData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(jobData.title);
      expect(response.body.status).toBe('pending');
      expect(response.body.assigned_to).toBe(jobData.assigned_to);
      
      jobId = response.body.id;
    });
    
    test('3. Employee dovrebbe vedere il lavoro assegnato', async () => {
      const response = await request(app)
        .get('/api/jobs?assigned_to=2')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const assignedJob = response.body.find(job => job.id === jobId);
      expect(assignedJob).toBeTruthy();
      expect(assignedJob.assigned_to).toBe(2);
    });
    
    test('4. Employee dovrebbe iniziare il timer per il lavoro', async () => {
      const timeLogData = {
        job_id: jobId,
        notes: 'Inizio lavoro di test'
      };
      
      const response = await request(app)
        .post('/api/time-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(timeLogData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.job_id).toBe(jobId);
      expect(response.body.user_id).toBe(2);
      expect(response.body.active).toBe(1);
      expect(response.body.notes).toBe(timeLogData.notes);
      
      timeLogId = response.body.id;
    });
    
    test('5. Employee dovrebbe aggiornare lo status del lavoro a "in_progress"', async () => {
      const response = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'in_progress' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
      expect(response.body).toHaveProperty('updated_at');
    });
    
    test('6. Employee dovrebbe fermare il timer', async () => {
      // Aspetta un po' per avere una durata misurabile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await request(app)
        .put(`/api/time-logs/${timeLogId}/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ notes: 'Lavoro completato con successo' });
      
      expect(response.status).toBe(200);
      expect(response.body.active).toBe(0);
      expect(response.body).toHaveProperty('end_time');
      expect(response.body).toHaveProperty('duration');
      expect(response.body.duration).toBeGreaterThan(0);
      expect(response.body.notes).toBe('Lavoro completato con successo');
    });
    
    test('7. Employee dovrebbe completare il lavoro', async () => {
      const response = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'completed' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });
    
    test('8. Admin dovrebbe vedere il lavoro completato', async () => {
      const response = await request(app)
        .get('/api/jobs?status=completed')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const completedJob = response.body.find(job => job.id === jobId);
      expect(completedJob).toBeTruthy();
      expect(completedJob.status).toBe('completed');
    });
  });
  
  describe('Flusso di gestione errori', () => {
    test('Dovrebbe gestire errori di autenticazione nel flusso', async () => {
      // Prova a creare un lavoro senza token
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Lavoro senza auth',
          customer_name: 'Cliente Test'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    test('Dovrebbe gestire errori di validazione nel flusso', async () => {
      // Prova a creare un lavoro senza dati richiesti
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Solo descrizione'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('Dovrebbe gestire errori di risorse non trovate', async () => {
      // Prova a iniziare un timer per un lavoro inesistente
      const response = await request(app)
        .post('/api/time-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          job_id: 99999,
          notes: 'Timer per lavoro inesistente'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Lavoro non trovato');
    });
    
    test('Dovrebbe gestire errori di business logic', async () => {
      // Prima crea un time log
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per test errore',
          customer_name: 'Cliente Test'
        });
      
      const timeLogResponse = await request(app)
        .post('/api/time-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          job_id: jobResponse.body.id,
          notes: 'Timer di test'
        });
      
      // Ferma il timer
      await request(app)
        .put(`/api/time-logs/${timeLogResponse.body.id}/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({});
      
      // Prova a fermarlo di nuovo
      const response = await request(app)
        .put(`/api/time-logs/${timeLogResponse.body.id}/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Time log già fermato');
    });
  });
  
  describe('Test di concorrenza e consistenza', () => {
    test('Dovrebbe gestire richieste concorrenti correttamente', async () => {
      // Crea un lavoro
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per test concorrenza',
          customer_name: 'Cliente Concorrenza'
        });
      
      const jobId = jobResponse.body.id;
      
      // Esegui aggiornamenti concorrenti
      const promises = [
        request(app)
          .put(`/api/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'in_progress' }),
        request(app)
          .put(`/api/jobs/${jobId}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ status: 'completed' })
      ];
      
      const results = await Promise.all(promises);
      
      // Entrambe le richieste dovrebbero avere successo
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
      
      // Verifica lo stato finale
      const finalResponse = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(finalResponse.status).toBe(200);
      expect(['in_progress', 'completed']).toContain(finalResponse.body.status);
    });
    
    test('Dovrebbe mantenere consistenza dei dati', async () => {
      // Crea cliente e lavoro
      const customerResponse = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cliente Consistenza',
          email: 'consistenza@test.com'
        });
      
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job Consistenza',
          customer_name: customerResponse.body.name
        });
      
      // Verifica che i dati siano consistenti
      const jobsResponse = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const customersResponse = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const createdJob = jobsResponse.body.find(job => job.id === jobResponse.body.id);
      const createdCustomer = customersResponse.body.find(customer => customer.id === customerResponse.body.id);
      
      expect(createdJob).toBeTruthy();
      expect(createdCustomer).toBeTruthy();
      expect(createdJob.customer_name).toBe(createdCustomer.name);
    });
  });
  
  describe('Test di performance', () => {
    test('Dovrebbe gestire multiple richieste efficientemente', async () => {
      const startTime = Date.now();
      
      // Esegui multiple richieste in parallelo
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Tutte le richieste dovrebbero avere successo
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(Array.isArray(result.body)).toBe(true);
      });
      
      // Il tempo totale dovrebbe essere ragionevole
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Meno di 5 secondi
    });
    
    test('Dovrebbe gestire grandi quantità di dati', async () => {
      // Crea molti lavori
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              title: `Job Performance ${i}`,
              customer_name: `Cliente ${i}`,
              priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'
            })
        );
      }
      
      const results = await Promise.all(promises);
      
      // Tutte le creazioni dovrebbero avere successo
      results.forEach(result => {
        expect(result.status).toBe(201);
      });
      
      // Recupera tutti i lavori
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(50);
      
      // La query dovrebbe essere veloce anche con molti dati
      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(1000); // Meno di 1 secondo
    });
  });
});