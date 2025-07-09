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
}