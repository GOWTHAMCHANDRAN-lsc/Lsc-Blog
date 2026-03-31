# Deploying SaaS Blog Platform on Hostinger VPS (Ubuntu)

This guide covers deploying the SaaS Blog Platform on a Hostinger VPS running Ubuntu 22.04.

## Prerequisites

- Hostinger VPS with Ubuntu 22.04
- Domain pointing to your VPS IP
- SSH access to the VPS
- At least 4GB RAM, 2 CPU cores recommended

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      VPS (Ubuntu 22.04)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  Nginx      │  │  Next.js    │  │  Admin API      │   │
│  │  (Reverse   │──│  Dashboard  │  │  (Express)     │   │
│  │  Proxy)     │  │  (Port 3002)│  │  (Port 3001)    │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                         │                                   │
│                   ┌─────┴─────┐                           │
│                   │  Redis     │                           │
│                   │  (Cache)   │                           │
│                   └───────────┘                           │
│                         │                                   │
│                   ┌───────────┐                           │
│                   │  PostgreSQL│                          │
│                   │ (Database) │                           │
│                   └───────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Initial Server Setup

### Connect to VPS via SSH

```bash
ssh root@your-vps-ip
```

### Update System

```bash
apt update && apt upgrade -y
```

### Create Deployment User

```bash
# Create user
adduser deploy

# Add to sudo group
usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

---

## Step 2: Install Required Software

### Install Node.js 20.x

```bash
# Add Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configure PostgreSQL
sudo -u postgres psql
```

In PostgreSQL console:

```sql
-- Create database user
CREATE USER bloguser WITH PASSWORD 'your_secure_password';

-- Create database
CREATE DATABASE blogplatform OWNER bloguser;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE blogplatform TO bloguser;

-- Exit
\q
```

### Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis to persist
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup
pm2 startup
```

### Install Build Essentials

```bash
sudo apt install -y build-essential git unzip zip
```

---

## Step 3: Clone and Setup Application

### Create Application Directory

```bash
mkdir -p /var/www/blog-platform
cd /var/www/blog-platform
```

### Clone Repository

```bash
# If using Git
git clone https://github.com/your-repo/saas-blog-platform.git .

# Or upload via SFTP/FTP
```

### Install Dependencies

```bash
npm install
```

### Create Environment Variables

```bash
# Create .env file for API
nano apps/admin-api/.env
```

```env
# Database
DATABASE_URL=postgresql://bloguser:your_secure_password@localhost:5432/blogplatform

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this

# App URLs
FRONTEND_URL=https://your-domain.com
ADMIN_URL=https://admin.your-domain.com

# Server
PORT=3001
NODE_ENV=production

# Email (optional - for sending)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
```

```bash
# Create .env for dashboard
nano apps/admin-dashboard/.env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### Build Application

```bash
# Build the application
npm run build
```

---

## Step 4: Configure Database

### Run Migrations

```bash
cd /var/www/blog-platform
npm run db:migrate
```

### (Optional) Seed Database

```bash
npm run db:seed
```

---

## Step 5: Configure PM2 for Process Management

### Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'admin-api',
      script: 'apps/admin-api/dist/index.js',
      cwd: '/var/www/blog-platform',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/admin-api-error.log',
      out_file: '/var/log/pm2/admin-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'admin-dashboard',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/blog-platform/apps/admin-dashboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: '/var/log/pm2/admin-dashboard-error.log',
      out_file: '/var/log/pm2/admin-dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
    },
  ],
};
```

### Create Log Directory

```bash
sudo mkdir -p /var/log/pm2
sudo chmod 755 /var/log/pm2
```

### Start Application with PM2

```bash
cd /var/www/blog-platform
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### Check Status

```bash
pm2 status
pm2 logs
```

---

## Step 6: Configure Nginx as Reverse Proxy

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/blog-platform
```

```nginx
# Admin API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Admin Dashboard
server {
    listen 80;
    server_name admin.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Main Blog Frontend (optional - serves as API proxy)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/blog-platform /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Configure SSL/HTTPS (Recommended)

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get SSL Certificate

```bash
# For all domains
sudo certbot --nginx -d api.your-domain.com -d admin.your-domain.com -d your-domain.com

# Follow the prompts
# Enter email
# Agree to terms
# Choose to redirect HTTP to HTTPS
```

### Auto-Renewal Test

```bash
sudo certbot renew --dry-run
```

---

## Step 8: Firewall Configuration

### Configure UFW

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 9: Monitoring and Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Application logs
cat /var/log/pm2/admin-api-out.log
```

### Restart Application

```bash
# Restart all apps
pm2 restart all

# Restart specific app
pm2 restart admin-api
```

### Update Application

```bash
cd /var/www/blog-platform

# Pull latest changes
git pull

# Install dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart all
```

### Database Backup

```bash
# Create backup
sudo -u postgres pg_dump blogplatform > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
sudo -u postgres psql blogplatform < backup_file.sql
```

---

## Step 10: Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>
```

#### 2. Database Connection Failed

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U bloguser -d blogplatform -h localhost
```

#### 3. Redis Connection Failed

```bash
# Check Redis status
sudo systemctl status redis-server

# Test connection
redis-cli ping
```

#### 4. Nginx 502 Bad Gateway

```bash
# Check if PM2 is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### 5. SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Quick Commands Reference

```bash
# Start all services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl start nginx
pm2 start all

# Stop all services
pm2 stop all
sudo systemctl stop nginx
sudo systemctl stop redis-server
sudo systemctl stop postgresql

# Restart application
pm2 restart all

# View logs
pm2 logs --lines 50

# Check resource usage
pm2 monit

# Update application
cd /var/www/blog-platform && git pull && npm install && npm run build && pm2 restart all
```

---

## Production Checklist

- [ ] Domain points to VPS IP
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Database backed up
- [ ] PM2 processes running
- [ ] Nginx reverse proxy working
- [ ] Logs being monitored
- [ ] Health checks configured
