import { IStorage } from "../storage";
import { LogService } from "./logService";
import crypto from "crypto";

export class LpTrackerService {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-ctr';
    const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, secretKey);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(hash: string): string {
    const algorithm = 'aes-256-ctr';
    const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long';
    const [ivHex, encryptedHex] = hash.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, secretKey);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString();
  }

  async sendLead(userId: string, leadData: any): Promise<any> {
    try {
      const settings = await this.storage.getLpTrackerSettings(userId);
      if (!settings) {
        throw new Error('LPTracker settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = 'https://lptracker.ru/api/v1/leads';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Лид отправлен в LPTracker', { result }, 'sync');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при отправке лида в LPTracker', { error }, 'sync');
      throw error;
    }
  }

  async updateLead(userId: string, leadId: string, leadData: any): Promise<any> {
    try {
      const settings = await this.storage.getLpTrackerSettings(userId);
      if (!settings) {
        throw new Error('LPTracker settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = `https://lptracker.ru/api/v1/leads/${leadId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Лид обновлен в LPTracker', { result }, 'sync');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении лида в LPTracker', { error }, 'sync');
      throw error;
    }
  }

  async getLeadStatus(userId: string, leadId: string): Promise<any> {
    try {
      const settings = await this.storage.getLpTrackerSettings(userId);
      if (!settings) {
        throw new Error('LPTracker settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = `https://lptracker.ru/api/v1/leads/${leadId}/status`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при получении статуса лида из LPTracker', { error }, 'sync');
      throw error;
    }
  }
}
