import { IStorage } from "../storage";
import { LogService } from "./logService";

export class LpTrackerService {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  private encrypt(text: string): string {
    // Простое шифрование для демонстрации - в продакшене используйте crypto
    return Buffer.from(text).toString('base64');
  }

  private decrypt(hash: string): string {
    return Buffer.from(hash, 'base64').toString();
  }

  async sendLead(userId: string, leadData: any): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      // Конструируем URL для API
      const baseUrl = `https://${globalSettings.address}/api`;
      
      // Готовим данные для отправки
      const requestData = {
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        project_id: userSettings.projectId,
        ...leadData
      };

      await this.logService.log(userId, 'info', 'Отправка лида в LPTracker', { 
        projectId: userSettings.projectId,
        leadData 
      }, 'lptracker');

      const response = await fetch(`${baseUrl}/send-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Лид отправлен в LPTracker', { result }, 'lptracker');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при отправке лида в LPTracker', { error }, 'lptracker');
      throw error;
    }
  }

  async updateLead(userId: string, leadId: string, leadData: any): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const baseUrl = `https://${globalSettings.address}/api`;
      
      const requestData = {
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        project_id: userSettings.projectId,
        lead_id: leadId,
        ...leadData
      };

      const response = await fetch(`${baseUrl}/update-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Лид обновлен в LPTracker', { result }, 'lptracker');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении лида в LPTracker', { error }, 'lptracker');
      throw error;
    }
  }

  async getLeadStatus(userId: string, leadId: string): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const baseUrl = `https://${globalSettings.address}/api`;
      
      const requestData = {
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        project_id: userSettings.projectId,
        lead_id: leadId
      };

      const response = await fetch(`${baseUrl}/get-lead-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Статус лида получен из LPTracker', { result }, 'lptracker');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при получении статуса лида из LPTracker', { error }, 'lptracker');
      throw error;
    }
  }

  async testConnection(login: string, password: string, address: string = 'direct.lptracker.ru'): Promise<boolean> {
    try {
      const baseUrl = `https://${address}`;
      
      const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          login, 
          password, 
          service: 'CRM Integration',
          version: '1.0'
        }),
      });

      if (!response.ok) {
        await this.logService.error(undefined, `LPTracker connection test failed: ${response.status}`, { login, address });
        return false;
      }

      const result = await response.json();
      
      // Check if the response contains a token according to LPTracker API documentation
      if (result.status === 'success' && result.result?.token) {
        await this.logService.info(undefined, 'LPTracker connection test successful', { login, address });
        
        // Save the token for future use
        const globalSettings = await this.storage.getLpTrackerGlobalSettings();
        if (globalSettings) {
          await this.storage.updateLpTrackerGlobalSettings({
            token: result.result.token,
            isActive: true
          });
        }
        
        return true;
      } else {
        await this.logService.error(undefined, 'LPTracker connection test failed: Invalid response', { login, address, response: result });
        return false;
      }
    } catch (error) {
      await this.logService.error(undefined, `LPTracker connection test error: ${error}`, { login, address });
      return false;
    }
  }

  private async getAuthToken(globalSettings: any): Promise<string> {
    // Check if we have a cached token
    if (globalSettings.token) {
      return globalSettings.token;
    }
    
    const baseUrl = `https://${globalSettings.address}`;
    
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        version: '1.0'
      }),
    });

    if (!response.ok) {
      throw new Error(`LPTracker auth failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.status !== 'success' || !result.result?.token) {
      throw new Error('LPTracker auth failed: no token received');
    }

    // Save the token for future use
    await this.storage.updateLpTrackerGlobalSettings({
      token: result.result.token
    });

    return result.result.token;
  }

  async refreshMetadata(userId: string): Promise<void> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      // Get projects list
      try {
        const projectsResponse = await fetch(`${baseUrl}/getProjectList`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': token,
          },
        });

        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          await this.storage.saveLpTrackerMetadata({
            userId,
            type: 'projects',
            data: projects
          });
        }
      } catch (error) {
        console.warn('Failed to fetch LPTracker projects:', error);
      }

      // Get leads structure (try to get sample lead data)
      try {
        const userSettings = await this.storage.getLpTrackerSettings(userId);
        if (userSettings?.projectId) {
          const leadsResponse = await fetch(`${baseUrl}/getLeadData`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': token,
            },
            body: JSON.stringify({
              project_id: userSettings.projectId,
              limit: 1
            }),
          });

          if (leadsResponse.ok) {
            const leads = await leadsResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'leads',
              data: leads
            });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch LPTracker leads:', error);
      }

      await this.logService.log(userId, 'info', 'Метаданные LPTracker обновлены', {}, 'metadata');
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении метаданных LPTracker', { error }, 'metadata');
      throw error;
    }
  }

  async getProjects(userId: string): Promise<any> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      const response = await fetch(`${baseUrl}/getProjectList`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при получении проектов LPTracker', { error }, 'lptracker');
      throw error;
    }
  }
}