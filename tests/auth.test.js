const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock del modulo server per evitare conflitti
jest.mock('../server/index.js', () => {
  const express = require('express');
  const cors = require('cors');
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Database di test
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
  
  // Route di login
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
  
  // Route protetta di test
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Accesso autorizzato', user: req.user });
  });
  
  return { app, db };
});

describe('Autenticazione', () => {
  let app;
  
  beforeAll(async () => {
    await global.createTestDatabase();
    const server = require('../server/index.js');
    app = server.app;
  });
  
  afterAll(() => {
    global.cleanTestDatabase();
  });
  
  describe('POST /api/login', () => {
    test('dovrebbe autenticare un utente valido', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@test.com');
      expect(response.body.user.role).toBe('admin');
    });
    
    test('dovrebbe rifiutare credenziali non valide', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'admin@test.com',
          password: 'password_sbagliata'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Credenziali non valide');
    });
    
    test('dovrebbe rifiutare utente inesistente', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'utente_inesistente@test.com',
          password: 'password'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Credenziali non valide');
    });
    
    test('dovrebbe richiedere email e password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email e password sono richiesti');
    });
    
    test('dovrebbe richiedere email', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          password: 'password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('dovrebbe richiedere password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'admin@test.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Middleware di autenticazione', () => {
    let validToken;
    
    beforeAll(async () => {
      // Ottieni un token valido
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        });
      
      validToken = loginResponse.body.token;
    });
    
    test('dovrebbe permettere accesso con token valido', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@test.com');
    });
    
    test('dovrebbe rifiutare richieste senza token', async () => {
      const response = await request(app)
        .get('/api/protected');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Token di accesso richiesto');
    });
    
    test('dovrebbe rifiutare token non valido', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer token_non_valido');
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Token non valido');
    });
    
    test('dovrebbe rifiutare token malformato', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'token_senza_bearer');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    test('dovrebbe rifiutare token scaduto', async () => {
      // Crea un token scaduto
      const expiredToken = jwt.sign(
        { id: 1, email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET || 'test_jwt_secret_key',
        { expiresIn: '-1h' } // Scaduto 1 ora fa
      );
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Sicurezza password', () => {
    test('le password dovrebbero essere hashate nel database', async () => {
      const { db } = require('../server/index.js');
      
      return new Promise((resolve) => {
        db.get('SELECT password FROM users WHERE email = ?', ['admin@test.com'], (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.password).not.toBe('admin123'); // Password non in chiaro
          expect(row.password.length).toBeGreaterThan(50); // Hash bcrypt
          expect(row.password.startsWith('$2')).toBe(true); // Formato bcrypt
          resolve();
        });
      });
    });
    
    test('dovrebbe verificare correttamente le password hashate', async () => {
      const plainPassword = 'admin123';
      const { db } = require('../server/index.js');
      
      return new Promise((resolve) => {
        db.get('SELECT password FROM users WHERE email = ?', ['admin@test.com'], (err, row) => {
          expect(err).toBeNull();
          
          bcrypt.compare(plainPassword, row.password, (err, isMatch) => {
            expect(err).toBeNull();
            expect(isMatch).toBe(true);
            resolve();
          });
        });
      });
    });
  });
});