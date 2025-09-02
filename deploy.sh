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
    
    # Switch to postgres user and create database/user
    sudo -u postgres psql <<EOF
DO \$\$
BEGIN
    -- Create database user if not exists
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'losbloccatore_user') THEN
        CREATE USER losbloccatore_user WITH PASSWORD 'your_secure_password_here';
    END IF;
    
    -- Create database if not exists
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'losbloccatore') THEN
        CREATE DATABASE losbloccatore OWNER losbloccatore_user;
    END IF;
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE losbloccatore TO losbloccatore_user;
END
\$\$;
EOF
    
    log_success "Database setup completed"
    log_warning "Remember to update DB_PASSWORD in .env file!"
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
    
    # Install dependencies
    log_info "Installing Node.js dependencies..."
    npm ci --production
    
    # Build application
    log_info "Building application..."
    npm run build
    
    # Set proper ownership
    chown -R appuser:appuser "$APP_DIR"
    
    log_success "Application deployed"
}

setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create .env file if it doesn't exist
    if [ ! -f "$APP_DIR/.env" ]; then
        cat > "$APP_DIR/.env" << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
CHANNEL_ID=your_channel_id_here

# Database Configuration
DATABASE_URL=postgresql://losbloccatore_user:your_secure_password_here@localhost:5432/losbloccatore
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=losbloccatore_user
DB_PASSWORD=your_secure_password_here
DB_NAME=losbloccatore

# Logging Configuration
LOG_LEVEL=info
DB_LOGGING=false

# Cache Configuration
CACHE_TTL=3600

# Admin Configuration (optional)
# ADMIN_USER_ID=your_telegram_user_id
EOF
        
        chown appuser:appuser "$APP_DIR/.env"
        chmod 600 "$APP_DIR/.env"
        
        log_warning "Created .env file at $APP_DIR/.env"
        log_warning "Please edit this file with your actual configuration!"
    else
        log_success "Environment file already exists"
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

setup_nginx() {
    log_info "Setting up Nginx reverse proxy..."
    
    # Install Nginx if not present
    if ! command -v nginx &> /dev/null; then
        apt install -y nginx
    fi
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/losbloccatore-bot << EOF
server {
    listen 80;
    server_name your-domain.com;  # Update this with your domain
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable the site
    ln -sf /etc/nginx/sites-available/losbloccatore-bot /etc/nginx/sites-enabled/
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and restart Nginx
    nginx -t && systemctl restart nginx
    systemctl enable nginx
    
    log_success "Nginx configured"
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
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured"
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
    systemctl is-active nginx && echo "✅ Nginx: Running" || echo "❌ Nginx: Stopped"
    systemctl is-active postgresql && echo "✅ PostgreSQL: Running" || echo "❌ PostgreSQL: Stopped"
    
    echo ""
    log_success "Deployment completed!"
    echo "=================================="
    echo "🔧 Next steps:"
    echo "1. Edit $APP_DIR/.env with your configuration"
    echo "2. Update Nginx server_name in /etc/nginx/sites-available/losbloccatore-bot"
    echo "3. Setup SSL certificate (recommended: certbot)"
    echo "4. Test your bot with /start command"
    echo ""
    echo "📋 Useful commands:"
    echo "  pm2 logs $PM2_APP_NAME          - View application logs"
    echo "  pm2 restart $PM2_APP_NAME       - Restart application"
    echo "  pm2 monit                       - Monitor PM2 processes"
    echo "  systemctl status nginx          - Check Nginx status"
    echo "  systemctl status postgresql     - Check database status"
}

# Main execution
main() {
    log_info "Starting LosBloccatore Bot deployment..."
    
    check_root
    install_dependencies
    setup_user
    setup_database
    deploy_application
    setup_environment
    setup_database_schema
    setup_pm2
    setup_nginx
    setup_firewall
    show_status
}

# Run main function
main "$@"