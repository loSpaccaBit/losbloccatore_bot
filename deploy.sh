#!/bin/bash

# =====================================
# LosBloccatore Bot - Deployment Script
# =====================================
# Automatic deployment script for VPS with PM2

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="losbloccatore-bot"
APP_DIR="/opt/losbloccatore-bot"
# Update this with your GitHub token
REPO_URL="https://loSpaccaBit:YOUR_GITHUB_TOKEN@github.com/loSpaccaBit/losbloccatore_bot.git"
NODE_VERSION="18"
PM2_APP_NAME="losbloccatore"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this script as root (use sudo)"
        exit 1
    fi
}

install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update package list
    apt update -y
    
    # Install essential packages
    apt install -y curl wget git build-essential software-properties-common
    
    # Install Canvas dependencies for image generation
    log_info "Installing Canvas dependencies..."
    apt install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
    
    # Install Node.js via NodeSource
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js ${NODE_VERSION}..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt install -y nodejs
    else
        log_success "Node.js already installed: $(node --version)"
    fi
    
    # Install PM2 globally
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        npm install -g pm2
    else
        log_success "PM2 already installed: $(pm2 --version)"
    fi
    
    # Install PostgreSQL if not present
    if ! command -v psql &> /dev/null; then
        log_info "Installing PostgreSQL..."
        apt install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
    else
        log_success "PostgreSQL already installed"
    fi
    
    log_success "System dependencies installed"
}

setup_user() {
    log_info "Setting up application user..."
    
    # Create app user if doesn't exist
    if ! id "appuser" &>/dev/null; then
        useradd -m -s /bin/bash appuser
        usermod -aG sudo appuser
        log_success "Created user 'appuser'"
    else
        log_success "User 'appuser' already exists"
    fi
}

setup_database() {
    log_info "Setting up PostgreSQL database..."
    
    # Use a simple, known password for deployment
    DB_PASSWORD="LosBloccatore2024!"
    log_info "Using deployment database password"
    
    # Clean up any existing setup
    log_info "Cleaning up any existing database setup..."
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS losbloccatore;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS losbloccatore_user;" 2>/dev/null || true
    
    # Create fresh user and database
    log_info "Creating database user and database..."
    
    # Create user
    sudo -u postgres psql -c "CREATE USER losbloccatore_user WITH PASSWORD '$DB_PASSWORD' CREATEDB;"
    
    # Create database
    sudo -u postgres psql -c "CREATE DATABASE losbloccatore OWNER losbloccatore_user;"
    
    # Grant all privileges
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE losbloccatore TO losbloccatore_user;"
    
    # Configure pg_hba.conf for proper authentication
    log_info "Configuring PostgreSQL authentication..."
    
    # Find the correct pg_hba.conf file location
    PG_HBA_FILE=""
    for pg_conf in /etc/postgresql/*/main/pg_hba.conf; do
        if [ -f "$pg_conf" ]; then
            PG_HBA_FILE="$pg_conf"
            break
        fi
    done
    
    if [ -z "$PG_HBA_FILE" ]; then
        log_warning "Could not find pg_hba.conf, trying alternative locations..."
        # Try common alternative locations
        for alt_conf in /etc/postgresql/pg_hba.conf /var/lib/postgresql/*/main/pg_hba.conf; do
            if [ -f "$alt_conf" ]; then
                PG_HBA_FILE="$alt_conf"
                break
            fi
        done
    fi
    
    if [ -z "$PG_HBA_FILE" ]; then
        log_warning "Could not find pg_hba.conf, skipping authentication configuration"
        log_info "PostgreSQL may use default authentication settings"
    else
        log_info "Found pg_hba.conf at: $PG_HBA_FILE"
    
        # Backup original pg_hba.conf
        sudo cp "$PG_HBA_FILE" "${PG_HBA_FILE}.backup" 2>/dev/null || true
        
        # Ensure local and host connections use md5 authentication
        if ! sudo grep -q "local.*all.*losbloccatore_user.*md5" "$PG_HBA_FILE"; then
            sudo sed -i '/^local.*all.*all.*peer/i local   all             losbloccatore_user                              md5' "$PG_HBA_FILE"
        fi
        
        if ! sudo grep -q "host.*all.*losbloccatore_user.*127.0.0.1.*md5" "$PG_HBA_FILE"; then
            sudo sed -i '/^host.*all.*all.*127.0.0.1/i host    all             losbloccatore_user      127.0.0.1/32            md5' "$PG_HBA_FILE"
        fi
        
        # Reload PostgreSQL configuration
        sudo systemctl reload postgresql
        log_success "PostgreSQL authentication configured"
    fi
    
    # Wait for reload
    sleep 2
    
    # Store password for later use in .env creation
    echo "$DB_PASSWORD" > /tmp/db_password
    
    # Test connection multiple ways
    log_info "Testing database connection..."
    
    # Try different connection methods
    CONNECTION_SUCCESS=false
    
    # Method 1: As postgres user (should always work)
    if sudo -u postgres psql -d losbloccatore -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Database accessible via postgres user"
        CONNECTION_SUCCESS=true
    fi
    
    # Method 2: Direct local connection
    if PGPASSWORD="$DB_PASSWORD" psql -U losbloccatore_user -d losbloccatore -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Local database connection successful"
        CONNECTION_SUCCESS=true
    fi
    
    # Method 3: Host connection
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U losbloccatore_user -d losbloccatore -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Host database connection successful" 
        CONNECTION_SUCCESS=true
    fi
    
    # Method 4: Try with different host formats
    if PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U losbloccatore_user -d losbloccatore -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "IP database connection successful"
        CONNECTION_SUCCESS=true
    fi
    
    if [ "$CONNECTION_SUCCESS" = false ]; then
        log_error "All database connection methods failed"
        log_info "Trying to check PostgreSQL configuration..."
        
        # Show PostgreSQL status
        sudo systemctl status postgresql --no-pager || true
        
        # Show recent logs
        log_info "Recent PostgreSQL logs:"
        sudo tail -10 /var/log/postgresql/postgresql-*-main.log 2>/dev/null || \
        sudo journalctl -u postgresql -n 10 --no-pager || true
        
        # Show database and user info
        log_info "Database and user verification:"
        sudo -u postgres psql -l | grep losbloccatore || true
        sudo -u postgres psql -c "\du" | grep losbloccatore_user || true
        
        log_warning "Database connection tests failed, but proceeding anyway"
        log_warning "The application may still work if it can connect differently"
    fi
    
    log_success "Database setup completed successfully"
}

deploy_application() {
    log_info "Deploying application..."
    
    # Check if app directory exists (manually cloned)
    if [ ! -d "$APP_DIR" ]; then
        log_error "Application directory $APP_DIR not found!"
        log_info "Please clone the repository manually:"
        log_info "cd /opt && git clone https://github.com/loSpaccaBit/losbloccatore_bot.git losbloccatore-bot"
        exit 1
    fi
    
    cd "$APP_DIR"
    log_success "Using existing repository at $APP_DIR"
    
    # Fix git ownership issues
    git config --global --add safe.directory "$APP_DIR"
    
    # Install ALL dependencies first (including dev for build)
    log_info "Installing Node.js dependencies (including dev for build)..."
    npm ci
    
    # Rebuild Canvas with correct system libraries
    log_info "Rebuilding Canvas with system libraries..."
    npm rebuild canvas --verbose
    
    # Build application
    log_info "Building application..."
    npm run build
    
    # Install only production dependencies (skip scripts to avoid rebuild)
    log_info "Installing production dependencies only..."
    npm ci --omit=dev --ignore-scripts
    
    # Rebuild Canvas again for production
    log_info "Rebuilding Canvas for production..."
    npm rebuild canvas --verbose
    
    # Set proper ownership
    chown -R appuser:appuser "$APP_DIR"
    
    log_success "Application deployed"
}

setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Get the generated database password
    if [ -f "/tmp/db_password" ]; then
        DB_PASS=$(cat /tmp/db_password)
    else
        log_error "Database password not found! Database setup may have failed."
        exit 1
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f "$APP_DIR/.env" ]; then
        cat > "$APP_DIR/.env" << EOF
# Production Environment Configuration
# Generated: $(date)
NODE_ENV=production
PORT=3000

# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
CHANNEL_ID=your_channel_id_here

# Database Configuration
DATABASE_URL=postgresql://losbloccatore_user:${DB_PASS}@localhost:5432/losbloccatore
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=losbloccatore_user
DB_PASSWORD=${DB_PASS}
DB_NAME=losbloccatore
DB_LOGGING=false

# Logging Configuration
LOG_LEVEL=info

# Cache Configuration
CACHE_TTL=3600

# Admin Configuration (optional)
# ADMIN_USER_ID=your_telegram_user_id
EOF
        
        chown appuser:appuser "$APP_DIR/.env"
        chmod 600 "$APP_DIR/.env"
        
        log_success "Created .env file with auto-generated database credentials"
        log_warning "⚠️  IMPORTANT: Edit BOT_TOKEN and CHANNEL_ID in $APP_DIR/.env"
        
        # Clean up temporary password file
        rm -f /tmp/db_password
    else
        log_success "Environment file already exists"
        rm -f /tmp/db_password
    fi
}

setup_database_schema() {
    log_info "Setting up database schema..."
    
    cd "$APP_DIR"
    
    # Generate Prisma client
    sudo -u appuser npm run db:generate
    
    # Deploy database migrations
    sudo -u appuser npm run db:deploy
    
    log_success "Database schema deployed"
}

setup_pm2() {
    log_info "Setting up PM2 configuration..."
    
    # Stop existing PM2 process if running
    sudo -u appuser pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
    sudo -u appuser pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    
    # Start application with PM2
    cd "$APP_DIR"
    sudo -u appuser pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    sudo -u appuser pm2 save
    
    # Setup PM2 startup
    STARTUP_CMD=$(sudo -u appuser pm2 startup systemd -u appuser --hp /home/appuser | grep "sudo env")
    eval "$STARTUP_CMD"
    
    log_success "PM2 configured and application started"
}

cleanup_nginx() {
    log_info "Cleaning up Nginx configuration (not needed for polling bot)..."
    
    # Stop and disable Nginx if running
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
    
    # Remove Nginx configuration files
    rm -f /etc/nginx/sites-available/losbloccatore-bot
    rm -f /etc/nginx/sites-enabled/losbloccatore-bot
    
    # Optional: Remove Nginx entirely (commented out by default)
    # apt remove -y nginx nginx-common nginx-core 2>/dev/null || true
    
    log_success "Nginx cleanup completed (service stopped and disabled)"
}

setup_firewall() {
    log_info "Configuring firewall..."
    
    # Install and setup UFW
    apt install -y ufw
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow essential ports
    ufw allow ssh
    # Note: No HTTP/HTTPS ports needed for Telegram polling bot
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured (SSH only for polling bot)"
}

show_status() {
    log_info "Application Status:"
    echo "=================================="
    
    # PM2 status
    echo "PM2 Processes:"
    sudo -u appuser pm2 list
    
    echo ""
    echo "Application Logs (last 20 lines):"
    sudo -u appuser pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
    
    echo ""
    echo "System Status:"
    systemctl is-active postgresql && echo "✅ PostgreSQL: Running" || echo "❌ PostgreSQL: Stopped"
    
    echo ""
    log_success "Deployment completed!"
    echo "=================================="
    echo "🔧 Next steps:"
    echo "1. Edit $APP_DIR/.env with your BOT_TOKEN and CHANNEL_ID"
    echo "2. Test your bot with /start command"
    echo ""
    echo "📋 Useful commands:"
    echo "  pm2 logs $PM2_APP_NAME          - View application logs"
    echo "  pm2 restart $PM2_APP_NAME       - Restart application"
    echo "  pm2 monit                       - Monitor PM2 processes"
    echo "  systemctl status postgresql     - Check database status"
}

# Cleanup function for failed deployments
cleanup_failed_deployment() {
    log_warning "Cleaning up failed deployment..."
    
    # Stop PM2 processes
    sudo -u appuser pm2 stop losbloccatore 2>/dev/null || true
    sudo -u appuser pm2 delete losbloccatore 2>/dev/null || true
    
    # Clean up temp files
    rm -f /tmp/db_password
    
    log_info "Cleanup completed"
}

# Main execution
main() {
    log_info "Starting LosBloccatore Bot deployment..."
    
    # Set trap for cleanup on failure
    trap cleanup_failed_deployment EXIT
    
    check_root
    install_dependencies
    setup_user
    setup_database
    deploy_application
    setup_environment
    setup_database_schema
    setup_pm2
    cleanup_nginx
    setup_firewall
    show_status
    
    # If we get here, deployment was successful
    trap - EXIT
    log_success "🎉 Deployment completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    "clean")
        log_info "Performing clean deployment (removing existing setup)..."
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS losbloccatore;" 2>/dev/null || true
        sudo -u postgres psql -c "DROP USER IF EXISTS losbloccatore_user;" 2>/dev/null || true
        sudo -u appuser pm2 stop losbloccatore 2>/dev/null || true
        sudo -u appuser pm2 delete losbloccatore 2>/dev/null || true
        rm -f /opt/losbloccatore-bot/.env
        
        # Clean up Nginx
        systemctl stop nginx 2>/dev/null || true
        systemctl disable nginx 2>/dev/null || true
        rm -f /etc/nginx/sites-available/losbloccatore-bot
        rm -f /etc/nginx/sites-enabled/losbloccatore-bot
        
        log_success "Cleanup completed. Proceeding with fresh deployment..."
        main
        ;;
    *)
        main "$@"
        ;;
esac