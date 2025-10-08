# Motta Carrozzeria - Sistema Gestionale

Sistema gestionale completo per la carrozzeria Motta con timer per dipendenti e dashboard amministrativa.

## Deploy su Vercel

### Prerequisiti
- Account Vercel
- Vercel CLI installato (`npm i -g vercel`)

### Configurazione Variabili d'Ambiente

Prima del deploy, configura le seguenti variabili d'ambiente su Vercel:

1. `JWT_SECRET` - Chiave segreta per JWT (genera una stringa sicura)
2. `DATABASE_PATH` - Path del database (per Vercel: `/tmp/database.db`)
3. `NODE_ENV` - Imposta su `production`
4. `CORS_ORIGIN` - URL del tuo dominio Vercel (es: `https://your-app.vercel.app`)

### Comandi per il Deploy

```bash
# 1. Installa le dipendenze
npm run install-all

# 2. Build del progetto
npm run build

# 3. Deploy su Vercel
vercel --prod
```

### Configurazione Vercel Dashboard

1. Vai su [vercel.com](https://vercel.com)
2. Importa il progetto dal repository
3. Configura le variabili d'ambiente nella sezione Settings > Environment Variables
4. Deploy automatico ad ogni push

### Struttura del Progetto

- `/client` - Frontend React
- `/server` - Backend Node.js/Express
- `/database.db` - Database SQLite
- `vercel.json` - Configurazione Vercel

### Note Importanti

- Il database SQLite verrà ricreato ad ogni deploy su Vercel
- Per un ambiente di produzione, considera l'uso di un database esterno (PostgreSQL, MySQL)
- Le credenziali demo sono state rimosse per sicurezza