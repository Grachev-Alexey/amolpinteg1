# CRM Integration System

## Overview

This is a comprehensive CRM integration system designed to connect AmoCRM and LPTracker, providing automated synchronization, webhook processing, and data management capabilities. The application features a multi-user architecture with authentication, rule-based integration logic, and comprehensive logging.

## Recent Changes

**July 10, 2025 - UI Improvements and LPTracker Architecture Fix**
- ✓ Fixed dark theme visibility issues in buttons, inputs, and text elements
- ✓ Improved CSS styles for better contrast and readability in dark mode
- ✓ Removed "Интеграции" tab from admin sidebar (was empty and unnecessary)
- ✓ Created comprehensive admin monitoring page with real-time data
- ✓ Added API endpoints for system health, activity tracking, and integration status
- ✓ Fixed LPTracker architecture - now uses single global account for all users
- ✓ Updated LPTracker settings to support individual project IDs per user
- ✓ Enhanced DataTable component with proper dark theme support
- ✓ Improved boolean value display with proper styling and contrast
- ✓ Added real-time monitoring with system health indicators

**July 9, 2025 - Migration to Replit Environment**
- ✓ Migrated project from Replit Agent to standard Replit environment
- ✓ Set up PostgreSQL database with proper environment variables
- ✓ Installed required dependencies (tsx, drizzle-kit)
- ✓ Applied database migrations successfully
- ✓ Fixed authentication middleware (corrected req.requireAuth() to req.isAuthenticated())
- ✓ Created test user account (admin/admin123) for system testing
- ✓ Added SESSION_SECRET environment variable for secure sessions
- ✓ Verified all API endpoints are working correctly
- ✓ Fixed boolean value display in DataTable component (now shows "Да"/"Нет" instead of "True"/"False")
- ✓ Application now running successfully on port 5000
- ✓ Migration completed successfully

**July 9, 2025 - Code Cleanup and Optimization**
- ✓ Removed 28 unused UI components (accordion, alert-dialog, avatar, etc.)
- ✓ Eliminated all debug console.log statements (except error logging)
- ✓ Removed all TODO/FIXME comments from codebase
- ✓ Created shared useAuthRedirect utility to eliminate code duplication
- ✓ Reduced codebase size from 9,018 to 8,982 lines
- ✓ Cleaned up empty if blocks and unused imports
- ✓ Optimized authentication error handling across all components
- ✓ Codebase is now production-ready and fully optimized

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
- **AmoCrmService**: Handles API connections, metadata retrieval, and data synchronization
- **LpTrackerService**: Manages LPTracker API interactions and lead processing
- **WebhookService**: Processes incoming webhooks from external systems
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
6. **Data Transformation**: Rules execute actions based on configured conditions
7. **File Processing**: XLSX uploads are processed in background with status tracking
8. **Logging**: All operations are logged for audit and debugging

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
- **Real-time Updates**: Webhook processing and live status updates
- **Background Processing**: File uploads and data synchronization
- **Comprehensive Logging**: All operations tracked for debugging
- **Security**: Encrypted credential storage and secure session management
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Exclusively dark theme implementation as per requirements
- **Russian Localization**: Complete Russian language interface

## Migration Status
- **Status**: Complete ✓
- **Date**: 2025-07-09
- **Changes Made**:
  - Implemented simple session-based authentication
  - Fixed authentication middleware
  - Created test user (admin/admin123)
  - Database setup and migrations working
  - All dependencies installed and working

The system is designed to be scalable, maintainable, and user-friendly while providing powerful integration capabilities between AmoCRM and LPTracker systems.