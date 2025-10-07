const sqlite3 = require('sqlite3').verbose();

// Apri il database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Errore nell\'apertura del database:', err.message);
  } else {
    console.log('Connesso al database SQLite.');
  }
});

async function createSampleData() {
  try {
    console.log('Creazione lavori di esempio...');
    
    // Crea lavori di esempio
    const jobs = [
      {
        title: 'Riparazione Impianto Elettrico',
        description: 'Riparazione impianto elettrico presso abitazione privata in Via Roma 15',
        customer_name: 'Cliente Roma',
        vehicle_info: 'Fiat Punto 2015',
        assigned_to: 2, // Mario Rossi
        created_by: 1, // Admin
        status: 'todo',
        estimated_hours: 4.0
      },
      {
        title: 'Installazione Condizionatore',
        description: 'Installazione nuovo condizionatore presso ufficio in Via Milano 30',
        customer_name: 'Ufficio Milano',
        vehicle_info: 'BMW Serie 3 2018',
        assigned_to: 3, // Giulia Bianchi
        created_by: 1, // Admin
        status: 'in_progress',
        estimated_hours: 6.0
      },
      {
        title: 'Manutenzione Caldaia',
        description: 'Controllo e manutenzione caldaia presso condominio Via Torino 8',
        customer_name: 'Condominio Torino',
        vehicle_info: 'Mercedes Vito 2020',
        assigned_to: 4, // Luca Verdi
        created_by: 1, // Admin
        status: 'todo',
        estimated_hours: 3.0
      },
      {
        title: 'Riparazione Tubature',
        description: 'Riparazione perdita tubature bagno principale',
        customer_name: 'Famiglia Bianchi',
        vehicle_info: 'Volkswagen Golf 2019',
        assigned_to: 2, // Mario Rossi
        created_by: 1, // Admin
        status: 'todo',
        estimated_hours: 2.5
      },
      {
        title: 'Installazione Luci LED',
        description: 'Sostituzione illuminazione tradizionale con LED in negozio',
        customer_name: 'Negozio Centro',
        vehicle_info: 'Ford Transit 2017',
        assigned_to: 3, // Giulia Bianchi
        created_by: 1, // Admin
        status: 'completed',
        estimated_hours: 5.0
      }
    ];

    // Inserisci lavori
    for (const job of jobs) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO jobs (title, description, customer_name, vehicle_info, assigned_to, created_by, status, estimated_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [job.title, job.description, job.customer_name, job.vehicle_info, job.assigned_to, job.created_by, job.status, job.estimated_hours],
          function(err) {
            if (err) {
              console.error('Errore nell\'inserimento del lavoro:', err.message);
              reject(err);
            } else {
              console.log(`Lavoro creato: ${job.title} (ID: ${this.lastID}) - Assegnato a: ${job.assigned_to}`);
              resolve(this.lastID);
            }
          }
        );
      });
    }

    console.log('\n✅ Dati di esempio creati con successo!');
    console.log('\nCredenziali dipendenti:');
    console.log('Email: mario.rossi@motta.it - Password: dipendente123');
    console.log('Email: giulia.bianchi@motta.it - Password: dipendente123');
    console.log('Email: luca.verdi@motta.it - Password: dipendente123');
    
  } catch (error) {
    console.error('Errore nella creazione dei dati:', error);
  } finally {
    // Chiudi il database
    db.close((err) => {
      if (err) {
        console.error('Errore nella chiusura del database:', err.message);
      } else {
        console.log('\nDatabase chiuso.');
      }
    });
  }
}

createSampleData();