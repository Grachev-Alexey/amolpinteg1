import { IStorage } from "../storage";
import { LogService } from "./logService";
import crypto from "crypto";

export class AmoCrmService {
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

  async testConnection(subdomain: string, apiKey: string): Promise<boolean> {
    try {
      const url = `https://${subdomain}.amocrm.ru/api/v4/account`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error('AmoCRM connection test failed:', error);
      return false;
    }
  }

  async refreshMetadata(userId: string): Promise<void> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error('AmoCRM settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const baseUrl = `https://${settings.subdomain}.amocrm.ru/api/v4`;

      // Получение воронок
      const pipelinesResponse = await fetch(`${baseUrl}/leads/pipelines`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: 'pipelines',
          data: pipelinesData,
        });
      }

      // Получение полей сделок
      const leadsFieldsResponse = await fetch(`${baseUrl}/leads/custom_fields`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (leadsFieldsResponse.ok) {
        const fieldsData = await leadsFieldsResponse.json();
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: 'leads_fields',
          data: fieldsData,
        });
      }

      // Получение полей контактов
      const contactsFieldsResponse = await fetch(`${baseUrl}/contacts/custom_fields`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (contactsFieldsResponse.ok) {
        const fieldsData = await contactsFieldsResponse.json();
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: 'contacts_fields',
          data: fieldsData,
        });
      }

      await this.logService.log(userId, 'info', 'Метаданные AmoCRM успешно обновлены', {}, 'metadata');
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении метаданных AmoCRM', { error }, 'metadata');
      throw error;
    }
  }

  async createLead(userId: string, leadData: any): Promise<any> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error('AmoCRM settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = `https://${settings.subdomain}.amocrm.ru/api/v4/leads`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([leadData]),
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Сделка создана в AmoCRM', { result }, 'sync');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при создании сделки в AmoCRM', { error }, 'sync');
      throw error;
    }
  }

  async updateLead(userId: string, leadId: number, leadData: any): Promise<any> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error('AmoCRM settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = `https://${settings.subdomain}.amocrm.ru/api/v4/leads/${leadId}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Сделка обновлена в AmoCRM', { result }, 'sync');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении сделки в AmoCRM', { error }, 'sync');
      throw error;
    }
  }

  async createContact(userId: string, contactData: any): Promise<any> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error('AmoCRM settings not found');
      }

      const apiKey = this.decrypt(settings.apiKey);
      const url = `https://${settings.subdomain}.amocrm.ru/api/v4/contacts`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([contactData]),
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Контакт создан в AmoCRM', { result }, 'sync');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при создании контакта в AmoCRM', { error }, 'sync');
      throw error;
    }
  }
}
