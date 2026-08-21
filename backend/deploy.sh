#!/bin/bash
# FAGE Backend — cPanel Deployment Bundle
# Creates a deployable package from the Laravel project

set -e
echo "🚀 Creating FAGE deployment bundle..."

# ─── Step 1: Production composer install ───
echo "📦 Installing production dependencies..."
composer install --optimize-autoloader --no-dev 2>/dev/null || echo "⚠️  composer install failed — run manually on server"

# ─── Step 2: Generate app key if missing ───
if grep -q "GENERATE_WITH_php_artisan_key_generate" .env 2>/dev/null; then
    echo "🔑 Generating application key..."
    php artisan key:generate --force 2>/dev/null || echo "⚠️  Run 'php artisan key:generate' on the server"
fi

# ─── Step 3: Optimize ───
echo "⚡ Running optimizations..."
php artisan config:cache 2>/dev/null || true
php artisan route:cache 2>/dev/null || true
php artisan view:cache 2>/dev/null || true
php artisan event:cache 2>/dev/null || true

# ─── Step 4: Create deployment tarball ───
echo "📁 Creating deployment package..."
DEPLOY_NAME="fage-backend-$(date +%Y%m%d-%H%M%S)"

# Files to exclude
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='storage/logs/*.log' \
    --exclude='database/database.sqlite' \
    --exclude='bootstrap/cache/*.php' \
    --exclude='vendor' \
    --exclude='.env' \
    --exclude='.env.production' \
    -czf "${DEPLOY_NAME}.tar.gz" .

echo ""
echo "✅ Deployment bundle created: ${DEPLOY_NAME}.tar.gz"
echo ""
echo "📋 cPanel Deployment Steps:"
echo "   1. Upload ${DEPLOY_NAME}.tar.gz to your cPanel File Manager"
echo "   2. Extract to the desired directory (e.g., public_html/api/)"
echo "   3. Copy .env.production to .env and fill in your values"
echo "   4. Run: composer install --optimize-autoloader --no-dev"
echo "   5. Run: php artisan key:generate"
echo "   6. Run: php artisan migrate --force"
echo "   7. Set document root to the /public directory"
echo "   8. Set up cron: * * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo "🌐 Frontend (cPanel public_html):"
echo "   1. Build: cd frontend && npm run build"
echo "   2. Upload dist/ contents to public_html/"
echo "   3. Copy .htaccess to public_html/"
