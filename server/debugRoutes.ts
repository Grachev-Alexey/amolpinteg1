import type { Express } from "express";

// Debug routes - can be removed in production
export function setupDebugRoutes(app: Express) {
  // Debug routes disabled in production
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  
  // Debug routes can be added here for development
}