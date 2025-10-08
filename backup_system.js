const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
require('dotenv').config();

class DatabaseBackupSystem {
  constructor() {
    this.dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
    this.backupDir = path.join(__dirname, 'backups');
    this.maxBackups = 30; // Mantieni 30 backup (circa 1 mese)
    
    // Crea directory backup se non esiste
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Directory backup creata:', this.backupDir);
    }
  }

  generateBackupFilename() {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    return `database_backup_${timestamp}.db`;
  }

  async createBackup() {
    return new Promise((resolve, reject) => {
      try {
        const backupFilename = this.generateBackupFilename();
        const backupPath = path.join(this.backupDir, backupFilename);
        
        console.log('🔄 Iniziando backup database...');
        console.log('📂 Sorgente:', this.dbPath);
        console.log('💾 Destinazione:', backupPath);

        // Verifica che il database sorgente esista
        if (!fs.existsSync(this.dbPath)) {
          throw new Error(`Database sorgente non trovato: ${this.dbPath}`);
        }

        // Copia il file database
        fs.copyFileSync(this.dbPath, backupPath);
        
        // Verifica l'integrità del backup
        const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY);
        
        db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err, row) => {
          db.close();
          
          if (err) {
            console.error('❌ Backup corrotto:', err.message);
            // Rimuovi backup corrotto
            if (fs.existsSync(backupPath)) {
              fs.unlinkSync(backupPath);
            }
            reject(err);
            return;
          }

          const backupSize = fs.statSync(backupPath).size;
          const originalSize = fs.statSync(this.dbPath).size;
          
          console.log('✅ Backup completato con successo!');
          console.log(`📊 Dimensione originale: ${(originalSize / 1024).toFixed(2)} KB`);
          console.log(`📊 Dimensione backup: ${(backupSize / 1024).toFixed(2)} KB`);
          console.log(`🗂️ Tabelle trovate: ${row.count}`);
          
          resolve({
            filename: backupFilename,
            path: backupPath,
            size: backupSize,
            tables: row.count,
            timestamp: new Date()
          });
        });

      } catch (error) {
        console.error('❌ Errore durante backup:', error.message);
        reject(error);
      }
    });
  }

  async cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('database_backup_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime); // Più recenti primi

      if (files.length > this.maxBackups) {
        const filesToDelete = files.slice(this.maxBackups);
        
        console.log(`🧹 Rimuovendo ${filesToDelete.length} backup vecchi...`);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Rimosso: ${file.name}`);
        }
        
        console.log(`✅ Mantenuti ${this.maxBackups} backup più recenti`);
      } else {
        console.log(`📊 Backup attuali: ${files.length}/${this.maxBackups}`);
      }

    } catch (error) {
      console.error('❌ Errore durante pulizia backup:', error.message);
    }
  }

  async listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('database_backup_') && file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
            sizeKB: (stats.size / 1024).toFixed(2)
          };
        })
        .sort((a, b) => b.created - a.created);

      console.log('\n📋 Backup disponibili:');
      files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name}`);
        console.log(`     📅 Creato: ${file.created.toLocaleString()}`);
        console.log(`     📊 Dimensione: ${file.sizeKB} KB`);
      });

      return files;
    } catch (error) {
      console.error('❌ Errore listando backup:', error.message);
      return [];
    }
  }

  async restoreBackup(backupFilename) {
    return new Promise((resolve, reject) => {
      try {
        const backupPath = path.join(this.backupDir, backupFilename);
        
        if (!fs.existsSync(backupPath)) {
          throw new Error(`Backup non trovato: ${backupFilename}`);
        }

        console.log('🔄 Iniziando ripristino database...');
        console.log('📂 Backup:', backupPath);
        console.log('💾 Destinazione:', this.dbPath);

        // Crea backup del database corrente prima del ripristino
        const currentBackupName = `current_backup_${Date.now()}.db`;
        const currentBackupPath = path.join(this.backupDir, currentBackupName);
        
        if (fs.existsSync(this.dbPath)) {
          fs.copyFileSync(this.dbPath, currentBackupPath);
          console.log('💾 Backup corrente salvato come:', currentBackupName);
        }

        // Ripristina il backup
        fs.copyFileSync(backupPath, this.dbPath);
        
        // Verifica l'integrità del database ripristinato
        const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
        
        db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err, row) => {
          db.close();
          
          if (err) {
            console.error('❌ Database ripristinato corrotto:', err.message);
            // Ripristina il backup corrente
            if (fs.existsSync(currentBackupPath)) {
              fs.copyFileSync(currentBackupPath, this.dbPath);
              console.log('🔄 Database corrente ripristinato');
            }
            reject(err);
            return;
          }

          console.log('✅ Ripristino completato con successo!');
          console.log(`🗂️ Tabelle ripristinate: ${row.count}`);
          
          resolve({
            restored: backupFilename,
            tables: row.count,
            currentBackup: currentBackupName
          });
        });

      } catch (error) {
        console.error('❌ Errore durante ripristino:', error.message);
        reject(error);
      }
    });
  }

  startAutomaticBackup() {
    // Backup giornaliero alle 2:00 AM
    const dailyBackup = cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Avvio backup automatico giornaliero...');
      try {
        await this.createBackup();
        await this.cleanOldBackups();
      } catch (error) {
        console.error('❌ Errore backup automatico:', error.message);
      }
    }, {
      scheduled: false,
      timezone: "Europe/Rome"
    });

    // Backup settimanale la domenica alle 1:00 AM
    const weeklyBackup = cron.schedule('0 1 * * 0', async () => {
      console.log('⏰ Avvio backup automatico settimanale...');
      try {
        const backup = await this.createBackup();
        // Marca i backup settimanali con un prefisso speciale
        const weeklyPath = backup.path.replace('database_backup_', 'weekly_backup_');
        fs.renameSync(backup.path, weeklyPath);
        console.log('📅 Backup settimanale salvato come:', path.basename(weeklyPath));
      } catch (error) {
        console.error('❌ Errore backup settimanale:', error.message);
      }
    }, {
      scheduled: false,
      timezone: "Europe/Rome"
    });

    dailyBackup.start();
    weeklyBackup.start();

    console.log('⏰ Sistema backup automatico avviato:');
    console.log('  📅 Backup giornaliero: ogni giorno alle 2:00');
    console.log('  📅 Backup settimanale: domenica alle 1:00');
    console.log(`  🗂️ Directory backup: ${this.backupDir}`);
    console.log(`  📊 Backup mantenuti: ${this.maxBackups}`);

    return { dailyBackup, weeklyBackup };
  }
}

// Funzioni di utilità per uso da CLI
async function createManualBackup() {
  const backupSystem = new DatabaseBackupSystem();
  try {
    const result = await backupSystem.createBackup();
    await backupSystem.cleanOldBackups();
    return result;
  } catch (error) {
    console.error('❌ Errore backup manuale:', error.message);
    throw error;
  }
}

async function listAllBackups() {
  const backupSystem = new DatabaseBackupSystem();
  return await backupSystem.listBackups();
}

async function restoreFromBackup(filename) {
  const backupSystem = new DatabaseBackupSystem();
  return await backupSystem.restoreBackup(filename);
}

// Esecuzione da CLI
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'backup':
      createManualBackup()
        .then(result => {
          console.log('🎉 Backup manuale completato:', result.filename);
          process.exit(0);
        })
        .catch(error => {
          console.error('❌ Backup fallito:', error.message);
          process.exit(1);
        });
      break;
      
    case 'list':
      listAllBackups()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('❌ Errore:', error.message);
          process.exit(1);
        });
      break;
      
    case 'restore':
      const filename = process.argv[3];
      if (!filename) {
        console.error('❌ Specificare il nome del file backup');
        console.log('Uso: node backup_system.js restore <filename>');
        process.exit(1);
      }
      
      restoreFromBackup(filename)
        .then(result => {
          console.log('🎉 Ripristino completato:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('❌ Ripristino fallito:', error.message);
          process.exit(1);
        });
      break;
      
    case 'start':
      const backupSystem = new DatabaseBackupSystem();
      backupSystem.startAutomaticBackup();
      console.log('🚀 Sistema backup avviato. Premi Ctrl+C per fermare.');
      break;
      
    default:
      console.log('📖 Sistema Backup Database Motta 5');
      console.log('');
      console.log('Comandi disponibili:');
      console.log('  backup  - Crea backup manuale');
      console.log('  list    - Lista tutti i backup');
      console.log('  restore <filename> - Ripristina da backup');
      console.log('  start   - Avvia sistema backup automatico');
      console.log('');
      console.log('Esempi:');
      console.log('  node backup_system.js backup');
      console.log('  node backup_system.js list');
      console.log('  node backup_system.js restore database_backup_2024-01-15_14-30-00.db');
      break;
  }
}

module.exports = { 
  DatabaseBackupSystem, 
  createManualBackup, 
  listAllBackups, 
  restoreFromBackup 
};