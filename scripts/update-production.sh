#!/bin/bash

# =====================================
# Production Update Script
# =====================================
# Quick update script for production deployments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/opt/losbloccatore-bot"
PM2_APP_NAME="losbloccatore"

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

check_user() {
    if [ "$EUID" -eq 0 ]; then
        log_error "Don't run this script as root. Use the app user instead."
        exit 1
    fi
}

backup_current() {
    log_info "Creating backup of current deployment..."
    
    cd "$APP_DIR"
    
    # Create backup directory with timestamp
    BACKUP_DIR="$HOME/backups/losbloccatore-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup critical files
    cp -r dist "$BACKUP_DIR/" 2>/dev/null || true
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    cp package.json "$BACKUP_DIR/"
    cp ecosystem.config.js "$BACKUP_DIR/"
    
    log_success "Backup created at: $BACKUP_DIR"
    echo "$BACKUP_DIR" > /tmp/last_backup_path
}

update_code() {
    log_info "Updating code from repository..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash push -m "Auto-stash before update $(date)"
    
    # Fetch and pull latest changes
    git fetch --all
    git reset --hard origin/main
    git clean -fd
    
    log_success "Code updated to latest version"
}

update_dependencies() {
    log_info "Updating dependencies..."
    
    cd "$APP_DIR"
    
    # Update package-lock.json and install production dependencies
    npm ci --production --silent
    
    log_success "Dependencies updated"
}

build_application() {
    log_info "Building application..."
    
    cd "$APP_DIR"
    
    # Clean and build
    npm run clean
    npm run build
    
    log_success "Application built successfully"
}

update_database() {
    log_info "Updating database schema..."
    
    cd "$APP_DIR"
    
    # Generate Prisma client
    npm run db:generate
    
    # Deploy database changes (migrations)
    npm run db:deploy
    
    log_success "Database schema updated"
}

restart_application() {
    log_info "Restarting application with PM2..."
    
    # Reload the application (zero-downtime restart)
    pm2 reload "$PM2_APP_NAME"
    
    # Wait a moment for the process to stabilize
    sleep 3
    
    # Check if the application is running
    if pm2 show "$PM2_APP_NAME" | grep -q "online"; then
        log_success "Application restarted successfully"
    else
        log_error "Application failed to restart"
        return 1
    fi
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for application to fully start
    sleep 5
    
    # Check PM2 status
    local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status")
    
    if [ "$status" = "online" ]; then
        log_success "✅ Application is running"
    else
        log_error "❌ Application is not running properly"
        log_info "PM2 Status:"
        pm2 show "$PM2_APP_NAME"
        return 1
    fi
    
    # Show recent logs to verify functionality
    log_info "Recent application logs:"
    pm2 logs "$PM2_APP_NAME" --lines 10 --nostream
    
    log_success "Deployment verification completed"
}

rollback_deployment() {
    log_error "Rolling back to previous version..."
    
    if [ -f /tmp/last_backup_path ]; then
        BACKUP_PATH=$(cat /tmp/last_backup_path)
        
        if [ -d "$BACKUP_PATH" ]; then
            log_info "Restoring from backup: $BACKUP_PATH"
            
            cd "$APP_DIR"
            
            # Stop the application
            pm2 stop "$PM2_APP_NAME"
            
            # Restore files
            cp -r "$BACKUP_PATH/dist" . 2>/dev/null || true
            cp "$BACKUP_PATH/.env" . 2>/dev/null || true
            cp "$BACKUP_PATH/ecosystem.config.js" .
            
            # Restart application
            pm2 start ecosystem.config.js
            
            log_warning "Rollback completed. Please check your application."
        else
            log_error "Backup directory not found: $BACKUP_PATH"
        fi
    else
        log_error "No backup information found. Manual intervention required."
    fi
}

show_status() {
    log_info "Current Application Status:"
    echo "============================"
    
    # PM2 status
    pm2 show "$PM2_APP_NAME"
    
    echo ""
    log_info "System Resources:"
    echo "Memory Usage: $(free -h | grep Mem | awk '{print $3"/"$2}')"
    echo "Disk Usage: $(df -h /opt | tail -1 | awk '{print $3"/"$2" ("$5")"}')"
    
    echo ""
    log_info "Recent Logs (last 5 lines):"
    pm2 logs "$PM2_APP_NAME" --lines 5 --nostream
}

# Main update function
main() {
    log_info "Starting production update process..."
    
    check_user
    
    # Perform update steps
    if backup_current && 
       update_code && 
       update_dependencies && 
       build_application && 
       update_database && 
       restart_application && 
       verify_deployment; then
        
        log_success "🎉 Update completed successfully!"
        show_status
        
        # Cleanup old backups (keep last 5)
        find "$HOME/backups" -name "losbloccatore-*" -type d | sort | head -n -5 | xargs rm -rf 2>/dev/null || true
        
    else
        log_error "❌ Update failed!"
        
        read -p "Do you want to rollback to the previous version? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback_deployment
        else
            log_warning "Manual intervention required. Check the logs and fix issues."
            pm2 logs "$PM2_APP_NAME" --lines 20
        fi
        
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "rollback")
        rollback_deployment
        ;;
    "status")
        show_status
        ;;
    "logs")
        pm2 logs "$PM2_APP_NAME" --lines "${2:-20}"
        ;;
    *)
        main
        ;;
esac