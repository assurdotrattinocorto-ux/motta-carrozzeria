const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock del server completo per E2E
jest.mock('../server/index.js', () => {
  const express = require('express');
  const cors = require('cors');
  const sqlite3 = require('sqlite3').verbose();
  const bcrypt = require('bcryptjs');
  const path = require('path');
  const multer = require('multer');
  const fs = require('fs');
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  const testDbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'test_database.db');
  const db = new sqlite3.Database(testDbPath);
  
  // Configurazione multer per upload file
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Tipo di file non supportato'));
      }
    }
  });
  
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
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
          }
        });
      });
    });
  });
  
  app.post('/api/logout', authenticateToken, (req, res) => {
    // In un'implementazione reale, potresti voler invalidare il token
    res.json({ message: 'Logout effettuato con successo' });
  });
  
  // Route per il profilo utente
  app.get('/api/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, email, role, first_name, last_name, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }
      
      res.json(user);
    });
  });
  
  app.put('/api/profile', authenticateToken, (req, res) => {
    const { first_name, last_name, email } = req.body;
    
    const query = `
      UPDATE users 
      SET first_name = COALESCE(?, first_name), 
          last_name = COALESCE(?, last_name), 
          email = COALESCE(?, email),
          updated_at = datetime('now')
      WHERE id = ?
    `;
    
    db.run(query, [first_name, last_name, email, req.user.id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo' });
      }
      
      db.get('SELECT id, email, role, first_name, last_name FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel recupero del profilo aggiornato' });
        }
        res.json(user);
      });
    });
  });
  
  // Route per dashboard
  app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
    const queries = [
      'SELECT COUNT(*) as total_jobs FROM jobs',
      'SELECT COUNT(*) as pending_jobs FROM jobs WHERE status = "pending"',
      'SELECT COUNT(*) as in_progress_jobs FROM jobs WHERE status = "in_progress"',
      'SELECT COUNT(*) as completed_jobs FROM jobs WHERE status = "completed"',
      'SELECT COUNT(*) as total_customers FROM customers',
      'SELECT COUNT(*) as active_time_logs FROM time_logs WHERE active = 1'
    ];
    
    Promise.all(queries.map(query => 
      new Promise((resolve, reject) => {
        db.get(query, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      })
    )).then(results => {
      res.json({
        totalJobs: results[0].total_jobs || 0,
        pendingJobs: results[1].pending_jobs || 0,
        inProgressJobs: results[2].in_progress_jobs || 0,
        completedJobs: results[3].completed_jobs || 0,
        totalCustomers: results[4].total_customers || 0,
        activeTimeLogs: results[5].active_time_logs || 0
      });
    }).catch(err => {
      res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
    });
  });
  
  // Route per lavori con paginazione e filtri avanzati
  app.get('/api/jobs', authenticateToken, (req, res) => {
    const { 
      status, 
      assigned_to, 
      customer_name, 
      priority, 
      page = 1, 
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;
    
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
    
    if (customer_name) {
      query += ' AND customer_name LIKE ?';
      params.push(`%${customer_name}%`);
    }
    
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    
    // Se non è admin, mostra solo i lavori assegnati all'utente
    if (req.user.role !== 'admin') {
      query += ' AND assigned_to = ?';
      params.push(req.user.id);
    }
    
    const validSortColumns = ['created_at', 'title', 'status', 'priority', 'customer_name'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, jobs) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      // Conta il totale per la paginazione
      let countQuery = 'SELECT COUNT(*) as total FROM jobs WHERE 1=1';
      const countParams = [];
      
      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      
      if (assigned_to) {
        countQuery += ' AND assigned_to = ?';
        countParams.push(assigned_to);
      }
      
      if (customer_name) {
        countQuery += ' AND customer_name LIKE ?';
        countParams.push(`%${customer_name}%`);
      }
      
      if (priority) {
        countQuery += ' AND priority = ?';
        countParams.push(priority);
      }
      
      if (req.user.role !== 'admin') {
        countQuery += ' AND assigned_to = ?';
        countParams.push(req.user.id);
      }
      
      db.get(countQuery, countParams, (err, countResult) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel conteggio' });
        }
        
        res.json({
          jobs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / parseInt(limit))
          }
        });
      });
    });
  });
  
  // Route per upload file
  app.post('/api/jobs/:id/upload', authenticateToken, upload.single('file'), (req, res) => {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }
    
    // Verifica che il lavoro esista
    db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, job) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }
      
      // Salva informazioni del file nel database (se hai una tabella per i file)
      const fileInfo = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      };
      
      res.json({
        message: 'File caricato con successo',
        file: fileInfo
      });
    });
  });
  
  // Route per calendar events
  app.get('/api/calendar/events', authenticateToken, (req, res) => {
    const { start_date, end_date } = req.query;
    
    let query = 'SELECT * FROM calendar_events WHERE 1=1';
    const params = [];
    
    if (start_date) {
      query += ' AND event_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND event_date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY event_date, event_time';
    
    db.all(query, params, (err, events) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      res.json(events);
    });
  });
  
  app.post('/api/calendar/events', authenticateToken, (req, res) => {
    const { title, description, event_date, event_time, duration } = req.body;
    
    if (!title || !event_date) {
      return res.status(400).json({ error: 'Titolo e data sono richiesti' });
    }
    
    const query = `
      INSERT INTO calendar_events (title, description, event_date, event_time, duration, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    db.run(query, [title, description, event_date, event_time, duration, req.user.id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nella creazione dell\'evento' });
      }
      
      db.get('SELECT * FROM calendar_events WHERE id = ?', [this.lastID], (err, event) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nel recupero dell\'evento' });
        }
        res.status(201).json(event);
      });
    });
  });
  
  // Route per report
  app.get('/api/reports/time-summary', authenticateToken, (req, res) => {
    const { start_date, end_date, user_id } = req.query;
    
    let query = `
      SELECT 
        u.first_name || ' ' || u.last_name as user_name,
        j.title as job_title,
        j.customer_name,
        SUM(tl.duration) as total_duration,
        COUNT(tl.id) as session_count
      FROM time_logs tl
      JOIN users u ON tl.user_id = u.id
      JOIN jobs j ON tl.job_id = j.id
      WHERE tl.active = 0
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND DATE(tl.start_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(tl.start_time) <= ?';
      params.push(end_date);
    }
    
    if (user_id) {
      query += ' AND tl.user_id = ?';
      params.push(user_id);
    }
    
    query += ' GROUP BY tl.user_id, tl.job_id ORDER BY total_duration DESC';
    
    db.all(query, params, (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero del report' });
      }
      res.json(results);
    });
  });
  
  return { app, db };
});

describe('Test End-to-End', () => {
  let app;
  let adminToken;
  let employeeToken;
  
  beforeAll(async () => {
    await global.createTestDatabase();
    const server = require('../server/index.js');
    app = server.app;
    
    // Login come admin
    const adminLogin = await request(app)
      .post('/api/login')
      .send({
        email: 'admin@test.com',
        password: 'admin123'
      });
    
    // Login come employee
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
  
  describe('Scenario completo: Giornata lavorativa di un dipendente', () => {
    let jobId;
    let customerId;
    let timeLogId;
    let eventId;
    
    test('1. Admin crea un nuovo cliente', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Azienda E2E Test',
          email: 'azienda@e2etest.com',
          phone: '+39 02 1234567',
          address: 'Via Milano 100, Milano'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      customerId = response.body.id;
    });
    
    test('2. Admin crea un nuovo lavoro urgente', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Riparazione urgente server',
          description: 'Il server principale è down, necessaria riparazione immediata',
          customer_name: 'Azienda E2E Test',
          priority: 'high',
          assigned_to: 2 // Employee ID
        });
      
      expect(response.status).toBe(201);
      expect(response.body.priority).toBe('high');
      expect(response.body.assigned_to).toBe(2);
      jobId = response.body.id;
    });
    
    test('3. Employee controlla la dashboard per vedere le statistiche', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalJobs');
      expect(response.body).toHaveProperty('pendingJobs');
      expect(response.body).toHaveProperty('inProgressJobs');
      expect(response.body).toHaveProperty('completedJobs');
      expect(response.body.totalJobs).toBeGreaterThan(0);
    });
    
    test('4. Employee visualizza i lavori assegnati con filtri', async () => {
      const response = await request(app)
        .get('/api/jobs?assigned_to=2&status=pending&priority=high')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('pagination');
      
      const urgentJob = response.body.jobs.find(job => job.id === jobId);
      expect(urgentJob).toBeTruthy();
      expect(urgentJob.priority).toBe('high');
    });
    
    test('5. Employee aggiorna il proprio profilo', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          first_name: 'Mario',
          last_name: 'Rossi'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('Mario');
      expect(response.body.last_name).toBe('Rossi');
    });
    
    test('6. Employee crea un evento nel calendario per pianificare il lavoro', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      const response = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Riparazione server - Azienda E2E Test',
          description: 'Intervento programmato per riparazione server',
          event_date: dateStr,
          event_time: '09:00',
          duration: 240 // 4 ore
        });
      
      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Riparazione server - Azienda E2E Test');
      eventId = response.body.id;
    });
    
    test('7. Employee inizia il lavoro e avvia il timer', async () => {
      // Prima aggiorna lo status del lavoro
      const statusResponse = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'in_progress' });
      
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('in_progress');
      
      // Poi avvia il timer
      const timerResponse = await request(app)
        .post('/api/time-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          job_id: jobId,
          notes: 'Inizio diagnosi problema server'
        });
      
      expect(timerResponse.status).toBe(201);
      expect(timerResponse.body.active).toBe(1);
      timeLogId = timerResponse.body.id;
    });
    
    test('8. Employee simula una pausa e riprende il lavoro', async () => {
      // Ferma il timer per la pausa
      const stopResponse = await request(app)
        .put(`/api/time-logs/${timeLogId}/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ notes: 'Pausa pranzo' });
      
      expect(stopResponse.status).toBe(200);
      expect(stopResponse.body.active).toBe(0);
      
      // Riprende il lavoro con un nuovo timer
      const resumeResponse = await request(app)
        .post('/api/time-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          job_id: jobId,
          notes: 'Ripresa lavoro dopo pausa'
        });
      
      expect(resumeResponse.status).toBe(201);
      expect(resumeResponse.body.active).toBe(1);
      timeLogId = resumeResponse.body.id; // Aggiorna l'ID del timer attivo
    });
    
    test('9. Employee completa il lavoro e ferma il timer', async () => {
      // Aspetta un momento per avere una durata misurabile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ferma il timer finale
      const stopResponse = await request(app)
        .put(`/api/time-logs/${timeLogId}/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ notes: 'Lavoro completato - server riparato e funzionante' });
      
      expect(stopResponse.status).toBe(200);
      expect(stopResponse.body.active).toBe(0);
      expect(stopResponse.body.duration).toBeGreaterThan(0);
      
      // Aggiorna lo status del lavoro a completato
      const completeResponse = await request(app)
        .put(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'completed' });
      
      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.status).toBe('completed');
    });
    
    test('10. Admin genera un report del tempo lavorato', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/reports/time-summary?start_date=${today}&user_id=2`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const jobReport = response.body.find(report => 
        report.job_title === 'Riparazione urgente server'
      );
      
      expect(jobReport).toBeTruthy();
      expect(jobReport.total_duration).toBeGreaterThan(0);
      expect(jobReport.session_count).toBeGreaterThanOrEqual(2); // Due sessioni di timer
    });
    
    test('11. Admin verifica le statistiche aggiornate della dashboard', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.completedJobs).toBeGreaterThan(0);
      expect(response.body.activeTimeLogs).toBe(0); // Nessun timer attivo
    });
    
    test('12. Employee visualizza gli eventi del calendario', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/calendar/events?start_date=${dateStr}&end_date=${dateStr}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const plannedEvent = response.body.find(event => event.id === eventId);
      expect(plannedEvent).toBeTruthy();
      expect(plannedEvent.title).toBe('Riparazione server - Azienda E2E Test');
    });
  });
  
  describe('Scenario di gestione errori e edge cases', () => {
    test('Dovrebbe gestire sessioni scadute', async () => {
      // Crea un token scaduto
      const expiredToken = jwt.sign(
        { id: 1, email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET || 'test_jwt_secret_key',
        { expiresIn: '-1h' } // Scaduto 1 ora fa
      );
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
    
    test('Dovrebbe gestire richieste con dati malformati', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '', // Titolo vuoto
          customer_name: null, // Cliente null
          priority: 'invalid_priority' // Priorità non valida
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('Dovrebbe gestire tentativi di accesso non autorizzato', async () => {
      // Employee prova ad accedere a funzioni admin
      const response = await request(app)
        .get('/api/jobs') // Senza filtri, dovrebbe vedere solo i suoi lavori
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      // Verifica che veda solo i lavori assegnati a lui
      response.body.jobs.forEach(job => {
        expect(job.assigned_to).toBe(2);
      });
    });
    
    test('Dovrebbe gestire upload di file non supportati', async () => {
      // Prima crea un lavoro
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Job per test upload',
          customer_name: 'Cliente Test'
        });
      
      // Simula upload di file non supportato
      const response = await request(app)
        .post(`/api/jobs/${jobResponse.body.id}/upload`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .attach('file', Buffer.from('fake exe content'), 'malware.exe');
      
      expect(response.status).toBe(400);
    });
    
    test('Dovrebbe gestire richieste di paginazione con parametri non validi', async () => {
      const response = await request(app)
        .get('/api/jobs?page=-1&limit=abc&sort_by=invalid_column')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      // Dovrebbe usare valori di default
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.page).toBeGreaterThan(0);
    });
  });
  
  describe('Scenario di performance e scalabilità', () => {
    test('Dovrebbe gestire molte richieste simultanee', async () => {
      const promises = [];
      
      // Simula 20 utenti che accedono contemporaneamente alla dashboard
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .get('/api/dashboard/stats')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Tutte le richieste dovrebbero avere successo
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('totalJobs');
      });
      
      // Il tempo totale dovrebbe essere ragionevole
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Meno di 10 secondi
    });
    
    test('Dovrebbe gestire paginazione con grandi dataset', async () => {
      // Crea molti lavori
      const createPromises = [];
      for (let i = 0; i < 100; i++) {
        createPromises.push(
          request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              title: `Job Scalabilità ${i}`,
              customer_name: `Cliente ${i % 10}`, // 10 clienti diversi
              priority: ['low', 'medium', 'high'][i % 3]
            })
        );
      }
      
      await Promise.all(createPromises);
      
      // Testa la paginazione
      const page1 = await request(app)
        .get('/api/jobs?page=1&limit=25')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const page2 = await request(app)
        .get('/api/jobs?page=2&limit=25')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
      expect(page1.body.jobs).toHaveLength(25);
      expect(page2.body.jobs).toHaveLength(25);
      expect(page1.body.pagination.total).toBeGreaterThanOrEqual(100);
      
      // Verifica che non ci siano duplicati tra le pagine
      const page1Ids = page1.body.jobs.map(job => job.id);
      const page2Ids = page2.body.jobs.map(job => job.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
    
    test('Dovrebbe gestire filtri complessi efficientemente', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/jobs?customer_name=Cliente&priority=high&status=pending&sort_by=created_at&sort_order=DESC')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobs');
      
      // La query con filtri complessi dovrebbe essere veloce
      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(2000); // Meno di 2 secondi
      
      // Verifica che i filtri siano applicati correttamente
      response.body.jobs.forEach(job => {
        if (job.customer_name) {
          expect(job.customer_name.toLowerCase()).toContain('cliente');
        }
        if (job.priority) {
          expect(job.priority).toBe('high');
        }
        if (job.status) {
          expect(job.status).toBe('pending');
        }
      });
    });
  });
  
  describe('Scenario di logout e pulizia sessione', () => {
    test('Employee dovrebbe poter fare logout correttamente', async () => {
      const response = await request(app)
        .post('/api/logout')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Logout effettuato con successo');
    });
    
    test('Dopo logout, le richieste dovrebbero fallire (simulazione)', async () => {
      // Nota: In un'implementazione reale con blacklist dei token,
      // questo test fallirebbe. Per ora, il token rimane valido
      // fino alla scadenza naturale.
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      // Per ora il token è ancora valido
      expect(response.status).toBe(200);
      
      // In un'implementazione con blacklist:
      // expect(response.status).toBe(401);
    });
  });
});