# FAGE Ghana Backend — Installation Guide

## Requirements
- PHP 8.2+ with extensions: pdo_mysql, pdo_sqlite, mbstring, json, curl, openssl, fileinfo
- MySQL 8.0+ (production) or SQLite (development)
- Composer 2.x

## Quick Start (Development)

```bash
# 1. Clone and install
cd backend/
composer install

# 2. Copy environment file
cp .env.example .env

# 3. Generate application key
php artisan key:generate

# 4. Start the server
php artisan serve --port=8000

# 5. Visit the installation wizard
open http://localhost:8000/api/setup/requirements
```

## Installation Wizard (API)

### Step 1: Check Requirements
```bash
curl http://localhost:8000/api/setup/requirements
```

### Step 2: Test Database Connection
```bash
# SQLite
curl -X POST http://localhost:8000/api/setup/test-database \
  -H "Content-Type: application/json" \
  -d '{"db_type":"sqlite","db_database":"database/database.sqlite"}'

# MySQL
curl -X POST http://localhost:8000/api/setup/test-database \
  -H "Content-Type: application/json" \
  -d '{"db_type":"mysql","db_host":"localhost","db_port":"3306","db_database":"fage_ghana","db_username":"root","db_password":"secret"}'
```

### Step 3: Install
```bash
curl -X POST http://localhost:8000/api/setup/install \
  -H "Content-Type: application/json" \
  -d '{
    "db_type": "sqlite",
    "db_database": "database/database.sqlite",
    "admin_name": "Admin User",
    "admin_email": "admin@fageghana.org",
    "admin_password": "password123",
    "admin_password_confirmation": "password123",
    "site_name": "FAGE Ghana",
    "site_url": "http://localhost:3000",
    "currency": "GHS",
    "timezone": "Africa/Accra",
    "mail_driver": "log"
  }'
```

## Production Deployment (cPanel)

### 1. Upload Backend
```bash
# On local machine
composer install --optimize-autoloader --no-dev

# Upload entire backend/ folder to cPanel via File Manager or FTP
# Place in: public_html/api/ (or any subdirectory)
```

### 2. cPanel Configuration
- Set PHP version to 8.2+ in MultiPHP Manager
- Set document root to `public/` subdirectory
- Ensure `storage/` and `bootstrap/cache/` are writable (775)
- Create MySQL database in cPanel > MySQL Databases
- Run installation wizard via API

### 3. Cron Job
```bash
# Add to cPanel Cron Jobs (every minute)
* * * * * cd /home/user/public_html/api && php artisan schedule:run >> /dev/null 2>&1
```

### 4. Upload Frontend
```bash
# Build frontend
cd frontend/
npm run build

# Upload dist/ folder contents to public_html/
# Ensure .htaccess is included
```

## Frontend Configuration
Set `VITE_API_URL` in frontend `.env`:
```
VITE_API_URL=https://yourdomain.com/api
```

## API Authentication
All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <sanctum_token>
```

Login to get a token:
```bash
curl -X POST http://localhost:8000/api/public/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fageghana.org","password":"password123"}'
```

## Default Roles
- `admin` — Full admin access
- `superadmin` — Same as admin (reserved for owner)
- `developer` — Technical maintenance access
- `staff` — Day-to-day operations
- `finance` — Payment management
- `ceo` — Read-heavy oversight
- `coordinator` — Member readiness, certificates
- `moderator` — Content moderation
- `editor` — Content management
- `user` — Standard member access
