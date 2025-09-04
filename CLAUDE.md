# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LosBloccatore is an enterprise-grade Telegram bot (v2.0.0) that automatically manages join requests for private Telegram channels. The bot features a modern, scalable architecture built with TypeScript, comprehensive logging, database persistence, caching, and robust error handling.

## Architecture

### Modern Enterprise Structure
- **TypeScript-first**: Full TypeScript implementation with strict typing
- **Layered Architecture**: Controllers, Services, Models, and Middleware separation
- **Dependency Injection**: Clean separation of concerns with service injection
- **Database Persistence**: Prisma ORM with PostgreSQL-only support
- **Advanced Caching**: NodeCache implementation with TTL and rate limiting
- **Professional Logging**: Winston with daily log rotation and structured logging
- **Comprehensive Testing**: Jest with unit and integration test suites
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode

### Directory Structure
```
src/
├── config/           # Configuration management and validation
├── controllers/      # Request handlers and business logic coordination
├── services/         # Business logic and external API interactions
├── models/          # Data models with Prisma integration
├── middleware/      # Request processing middleware (logging, errors, rate limiting)
├── database/        # Prisma client connection and utilities
├── utils/           # Utilities (logger, cache, helpers)
└── types/           # TypeScript type definitions

prisma/
├── schema.prisma    # Prisma schema definition
└── migrations/      # Database migrations

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── setup.ts         # Test configuration
```

## Commands

### Development & Production
```bash
# Build the application
npm run build

# Start production
npm start

# Development with auto-restart
npm run dev

# Watch mode for development
npm run build:watch

# Code quality
npm run lint          # Check code style
npm run lint:fix      # Fix code style issues
npm run format        # Format code with Prettier
npm run typecheck     # TypeScript type checking

# Testing
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:coverage # Generate coverage report
npm run test:watch    # Watch mode for testing

# Utilities
npm run clean         # Clean dist directory

# Database (Prisma)
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database (development)
npm run db:migrate    # Create and apply migrations (development)
npm run db:deploy     # Deploy migrations (production)
npm run db:studio     # Open Prisma Studio GUI
```

## Configuration

### Environment Variables
Required in `.env`:
- `BOT_TOKEN` - Telegram bot token from BotFather
- `CHANNEL_ID` - Target channel ID (negative number for channels)
- `DATABASE_URL` - PostgreSQL connection string
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USERNAME` - PostgreSQL username
- `DB_PASSWORD` - PostgreSQL password
- `DB_NAME` - PostgreSQL database name

Optional configuration:
- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Application port (default: 3000)
- `DB_LOGGING` - Enable database query logging (default: false)
- `LOG_LEVEL` - Logging level (error/warn/info/debug)
- `CACHE_TTL` - Cache TTL in seconds
- `ADMIN_USER_IDS` - Comma-separated list of admin user IDs for management commands (e.g., "123456789,987654321")
- `ADMIN_USER_ID` - Single admin user ID (legacy format - use ADMIN_USER_IDS instead)

### Configuration Validation
The application uses Joi for robust configuration validation with detailed error messages.

## Core Services

### TelegramService
- Message sending with rate limiting and caching
- Join request approval/rejection
- Chat member management
- Error handling for Telegram API limitations

### UserActivityService  
- Database persistence of all user activities
- Activity history and statistics
- User behavior tracking and analytics
- Data cleanup and maintenance

### CacheManager
- User action caching with TTL
- Rate limiting implementation
- Message delivery state tracking
- Performance optimization

### Logger
- Structured JSON logging with Winston
- Daily log rotation with size limits
- Different log levels and outputs
- Bot-specific logging methods

## Database Schema (Prisma)

### UserActivity Model
- Tracks all user interactions (join, leave, approve, reject)
- Comprehensive metadata storage with JSON fields
- Optimized indexing for performance
- BigInt support for Telegram user/chat IDs
- Statistics and analytics support

### ContestParticipant Model
- Contest participation tracking
- Referral system with points
- TikTok task completion
- Unique constraints and indexing

### ContestReferral Model
- Referral relationship tracking
- Points awarding and revocation
- Status management (active, left, points_awarded, points_revoked)

## Middleware System

### Error Handling
- Custom error types with context
- Telegram API error classification
- Graceful degradation and recovery
- Operational vs critical error distinction

### Logging Middleware
- Request/response logging
- Performance monitoring
- Security event logging
- Detailed debugging information

### Rate Limiting
- Per-user and per-chat rate limiting
- Configurable thresholds
- Cache-based implementation
- Protection against spam and abuse

## Bot Commands

### User Commands
- `/start` - Bot introduction and status
  
### Admin Commands (require ADMIN_USER_IDS or ADMIN_USER_ID)
- `/health` - System health check and statistics
- `/stats` - Channel statistics and analytics
- `/contest` - Contest performance and engagement metrics
- `/cleanup` - Remove old activity records
- `/message <user_id> <message>` - Send private message to specific user

## Advanced Features

### Rate Limiting
- 30 requests per minute default
- Separate limits for different message types
- Cache-based tracking with automatic expiry

### Message Templates
- Customizable welcome messages with rules and links
- Personalized goodbye messages with return invitations
- Markdown formatting support

### Error Recovery
- Automatic retry for transient failures
- Graceful handling of user privacy settings
- Comprehensive error classification and logging

### Performance Monitoring
- Request duration tracking
- Slow query detection (>2 second threshold)
- Cache hit/miss ratio monitoring
- Database connection health checks

### Security Features
- Input validation and sanitization
- Admin command authorization
- Security event logging
- Bot user filtering

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier formatting
- Comprehensive type definitions

### Testing Strategy
- Unit tests for utilities and services
- Integration tests for controllers and database
- Mock implementations for external APIs
- Coverage thresholds enforced (80%)

### Error Handling
- Custom error classes with context
- Structured error logging
- User-friendly error messages
- Graceful degradation patterns

## Production Considerations

### Database
- PostgreSQL only for all environments
- Prisma migrations for schema management
- Connection pooling and health monitoring via Prisma
- Type-safe database operations
- Optimized queries with proper indexing
- Regular cleanup of old activity records

### Logging
- Daily log rotation with size limits
- Structured JSON format for parsing
- Different log levels for different environments
- Log aggregation and monitoring ready

### Monitoring
- Health check endpoints
- Performance metrics collection
- Error rate monitoring
- Cache performance tracking

### Deployment
- Process manager support (PM2, systemd)
- Graceful shutdown handling
- Environment-specific configurations
- Zero-downtime deployment patterns

## Path Aliases

The project uses TypeScript path mapping for clean imports:
```typescript
@/*           -> src/*
@config/*     -> src/config/*
@services/*   -> src/services/*
@controllers/* -> src/controllers/*
@middleware/* -> src/middleware/*
@models/*     -> src/models/*
@utils/*      -> src/utils/*
@types/*      -> src/types/*
@database/*   -> src/database/*
```