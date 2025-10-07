const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'motta_carrozzeria_secret_key_2024';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000"
}));
app.use(express.json());

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
}

// Database setup
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper function to get job with all assigned employees
function getJobWithAssignments(jobId, callback) {
  db.get(`
    SELECT j.*, 
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users c ON j.created_by = c.id
    WHERE j.id = ?
  `, [jobId], (err, job) => {
    if (err) {
      return callback(err);
    }

    if (!job) {
      return callback(new Error('Job not found'));
    }

    // Get all assigned employees for this job
    db.all(`
      SELECT u.id, u.name, ja.assigned_at
      FROM job_assignments ja
      JOIN users u ON ja.user_id = u.id
      WHERE ja.job_id = ?
      ORDER BY ja.assigned_at
    `, [jobId], (err, assignments) => {
      if (err) {
        return callback(err);
      }

      // Add assigned employees to job object
      job.assigned_employees = assignments || [];
      
      // For backward compatibility, set assigned_to to first employee's ID if exists
      job.assigned_to = assignments && assignments.length > 0 ? assignments[0].id : null;
      job.assigned_to_name = assignments && assignments.length > 0 ? assignments[0].name : null;

      callback(null, job);
    });
  });
}

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Jobs table
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    customer_name TEXT NOT NULL,
    vehicle_info TEXT,
    status TEXT DEFAULT 'todo',
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    estimated_hours REAL,
    actual_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Time tracking table
  db.run(`CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Calendar events table
  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    type TEXT DEFAULT 'event',
    priority TEXT DEFAULT 'medium',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Employees table for detailed employee management
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT,
    hire_date DATE NOT NULL,
    hourly_rate REAL DEFAULT 0,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Customers table
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    company TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create default admin user
  const adminEmail = 'admin@motta.it';
  const adminPassword = bcrypt.hashSync('admin123', 10);
  
  db.get("SELECT id FROM users WHERE email = ?", [adminEmail], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
        [adminEmail, adminPassword, 'Amministratore Motta', 'admin']);
      console.log('✅ Admin user created: admin@motta.it / admin123');
    }
  });

  // Create sample employee
  const employeeEmail = 'dipendente@motta.it';
  const employeePassword = bcrypt.hashSync('dipendente123', 10);
  
  db.get("SELECT id FROM users WHERE email = ?", [employeeEmail], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
        [employeeEmail, employeePassword, 'Mario Rossi', 'employee']);
      console.log('✅ Employee user created: dipendente@motta.it / dipendente123');
    }
  });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di accesso richiesto' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
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

// Get all users (for admin)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all("SELECT id, email, name, role, created_at FROM users", (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(users);
  });
});

// Get jobs
app.get('/api/jobs', authenticateToken, (req, res) => {
  let query = `
    SELECT j.*, 
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users c ON j.created_by = c.id
    ORDER BY j.created_at DESC
  `;
  
  // Tutti gli utenti (admin e dipendenti) possono vedere tutti i lavori
  db.all(query, [], (err, jobs) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    // Get assignments for all jobs
    const jobIds = jobs.map(job => job.id);
    if (jobIds.length === 0) {
      return res.json([]);
    }

    const placeholders = jobIds.map(() => '?').join(',');
    db.all(`
      SELECT ja.job_id, u.id, u.name, ja.assigned_at
      FROM job_assignments ja
      JOIN users u ON ja.user_id = u.id
      WHERE ja.job_id IN (${placeholders})
      ORDER BY ja.assigned_at
    `, jobIds, (err, assignments) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      // Group assignments by job_id
      const assignmentsByJob = {};
      assignments.forEach(assignment => {
        if (!assignmentsByJob[assignment.job_id]) {
          assignmentsByJob[assignment.job_id] = [];
        }
        assignmentsByJob[assignment.job_id].push({
          id: assignment.id,
          name: assignment.name,
          assigned_at: assignment.assigned_at
        });
      });

      // Add assigned employees to each job
      const jobsWithAssignments = jobs.map(job => {
        const jobAssignments = assignmentsByJob[job.id] || [];
        return {
          ...job,
          assigned_employees: jobAssignments,
          // For backward compatibility
          assigned_to: jobAssignments.length > 0 ? jobAssignments[0].id : null,
          assigned_to_name: jobAssignments.length > 0 ? jobAssignments[0].name : null
        };
      });

      res.json(jobsWithAssignments);
    });
  });
});

// Create job (admin only)
app.post('/api/jobs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { title, description, customer_name, vehicle_info, assigned_to, estimated_hours } = req.body;

  // Support both single assignment (backward compatibility) and multiple assignments
  const assignedEmployees = Array.isArray(assigned_to) ? assigned_to : (assigned_to ? [assigned_to] : []);

  db.run(
    `INSERT INTO jobs (title, description, customer_name, vehicle_info, created_by, estimated_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, customer_name, vehicle_info, req.user.id, estimated_hours],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      const jobId = this.lastID;

      // Insert job assignments if any employees are assigned
      if (assignedEmployees.length > 0) {
        const assignmentPromises = assignedEmployees.map(userId => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO job_assignments (job_id, user_id, assigned_by) VALUES (?, ?, ?)`,
              [jobId, userId, req.user.id],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        });

        Promise.all(assignmentPromises)
          .then(() => {
            // Get the created job with assigned employees
            getJobWithAssignments(jobId, (err, job) => {
              if (err) {
                return res.status(500).json({ error: 'Errore del database' });
              }

              // Emit to all connected clients
              io.emit('jobCreated', job);
              res.status(201).json(job);
            });
          })
          .catch(err => {
            console.error('Error creating job assignments:', err);
            res.status(500).json({ error: 'Errore nell\'assegnazione dipendenti' });
          });
      } else {
        // No assignments, just return the job
        getJobWithAssignments(jobId, (err, job) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Emit to all connected clients
          io.emit('jobCreated', job);
          res.status(201).json(job);
        });
      }
    }
  );
});

// Add a general job update endpoint (admin only)
app.put('/api/jobs/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const jobId = req.params.id;
  const { title, description, customer_name, vehicle_info, assigned_to, estimated_hours } = req.body;

  // Support both single assignment (backward compatibility) and multiple assignments
  const assignedEmployees = Array.isArray(assigned_to) ? assigned_to : (assigned_to ? [assigned_to] : []);

  // Update job basic info
  db.run(
    `UPDATE jobs SET title = ?, description = ?, customer_name = ?, vehicle_info = ?, estimated_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, description, customer_name, vehicle_info, estimated_hours, jobId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }

      // Remove existing assignments
      db.run('DELETE FROM job_assignments WHERE job_id = ?', [jobId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nella rimozione assegnazioni' });
        }

        // Insert new assignments if any
        if (assignedEmployees.length > 0) {
          const assignmentPromises = assignedEmployees.map(userId => {
            return new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO job_assignments (job_id, user_id, assigned_by) VALUES (?, ?, ?)`,
                [jobId, userId, req.user.id],
                function(err) {
                  if (err) reject(err);
                  else resolve(this.lastID);
                }
              );
            });
          });

          Promise.all(assignmentPromises)
            .then(() => {
              // Get the updated job with assigned employees
              getJobWithAssignments(jobId, (err, job) => {
                if (err) {
                  return res.status(500).json({ error: 'Errore del database' });
                }

                // Emit to all connected clients
                io.emit('jobUpdated', job);
                res.json(job);
              });
            })
            .catch(err => {
              console.error('Error updating job assignments:', err);
              res.status(500).json({ error: 'Errore nell\'aggiornamento assegnazioni' });
            });
        } else {
          // No assignments, just return the job
          getJobWithAssignments(jobId, (err, job) => {
            if (err) {
              return res.status(500).json({ error: 'Errore del database' });
            }

            // Emit to all connected clients
            io.emit('jobUpdated', job);
            res.json(job);
          });
        }
      });
    }
  );
});

// Update job status
app.put('/api/jobs/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const jobId = req.params.id;

  // Check if user can update this job
  let checkQuery = 'SELECT * FROM jobs WHERE id = ?';
  let checkParams = [jobId];

  if (req.user.role === 'employee') {
    checkQuery += ' AND assigned_to = ?';
    checkParams.push(req.user.id);
  }

  db.get(checkQuery, checkParams, (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (!job) {
      return res.status(404).json({ error: 'Lavoro non trovato o non autorizzato' });
    }

    db.run(
      'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, jobId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore del database' });
        }

        // Get updated job with user names
        db.get(`
          SELECT j.*, 
                 u.name as assigned_to_name,
                 c.name as created_by_name
          FROM jobs j
          LEFT JOIN users u ON j.assigned_to = u.id
          LEFT JOIN users c ON j.created_by = c.id
          WHERE j.id = ?
        `, [jobId], (err, updatedJob) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // If job is completed, archive it
          if (status === 'completed') {
            // Get total time spent on this job
            db.get(`
              SELECT SUM(duration_minutes) as total_minutes
              FROM time_logs 
              WHERE job_id = ? AND end_time IS NOT NULL
            `, [jobId], (err, timeResult) => {
              const totalMinutes = timeResult ? timeResult.total_minutes || 0 : 0;
              
              // Archive the completed job
              db.run(`
                INSERT INTO archived_jobs (
                  original_job_id, title, description, customer_name, vehicle_info,
                  assigned_to, assigned_to_name, created_by, created_by_name,
                  estimated_hours, actual_hours, created_at, updated_at,
                  total_time_minutes, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                updatedJob.id, updatedJob.title, updatedJob.description,
                updatedJob.customer_name, updatedJob.vehicle_info,
                updatedJob.assigned_to, updatedJob.assigned_to_name,
                updatedJob.created_by, updatedJob.created_by_name,
                updatedJob.estimated_hours, updatedJob.actual_hours,
                updatedJob.created_at, updatedJob.updated_at,
                totalMinutes, 'Lavoro completato e archiviato automaticamente'
              ], (archiveErr) => {
                if (archiveErr) {
                  console.error('Errore nell\'archiviazione:', archiveErr);
                }
              });
            });
          }

          // Emit to all connected clients
          io.emit('jobUpdated', updatedJob);
          res.json(updatedJob);
        });
      }
    );
  });
});

// Delete job (admin only)
app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const jobId = req.params.id;

  db.run('DELETE FROM jobs WHERE id = ?', [jobId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Lavoro non trovato' });
    }

    // Emit to all connected clients
    io.emit('jobDeleted', { id: jobId });
    res.json({ message: 'Lavoro eliminato con successo' });
  });
});

// ===== ARCHIVED JOBS ROUTES =====

// Get all archived jobs (admin only)
app.get('/api/archived-jobs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT * FROM archived_jobs 
    ORDER BY archived_at DESC
  `, (err, archivedJobs) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(archivedJobs);
  });
});

// Get archived job statistics
app.get('/api/archived-jobs/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT 
      COUNT(*) as total_archived,
      SUM(actual_hours) as total_hours,
      SUM(total_time_minutes) as total_minutes,
      AVG(actual_hours) as avg_hours_per_job,
      assigned_to_name,
      COUNT(*) as jobs_completed
    FROM archived_jobs 
    GROUP BY assigned_to_name
    ORDER BY jobs_completed DESC
  `, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get overall stats
    db.get(`
      SELECT 
        COUNT(*) as total_archived,
        SUM(actual_hours) as total_hours,
        SUM(total_time_minutes) as total_minutes,
        AVG(actual_hours) as avg_hours_per_job
      FROM archived_jobs
    `, (err, overall) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        overall: overall || { total_archived: 0, total_hours: 0, total_minutes: 0, avg_hours_per_job: 0 },
        by_employee: stats || []
      });
    });
  });
});

// Archive a completed job manually
app.post('/api/jobs/:id/archive', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  // First check if job exists and is completed
  db.get(`
    SELECT j.*, 
           u.name as assigned_to_name,
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users u ON j.assigned_to = u.id
    LEFT JOIN users c ON j.created_by = c.id
    WHERE j.id = ?
  `, [jobId], (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!job) {
      return res.status(404).json({ error: 'Lavoro non trovato' });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Solo i lavori completati possono essere archiviati' });
    }

    // Get total time spent on this job
    db.get(`
      SELECT SUM(duration_minutes) as total_minutes
      FROM time_logs 
      WHERE job_id = ? AND end_time IS NOT NULL
    `, [jobId], (err, timeResult) => {
      const totalMinutes = timeResult ? timeResult.total_minutes || 0 : 0;
      
      // Archive the completed job
      db.run(`
        INSERT INTO archived_jobs (
          original_job_id, title, description, customer_name, vehicle_info,
          assigned_to, assigned_to_name, created_by, created_by_name,
          estimated_hours, actual_hours, created_at, updated_at,
          total_time_minutes, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        job.id, job.title, job.description,
        job.customer_name, job.vehicle_info,
        job.assigned_to, job.assigned_to_name,
        job.created_by, job.created_by_name,
        job.estimated_hours, job.actual_hours,
        job.created_at, job.updated_at,
        totalMinutes, 'Lavoro archiviato manualmente'
      ], function(archiveErr) {
        if (archiveErr) {
          return res.status(500).json({ error: 'Errore nell\'archiviazione' });
        }

        // Delete the job from the main jobs table
        db.run('DELETE FROM jobs WHERE id = ?', [jobId], (deleteErr) => {
          if (deleteErr) {
            return res.status(500).json({ error: 'Errore nella rimozione del lavoro' });
          }

          // Emit to all connected clients that job was archived
          io.emit('jobArchived', { jobId: parseInt(jobId) });
          
          res.json({ 
            message: 'Lavoro archiviato con successo',
            archivedJobId: this.lastID 
          });
        });
      });
    });
  });
});

// ===== CALENDAR EVENTS ROUTES =====

// Get all calendar events
app.get('/api/calendar-events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT ce.*, u.name as created_by_name 
    FROM calendar_events ce 
    LEFT JOIN users u ON ce.created_by = u.id 
    ORDER BY ce.event_date ASC, ce.event_time ASC
  `, (err, events) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(events);
  });
});

// Create new calendar event
app.post('/api/calendar-events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { title, description, event_date, event_time, type, priority } = req.body;

  if (!title || !event_date) {
    return res.status(400).json({ error: 'Titolo e data sono obbligatori' });
  }

  db.run(`
    INSERT INTO calendar_events (title, description, event_date, event_time, type, priority, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [title, description, event_date, event_time, type || 'event', priority || 'medium', req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Get the created event
    db.get(`
      SELECT ce.*, u.name as created_by_name 
      FROM calendar_events ce 
      LEFT JOIN users u ON ce.created_by = u.id 
      WHERE ce.id = ?
    `, [this.lastID], (err, event) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Emit real-time update
      io.emit('eventCreated', event);
      res.status(201).json(event);
    });
  });
});

// Update calendar event
app.put('/api/calendar-events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { id } = req.params;
  const { title, description, event_date, event_time, type, priority } = req.body;

  db.run(`
    UPDATE calendar_events 
    SET title = ?, description = ?, event_date = ?, event_time = ?, type = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [title, description, event_date, event_time, type, priority, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    // Get the updated event
    db.get(`
      SELECT ce.*, u.name as created_by_name 
      FROM calendar_events ce 
      LEFT JOIN users u ON ce.created_by = u.id 
      WHERE ce.id = ?
    `, [id], (err, event) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Emit real-time update
      io.emit('eventUpdated', event);
      res.json(event);
    });
  });
});

// Delete calendar event
app.delete('/api/calendar-events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { id } = req.params;

  db.run('DELETE FROM calendar_events WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    // Emit real-time update
    io.emit('eventDeleted', { id: parseInt(id) });
    res.json({ message: 'Evento eliminato con successo' });
  });
});

// ===== TIMER ROUTES =====

// Start timer
app.post('/api/jobs/:id/timer/start', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;

  // Check if there's already an active timer for this specific job and user
  db.get(
    'SELECT * FROM time_logs WHERE user_id = ? AND job_id = ? AND end_time IS NULL',
    [userId, jobId],
    (err, activeTimer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (activeTimer) {
        return res.status(400).json({ error: 'Hai già un timer attivo per questo lavoro' });
      }

      // Start new timer
      db.run(
        'INSERT INTO time_logs (job_id, user_id, start_time) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [jobId, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Update job status to 'in_progress' if it's 'todo'
          db.run(
            'UPDATE jobs SET status = CASE WHEN status = "todo" THEN "in_progress" ELSE status END WHERE id = ?',
            [jobId]
          );

          res.json({ id: this.lastID, message: 'Timer avviato' });
        }
      );
    }
  );
});

// Stop timer
app.post('/api/jobs/:id/timer/stop', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;

  db.get(
    'SELECT * FROM time_logs WHERE job_id = ? AND user_id = ? AND end_time IS NULL',
    [jobId, userId],
    (err, timer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (!timer) {
        return res.status(404).json({ error: 'Timer attivo non trovato' });
      }

      db.run(
        `UPDATE time_logs 
         SET end_time = CURRENT_TIMESTAMP,
             duration_minutes = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(start_time)) * 1440)
         WHERE id = ?`,
        [timer.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Update total actual hours for the job
          db.run(
            `UPDATE jobs 
             SET actual_hours = (
               SELECT ROUND(SUM(duration_minutes) / 60.0, 2)
               FROM time_logs 
               WHERE job_id = ? AND end_time IS NOT NULL
             )
             WHERE id = ?`,
            [jobId, jobId]
          );

          res.json({ message: 'Timer fermato' });
        }
      );
    }
  );
});

// Get active timer for user
app.get('/api/timer/active', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT tl.*, j.title as job_title 
     FROM time_logs tl 
     JOIN jobs j ON tl.job_id = j.id 
     WHERE tl.user_id = ? AND tl.end_time IS NULL`,
    [userId],
    (err, activeTimers) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      res.json(activeTimers);
    }
  );
});

// Employee Management Endpoints

// Get all employees (admin only)
app.get('/api/employees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const query = `
    SELECT e.*, u.email, u.name as user_name,
           COALESCE(SUM(tl.duration_minutes), 0) as total_minutes_worked
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN time_logs tl ON u.id = tl.user_id
    WHERE e.status = 'active'
    GROUP BY e.id
    ORDER BY e.last_name, e.first_name
  `;

  db.all(query, [], (err, employees) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(employees);
  });
});

// Get single employee (admin only)
app.get('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const query = `
    SELECT e.*, u.email, u.name as user_name,
           COALESCE(SUM(tl.duration_minutes), 0) as total_minutes_worked
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN time_logs tl ON u.id = tl.user_id
    WHERE e.id = ?
    GROUP BY e.id
  `;

  db.get(query, [req.params.id], (err, employee) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    if (!employee) {
      return res.status(404).json({ error: 'Dipendente non trovato' });
    }
    res.json(employee);
  });
});

// Create employee (admin only)
app.post('/api/employees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const {
    employee_code,
    first_name,
    last_name,
    position,
    department,
    hire_date,
    hourly_rate,
    phone,
    address,
    user_id
  } = req.body;

  if (!employee_code || !first_name || !last_name || !position || !hire_date) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  db.run(
    `INSERT INTO employees (employee_code, first_name, last_name, position, department, hire_date, hourly_rate, phone, address, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee_code, first_name, last_name, position, department, hire_date, hourly_rate || 0, phone, address, user_id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Codice dipendente già esistente' });
        }
        return res.status(500).json({ error: 'Errore del database' });
      }

      // Get the created employee
      db.get(
        `SELECT e.*, u.email, u.name as user_name
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = ?`,
        [this.lastID],
        (err, employee) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }
          res.status(201).json(employee);
        }
      );
    }
  );
});

// Update employee (admin only)
app.put('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const {
    employee_code,
    first_name,
    last_name,
    position,
    department,
    hire_date,
    hourly_rate,
    phone,
    address,
    status
  } = req.body;

  db.run(
    `UPDATE employees SET 
     employee_code = ?, first_name = ?, last_name = ?, position = ?, 
     department = ?, hire_date = ?, hourly_rate = ?, phone = ?, 
     address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [employee_code, first_name, last_name, position, department, hire_date, hourly_rate, phone, address, status, req.params.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Codice dipendente già esistente' });
        }
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Dipendente non trovato' });
      }

      // Get the updated employee
      db.get(
        `SELECT e.*, u.email, u.name as user_name
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = ?`,
        [req.params.id],
        (err, employee) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }
          res.json(employee);
        }
      );
    }
  );
});

// Delete employee (admin only)
app.delete('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.run(
    'UPDATE employees SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Dipendente non trovato' });
      }

      res.json({ message: 'Dipendente disattivato con successo' });
    }
  );
});

// Get employee work hours summary (admin only)
app.get('/api/employees/:id/hours', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { startDate, endDate } = req.query;
  let query = `
    SELECT 
      DATE(tl.start_time) as work_date,
      SUM(tl.duration_minutes) as total_minutes,
      COUNT(tl.id) as sessions_count,
      GROUP_CONCAT(j.title) as jobs_worked
    FROM time_logs tl
    JOIN jobs j ON tl.job_id = j.id
    JOIN employees e ON e.user_id = tl.user_id
    WHERE e.id = ? AND tl.end_time IS NOT NULL
  `;
  
  let params = [req.params.id];

  if (startDate) {
    query += ' AND DATE(tl.start_time) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND DATE(tl.start_time) <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY DATE(tl.start_time) ORDER BY work_date DESC';

  db.all(query, params, (err, hours) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(hours);
  });
});

// Customer routes

// Get all customers
app.get('/api/customers', authenticateToken, (req, res) => {
  db.all("SELECT * FROM customers ORDER BY name ASC", (err, customers) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(customers);
  });
});

// Get customer by ID
app.get('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  
  db.get("SELECT * FROM customers WHERE id = ?", [customerId], (err, customer) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!customer) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    res.json(customer);
  });
});

// Create new customer
app.post('/api/customers', authenticateToken, (req, res) => {
  const { name, email, phone, address, company, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }
  
  const query = `
    INSERT INTO customers (name, email, phone, address, company, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [name, email, phone, address, company, notes], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante la creazione del cliente' });
    }
    
    // Get the created customer
    db.get("SELECT * FROM customers WHERE id = ?", [this.lastID], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      io.emit('customerCreated', customer);
      res.status(201).json(customer);
    });
  });
});

// Update customer
app.put('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  const { name, email, phone, address, company, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }
  
  const query = `
    UPDATE customers 
    SET name = ?, email = ?, phone = ?, address = ?, company = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, email, phone, address, company, notes, customerId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante l\'aggiornamento del cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    // Get the updated customer
    db.get("SELECT * FROM customers WHERE id = ?", [customerId], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      io.emit('customerUpdated', customer);
      res.json(customer);
    });
  });
});

// Delete customer
app.delete('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  
  db.run("DELETE FROM customers WHERE id = ?", [customerId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante l\'eliminazione del cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    io.emit('customerDeleted', { id: parseInt(customerId) });
    res.json({ message: 'Cliente eliminato con successo' });
  });
});

// Catch-all handler: send back React's index.html file for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connesso:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnesso:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3000`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});

module.exports = { app, server, db };