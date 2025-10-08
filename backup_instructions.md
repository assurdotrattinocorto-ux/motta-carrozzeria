# Sistema di Backup Automatico - Motta 5

## Panoramica
Il sistema di backup automatico è stato implementato per proteggere i dati del database SQLite dell'applicazione Motta 5. Il sistema offre backup automatici programmati e comandi manuali per la gestione dei backup.

## Caratteristiche

### ✅ Backup Automatici
- **Backup giornaliero**: Ogni giorno alle 2:00 AM
- **Backup settimanale**: Ogni domenica alle 1:00 AM (marcati con prefisso `weekly_`)
- **Pulizia automatica**: Mantiene solo gli ultimi 30 backup
- **Verifica integrità**: Ogni backup viene verificato prima di essere salvato

### ✅ Gestione Manuale
- Creazione backup on-demand
- Lista di tutti i backup disponibili
- Ripristino da backup specifico
- Pulizia automatica dei backup vecchi

## Comandi Disponibili

### 1. Creare un Backup Manuale
```bash
node backup_system.js backup
```
Crea immediatamente un backup del database corrente.

### 2. Elencare Tutti i Backup
```bash
node backup_system.js list
```
Mostra tutti i backup disponibili con data, ora e dimensione.

### 3. Ripristinare da Backup
```bash
node backup_system.js restore <nome_file_backup>
```
Ripristina il database da un backup specifico.

**Esempio:**
```bash
node backup_system.js restore database_backup_2024-01-15_14-30-00.db
```

### 4. Avviare Sistema Automatico
```bash
node backup_system.js start
```
Avvia il sistema di backup automatico (normalmente si avvia automaticamente con il server).

## Configurazione

### Variabili di Ambiente
- `DATABASE_PATH`: Percorso del database SQLite (default: `./database.db`)

### Impostazioni Sistema
- **Directory backup**: `./backups/`
- **Backup mantenuti**: 30 (circa 1 mese)
- **Formato nome file**: `database_backup_YYYY-MM-DD_HH-mm-ss.db`
- **Backup settimanali**: `weekly_backup_YYYY-MM-DD_HH-mm-ss.db`

## Sicurezza e Integrità

### ✅ Verifiche Implementate
1. **Verifica esistenza database sorgente**
2. **Test integrità backup** (conteggio tabelle)
3. **Confronto dimensioni** file originale vs backup
4. **Backup di sicurezza** prima del ripristino
5. **Gestione errori** completa con rollback

### ✅ Protezioni
- Backup corrotti vengono automaticamente rimossi
- Prima del ripristino viene creato un backup del database corrente
- Logs dettagliati per monitoraggio e debug

## Integrazione con il Server

Il sistema di backup si avvia automaticamente quando il server viene lanciato (solo per database SQLite). I log del sistema appaiono nella console del server:

```
💾 Sistema backup automatico inizializzato
⏰ Sistema backup automatico avviato:
  📅 Backup giornaliero: ogni giorno alle 2:00
  📅 Backup settimanale: domenica alle 1:00
  🗂️ Directory backup: C:\Users\...\Motta 5\backups
  📊 Backup mantenuti: 30
```

## Monitoraggio

### Log di Backup Riuscito
```
✅ Backup completato con successo!
📊 Dimensione originale: 144.00 KB
📊 Dimensione backup: 144.00 KB
🗂️ Tabelle trovate: 10
```

### Log di Errore
```
❌ Errore durante backup: [messaggio errore]
```

## Best Practices

1. **Verifica regolare**: Controlla periodicamente i log per assicurarti che i backup vengano creati correttamente
2. **Test di ripristino**: Testa occasionalmente il ripristino da backup in un ambiente di sviluppo
3. **Backup esterni**: Considera di copiare periodicamente i backup su storage esterno o cloud
4. **Monitoraggio spazio**: Controlla che ci sia spazio sufficiente nella directory backup

## Risoluzione Problemi

### Backup Non Creati
- Verifica che il database SQLite esista nel percorso specificato
- Controlla i permessi di scrittura nella directory backup
- Verifica i log del server per errori

### Ripristino Fallito
- Assicurati che il file di backup esista e non sia corrotto
- Verifica i permessi di scrittura sul database
- Il sistema crea automaticamente un backup di sicurezza prima del ripristino

### Spazio Insufficiente
- Il sistema mantiene automaticamente solo 30 backup
- Puoi ridurre il numero modificando `maxBackups` nel codice
- Considera di spostare backup vecchi su storage esterno

## Supporto

Per problemi o domande sul sistema di backup, controlla:
1. I log del server per messaggi di errore
2. La directory `./backups/` per verificare la presenza dei file
3. I permessi di lettura/scrittura delle directory coinvolte