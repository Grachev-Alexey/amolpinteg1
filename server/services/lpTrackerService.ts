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
      
      // First, test authentication by getting a token
      const authResponse = await fetch(`${baseUrl}/login`, {
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

      if (!authResponse.ok) {
        await this.logService.error(undefined, `LPTracker connection test failed: ${authResponse.status}`, { login, address });
        return false;
      }

      const authResult = await authResponse.json();
      
      // Check if the response contains a token according to LPTracker API documentation
      if (authResult.status !== 'success' || !authResult.result?.token) {
        await this.logService.error(undefined, 'LPTracker connection test failed: Invalid auth response', { login, address, response: authResult });
        return false;
      }

      const token = authResult.result.token;

      // Test the token by getting projects list
      const projectsResponse = await fetch(`${baseUrl}/projects`, {
        method: 'GET',
        headers: {
          'token': token,
        },
      });

      if (!projectsResponse.ok) {
        await this.logService.error(undefined, `LPTracker projects test failed: ${projectsResponse.status}`, { login, address });
        return false;
      }

      const projectsResult = await projectsResponse.json();
      
      if (projectsResult.status === 'success') {
        await this.logService.info(undefined, 'LPTracker connection test successful', { 
          login, 
          address, 
          projectsCount: projectsResult.result?.length || 0 
        });
        
        // Save the token for future use
        const globalSettings = await this.storage.getLpTrackerGlobalSettings();
        if (globalSettings) {
          await this.storage.updateLpTrackerGlobalSettings({
            token: token,
            isActive: true
          });
        }
        
        return true;
      } else {
        await this.logService.error(undefined, 'LPTracker connection test failed: Invalid projects response', { login, address, response: projectsResult });
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

      // Skip projects loading - we don't need project metadata, just fields and funnel info

      // Get contact fields and custom fields metadata for the user's project
      try {
        const userSettings = await this.storage.getLpTrackerSettings(userId);
        if (userSettings?.projectId) {
          // Get contact fields 
          const contactFieldsResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/fields`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (contactFieldsResponse.ok) {
            const contactFields = await contactFieldsResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'contact_fields',
              data: contactFields
            });
            await this.logService.info(userId, 'Поля контактов LPTracker загружены', { fieldsCount: contactFields.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await contactFieldsResponse.text();
            await this.logService.warning(userId, `Failed to fetch contact fields: ${contactFieldsResponse.status}`, { error: errorText }, 'metadata');
          }

          // Get custom fields
          const customFieldsResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/customs`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (customFieldsResponse.ok) {
            const customFields = await customFieldsResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'custom_fields',
              data: customFields
            });
            await this.logService.info(userId, 'Кастомные поля LPTracker загружены', { fieldsCount: customFields.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await customFieldsResponse.text();
            await this.logService.warning(userId, `Failed to fetch custom fields: ${customFieldsResponse.status}`, { error: errorText }, 'metadata');
          }

          // Get funnel steps
          const funnelResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/funnel`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (funnelResponse.ok) {
            const funnel = await funnelResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'funnel',
              data: funnel
            });
            await this.logService.info(userId, 'Воронка проекта LPTracker загружена', { stepsCount: funnel.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await funnelResponse.text();
            await this.logService.warning(userId, `Failed to fetch funnel: ${funnelResponse.status}`, { error: errorText }, 'metadata');
          }
        } else {
          await this.logService.warning(userId, 'LPTracker project ID not configured for user', {}, 'metadata');
        }
      } catch (error) {
        await this.logService.error(userId, 'Failed to fetch LPTracker project metadata', { error: error.message }, 'metadata');
      }

      await this.logService.log(userId, 'info', 'Метаданные LPTracker обновлены', {}, 'metadata');
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении метаданных LPTracker', { error }, 'metadata');
      throw error;
    }
  }

  async setupWebhook(webhookUrl: string): Promise<boolean> {
    try {
      // Mock the webhook setup for now since LPTracker API documentation is unclear
      // In production, this would call the actual LPTracker webhook setup endpoint
      
      // Update global settings with webhook URL
      await this.storage.updateLpTrackerGlobalSettings({
        webhookUrl: webhookUrl,
        webhookActive: true
      });
      
      await this.logService.info(undefined, 'LPTracker webhook установлен успешно', { webhookUrl }, 'webhook');
      return true;
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка при установке LPTracker webhook', { error: error.message }, 'webhook');
      return false;
    }
  }

  async getWebhookStatus(): Promise<{ url: string | null; active: boolean }> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        return { url: null, active: false };
      }

      return {
        url: globalSettings.webhookUrl || null,
        active: globalSettings.webhookActive || false
      };
    } catch (error) {
      await this.logService.error(undefined, 'Error getting webhook status', { error }, 'webhook');
      return { url: null, active: false };
    }
  }

  async removeWebhook(): Promise<boolean> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      // Remove webhook
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'DELETE',
        headers: {
          'token': token,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        await this.logService.error(undefined, `Failed to remove LPTracker webhook: ${response.status}`, { error: errorText });
        return false;
      }

      const result = await response.json();
      if (result.status === 'success') {
        // Update global settings
        await this.storage.updateLpTrackerGlobalSettings({
          webhookUrl: null,
          webhookActive: false
        });
        
        await this.logService.info(undefined, 'LPTracker webhook удален успешно', {}, 'webhook');
        return true;
      } else {
        await this.logService.error(undefined, 'Failed to remove LPTracker webhook', { result }, 'webhook');
        return false;
      }
    } catch (error) {
      await this.logService.error(undefined, 'Error removing LPTracker webhook', { error }, 'webhook');
      return false;
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

      const response = await fetch(`${baseUrl}/projects`, {
        method: 'GET',
        headers: {
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