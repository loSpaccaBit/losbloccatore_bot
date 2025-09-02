#!/bin/bash

# =====================================
# Production Environment Setup Script
# =====================================
# Quick setup script for production environment variables

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info "Setting up production environment..."

# Create logs and pids directories
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/pids"

log_info "Created logs and pids directories"

# Function to prompt for input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    echo -n "$prompt [$default]: "
    read -r input
    if [[ -z "$input" ]]; then
        eval "$var_name=\"$default\""
    else
        eval "$var_name=\"$input\""
    fi
}

# Function to prompt for password (hidden input)
prompt_password() {
    local prompt="$1"
    local var_name="$2"
    
    echo -n "$prompt: "
    read -rs input
    echo
    eval "$var_name=\"$input\""
}

log_info "Please provide the following configuration values:"
echo "=============================================="

# Telegram configuration
prompt_with_default "Bot Token (from @BotFather)" "your_bot_token_here" BOT_TOKEN
prompt_with_default "Channel ID (negative number for channels)" "your_channel_id_here" CHANNEL_ID

# Database configuration
prompt_with_default "Database Host" "localhost" DB_HOST
prompt_with_default "Database Port" "5432" DB_PORT
prompt_with_default "Database Name" "losbloccatore" DB_NAME
prompt_with_default "Database Username" "losbloccatore_user" DB_USERNAME
prompt_password "Database Password" DB_PASSWORD

# Application configuration
prompt_with_default "Application Port" "3000" PORT
prompt_with_default "Log Level (error/warn/info/debug)" "info" LOG_LEVEL
prompt_with_default "Admin User ID (optional)" "" ADMIN_USER_ID

# Cache configuration
prompt_with_default "Cache TTL (seconds)" "3600" CACHE_TTL

# Build DATABASE_URL
DATABASE_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

# Create .env file
log_info "Creating production .env file..."

cat > "$PROJECT_DIR/.env" << EOF
# =====================================
# LosBloccatore Bot - Production Config
# Generated: $(date)
# =====================================

# Environment
NODE_ENV=production
PORT=$PORT

# Telegram Bot Configuration
BOT_TOKEN=$BOT_TOKEN
CHANNEL_ID=$CHANNEL_ID

# Database Configuration
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_LOGGING=false

# Logging Configuration
LOG_LEVEL=$LOG_LEVEL

# Cache Configuration
CACHE_TTL=$CACHE_TTL

EOF

# Add admin user ID if provided
if [[ -n "$ADMIN_USER_ID" ]]; then
    echo "# Admin Configuration" >> "$PROJECT_DIR/.env"
    echo "ADMIN_USER_ID=$ADMIN_USER_ID" >> "$PROJECT_DIR/.env"
    echo "" >> "$PROJECT_DIR/.env"
fi

# Set proper permissions
chmod 600 "$PROJECT_DIR/.env"

log_success "Production environment configured!"
log_info "Configuration saved to: $PROJECT_DIR/.env"
log_warning "Keep this file secure and never commit it to version control!"

echo ""
log_info "Next steps:"
echo "1. Review the generated .env file"
echo "2. Run the main deployment script: sudo ./deploy.sh"
echo "3. Test your bot configuration"

echo ""
log_info "Environment file contents:"
echo "=========================="
cat "$PROJECT_DIR/.env"