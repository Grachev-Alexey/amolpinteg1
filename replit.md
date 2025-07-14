# CRM Integration System

## Overview

This is a comprehensive CRM integration system designed to connect AmoCRM and LPTracker, providing automated synchronization, webhook processing, and data management capabilities. The application features a multi-user architecture with authentication, rule-based integration logic, and comprehensive logging.


## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend and backend components:

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with custom styling
- **Styling**: Tailwind CSS with dark theme implementation
- **State Management**: React Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Localization**: Full Russian language interface

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Simple session-based authentication with local user storage
- **API**: RESTful endpoints with TypeScript support
- **File Processing**: Multer for file uploads and XLSX processing
- **External APIs**: Integration with AmoCRM and LPTracker services

## Key Components

### Database Schema
- **Connection Settings**: Encrypted storage for AmoCRM and LPTracker credentials
- **Metadata Caching**: AmoCRM pipeline, status, and field definitions
- **Sync Rules**: Configurable integration rules with conditions and actions
- **File Processing**: Upload tracking and processing status
- **Call Results**: Phone call outcome storage
- **System Logs**: Comprehensive audit trail

### Service Layer
- **SmartFieldMapper**: User-controlled field mapping system that lets users specify exactly which fields map to which CRM entities (contact/lead) and fields
- **AmoCrmService**: Handles API connections, metadata retrieval, and data synchronization with user-defined mapping
- **LpTrackerService**: Manages LPTracker API interactions and lead processing with user-defined mapping
- **WebhookService**: Processes incoming webhooks from external systems with user-controlled field mapping
- **FileService**: Manages XLSX file uploads and background processing
- **LogService**: Centralized logging for all system operations

### Frontend Components
- **Layout System**: Responsive sidebar navigation with dark theme
- **Rule Constructor**: Visual interface for creating complex integration rules
- **Data Tables**: Reusable table components with sorting, filtering, and pagination
- **Status Cards**: Real-time connection status indicators
- **Settings Pages**: Configuration interfaces for external service connections

## Data Flow

1. **User Authentication**: Simple session-based authentication with local user database
2. **Service Configuration**: Users configure AmoCRM and LPTracker connections
3. **Metadata Sync**: System caches external service metadata for rule construction
4. **Rule Creation**: Users build conditional logic using visual interface
5. **Webhook Processing**: Incoming webhooks trigger rule evaluation
6. **User-Controlled Field Mapping**: Users specify exactly which source fields map to which target CRM entities and fields
7. **Data Transformation**: Rules execute actions using user-defined field mappings
8. **File Processing**: XLSX uploads are processed in background with status tracking
9. **Logging**: All operations are logged for audit and debugging

## External Dependencies

### Core Technologies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI components
- **tailwindcss**: Utility-first CSS framework
- **multer**: File upload handling
- **xlsx**: Excel file processing

### Authentication & Security
- **express-session**: Session management with MemoryStore
- **crypto**: Built-in encryption for sensitive data and password hashing
- **Simple Session Auth**: Custom session-based authentication without external dependencies

### Development Tools
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and better developer experience
- **wouter**: Lightweight routing library

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with hot module replacement
- **Database**: PostgreSQL with Drizzle migrations
- **Environment Variables**: Database URL, encryption keys, and API credentials
- **Session Storage**: PostgreSQL-backed session management

### Production Build
- **Frontend**: Vite builds optimized React application
- **Backend**: Node.js server with TypeScript via tsx
- **Database**: PostgreSQL with connection pooling
- **Static Assets**: Served from Express server
- **Session Storage**: In-memory session store for development

### Key Features
- **Multi-user Support**: Each user has isolated settings and rules
- **Per-user Webhook Management**: Individual LPTracker webhook configuration for each user with project_id
- **Real-time Updates**: Webhook processing and live status updates
- **Background Processing**: File uploads and data synchronization
- **Comprehensive Logging**: All operations tracked for debugging
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Exclusively dark theme implementation as per requirements
- **Russian Localization**: Complete Russian language interface
- **Unified Sync Logic**: Automatic find-or-create logic for contacts and leads
- **API Integration**: Full AmoCRM v4 and LPTracker API implementation with correct webhook endpoints
- **Custom Field Mapping**: Complete end-to-end mapping of custom fields from LPTracker to AmoCRM for both new and existing deals (Fixed: July 14, 2025)
- **High-Performance Webhook Processing**: Asynchronous queue-based processing with 5-15 concurrent workers (Added: July 14, 2025)
- **Modern Webhook Deduplication**: In-memory cache-based deduplication with 10-minute TTL and automatic cleanup (Upgraded: July 14, 2025)
- **Smart Webhook Filtering**: Intelligent filtering based on action_update_fields to process only relevant changes (Added: July 14, 2025)
- **Performance Optimization**: Intelligent caching for rules and metadata with TTL, batch database operations (Added: July 14, 2025)
- **Production Monitoring**: Real-time queue stats, performance metrics, and cache management endpoints (Added: July 14, 2025)
- **Enterprise Scaling Calculator**: Interactive resource planning tool for 10,000+ users with migration phases and cost estimation (Added: July 14, 2025)
- **Complete Admin Dashboard**: Performance monitoring, scaling analysis, and bottleneck detection with recommendations (Added: July 14, 2025)

## Enterprise Scaling Strategy (10,000+ Users)

### Current Capacity Assessment
- **Current Setup**: Handles 100-500 users with ~1-5 webhook/sec per user
- **Bottlenecks**: In-memory queues, single instance, PostgreSQL connection limits
- **Breaking Point**: ~1,000 concurrent users or 50+ webhook/second sustained load

### Migration Phases for Enterprise Scale

**Phase 1: External Infrastructure (500+ users)**
- Redis Cluster for caching and queuing
- Bull Queue for robust webhook processing
- Redis-based session storage
- Estimated effort: 2-3 weeks

**Phase 2: Horizontal Scaling (2,000+ users)**
- Load balancer (HAProxy/Nginx)
- Multiple application instances
- Sticky sessions for webhook handling
- Health checks and auto-scaling
- Estimated effort: 3-4 weeks

**Phase 3: Microservices (5,000+ users)**
- Dedicated webhook service
- API Gateway for routing
- Message broker (RabbitMQ/Kafka)
- Distributed tracing
- Estimated effort: 6-8 weeks

**Phase 4: Database Scaling (8,000+ users)**
- Database sharding by user_id
- Read replicas for performance
- Connection pooling (PgBouncer)
- Query optimization
- Estimated effort: 4-6 weeks

**Phase 5: Enterprise Infrastructure (10,000+ users)**
- CDN for static assets
- Advanced monitoring (Prometheus/Grafana)
- Centralized logging (ELK Stack)
- Disaster recovery
- Security hardening
- Estimated effort: 4-5 weeks

### Resource Requirements for 10,000 Users
- **Webhook Load**: ~14 webhook/second (5 per user per hour)
- **Memory**: 40GB total across instances
- **CPU**: 6-8 cores per application instance
- **Storage**: Database sharding across 5 PostgreSQL instances
- **Architecture**: 4 app instances + 2 Redis + Load balancer
- **Estimated Cost**: ~$1,500-2,000/month (AWS/Azure)

### Ready-to-Deploy Enterprise Configuration
- Docker Compose with all enterprise components
- Nginx load balancer with SSL termination
- Redis cluster for caching and queues
- PostgreSQL primary/replica setup
- Prometheus + Grafana monitoring
- Complete infrastructure-as-code templates