import type { Express } from "express";
import { storage } from "./storage";

// Temporary debug routes
export function setupDebugRoutes(app: Express) {
  app.get('/api/debug-role', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      console.log('DEBUG: Checking role for userId:', userId);
      
      const userAPI = await storage.getUserForAPI(userId);
      console.log('DEBUG: getUserForAPI result:', userAPI);
      
      const userRaw = await storage.getUser(userId);
      console.log('DEBUG: getUser result role:', userRaw?.role);
      
      res.json({
        message: 'Debug role check',
        userAPI: userAPI,
        userRawRole: userRaw?.role,
        userId: userId
      });
    } catch (error) {
      console.error('DEBUG: Error:', error);
      res.status(500).json({ error: 'Debug failed' });
    }
  });
}