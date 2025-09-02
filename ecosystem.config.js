module.exports = {
  apps: [
    {
      name: 'losbloccatore',
      script: './dist/index.js',
      
      // Instance configuration
      instances: 1,
      exec_mode: 'fork', // Use 'cluster' for multiple instances if needed
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Restart policy
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '1G',
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced settings
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health monitoring
      min_uptime: '10s',
      max_restarts: 10,
      
      // Process management
      pid_file: './pids/losbloccatore.pid',
      
      // Startup options
      node_args: '--max-old-space-size=1024',
      
      // Source map support for better error traces
      source_map_support: true,
      
      // Environment variables (loaded from .env file)
      env_file: './.env'
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'appuser',
      host: ['your-server-ip'], // Update with your server IP
      ref: 'origin/main',
      repo: 'git@github.com:loSpaccaBit/losbloccatore_bot.git',
      path: '/opt/losbloccatore-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && npm run build && npm run db:deploy && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};