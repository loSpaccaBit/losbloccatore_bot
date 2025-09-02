# 🚀 Deployment Guide - LosBloccatore Bot

Guida completa per il deployment del bot su VPS con PM2, PostgreSQL e Nginx.

## 📋 Prerequisiti

- **VPS/Server** con Ubuntu 20.04+ (o Debian-based)
- **Accesso root** o utente con privilegi sudo
- **Dominio** (opzionale, per configurazione Nginx)
- **Bot Token** da @BotFather
- **Channel ID** del tuo canale Telegram

## 🛠 Deployment Automatico

### 1. Preparazione Locale

Prima di tutto, aggiorna i file di configurazione:

```bash
# Clona il repository sulla tua VPS
git clone https://github.com/your-username/losbloccatore-bot.git
cd losbloccatore-bot

# Rendi eseguibili gli script
chmod +x deploy.sh
chmod +x scripts/setup-production.sh
```

**⚠️ IMPORTANTE**: Aggiorna questi file prima del deployment:
- `deploy.sh` → Cambia `REPO_URL` con la tua repository
- `ecosystem.config.js` → Aggiorna `repo` e `host` nella sezione deploy

### 2. Configurazione Ambiente

Esegui lo script di setup per configurare le variabili d'ambiente:

```bash
./scripts/setup-production.sh
```

Questo script ti chiederà:
- 🤖 **Bot Token**: Da @BotFather
- 📢 **Channel ID**: ID del tuo canale (numero negativo)
- 🗄️ **Database**: Host, porta, nome, username, password
- ⚙️ **App Settings**: Porta, log level, cache TTL
- 👑 **Admin ID**: Il tuo user ID Telegram (opzionale)

### 3. Deployment Completo

Esegui lo script principale come root:

```bash
sudo ./deploy.sh
```

Lo script automaticamente:
- ✅ Installa Node.js, PostgreSQL, PM2, Nginx
- ✅ Crea utente applicazione (`appuser`)
- ✅ Configura database e utente PostgreSQL
- ✅ Clona e builda l'applicazione
- ✅ Setup schema database con Prisma
- ✅ Configura PM2 per auto-restart
- ✅ Setup Nginx reverse proxy
- ✅ Configura firewall (UFW)

## 🔧 Configurazione Post-Deployment

### 1. Verifica Deployment

```bash
# Status PM2
pm2 list
pm2 logs losbloccatore

# Status servizi sistema
systemctl status nginx
systemctl status postgresql

# Test bot
curl http://localhost:3000/health  # Se hai endpoint health
```

### 2. Configurazione Dominio

Se hai un dominio, aggiorna Nginx:

```bash
sudo nano /etc/nginx/sites-available/losbloccatore-bot
# Cambia: server_name your-domain.com;
# Con: server_name tuodominio.it;

sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL Certificate (Raccomandato)

```bash
# Installa Certbot
sudo apt install snapd
sudo snap install --classic certbot

# Ottieni certificato
sudo certbot --nginx -d tuodominio.it

# Auto-renewal è già configurato
```

### 4. Test Bot

Manda `/start` al tuo bot per verificare che funzioni!

## 📊 Monitoring e Manutenzione

### Comandi PM2 Essenziali

```bash
# Visualizza processi
pm2 list

# Log in tempo reale
pm2 logs losbloccatore

# Riavvia app
pm2 restart losbloccatore

# Monitoring dashboard
pm2 monit

# Salva configurazione PM2
pm2 save
```

### Log Files

```bash
# Application logs
tail -f /opt/losbloccatore-bot/logs/combined.log

# Error logs
tail -f /opt/losbloccatore-bot/logs/error.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Database Maintenance

```bash
# Accedi al database
sudo -u postgres psql losbloccatore

# Backup database
sudo -u postgres pg_dump losbloccatore > backup_$(date +%Y%m%d).sql

# Monitor connessioni
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='losbloccatore';"
```

## 🔄 Updates e Redeploy

### Update Automatico via Git

```bash
cd /opt/losbloccatore-bot
sudo -u appuser git pull origin main
sudo -u appuser npm ci --production
sudo -u appuser npm run build
sudo -u appuser npm run db:deploy  # Se ci sono nuove migrazioni
pm2 restart losbloccatore
```

### Redeploy Completo

```bash
# Stop app
pm2 stop losbloccatore

# Update codice
cd /opt/losbloccatore-bot
sudo -u appuser git pull origin main
sudo -u appuser npm ci --production
sudo -u appuser npm run build
sudo -u appuser npm run db:deploy

# Restart
pm2 start ecosystem.config.js
```

## 🛡️ Security Best Practices

### 1. Firewall
```bash
# Status firewall
sudo ufw status

# Chiudi porte non necessarie
sudo ufw deny 3000  # App porta (solo Nginx dovrebbe accedere)
```

### 2. Database Security
```bash
# Change default PostgreSQL password
sudo -u postgres psql
\password postgres
```

### 3. File Permissions
```bash
# Verifica permessi
ls -la /opt/losbloccatore-bot/.env  # Dovrebbe essere 600 (rw-------)
ls -la /opt/losbloccatore-bot/     # Dovrebbe appartenere ad appuser
```

### 4. Regular Updates
```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Node.js security updates
sudo -u appuser npm audit
sudo -u appuser npm audit fix
```

## 🐛 Troubleshooting

### Bot Non Risponde

```bash
# Check PM2 status
pm2 list
pm2 logs losbloccatore --lines 50

# Check database connection
sudo -u appuser npm run db:studio  # In dev per debug
```

### Database Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Reset schema (⚠️ PERDE DATI)
sudo -u appuser npm run db:push --force-reset
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

### Memory Issues

```bash
# Check memory usage
free -h
pm2 monit

# Restart if needed
pm2 restart losbloccatore
```

## 📁 Directory Structure (Produzione)

```
/opt/losbloccatore-bot/
├── dist/                 # Compiled TypeScript
├── src/                  # Source code
├── prisma/              # Database schema & migrations
├── logs/                # Application logs
├── pids/                # Process IDs
├── .env                 # Environment variables (600 permissions)
├── ecosystem.config.js   # PM2 configuration
└── package.json         # Dependencies
```

## 📞 Support

Se hai problemi:

1. **Check logs**: `pm2 logs losbloccatore`
2. **System status**: `systemctl status nginx postgresql`
3. **Database**: Test connessione con Prisma Studio
4. **Firewall**: `sudo ufw status`
5. **Bot test**: Manda `/start` per verificare risposta

## 🚀 Performance Tips

- **Monitor** regolarmente con `pm2 monit`
- **Database cleanup** periodico dei log vecchi
- **Log rotation** è già configurato
- **Auto-restart** attivo in caso di crash
- **Memory limit** impostato a 1GB (modificabile in ecosystem.config.js)

---

**🎉 Il tuo bot è ora in produzione!** 

Ricordati di testare tutte le funzionalità e monitorare i log nei primi giorni.