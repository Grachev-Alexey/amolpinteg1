import { IStorage } from "../storage";
import { LogService } from "./logService";
import { SmartFieldMapper } from "./smartFieldMapper";

export class AmoCrmService {
  private storage: IStorage;
  private logService: LogService;
  private smartFieldMapper: SmartFieldMapper;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
    this.smartFieldMapper = new SmartFieldMapper(storage);
  }

  async testConnection(subdomain: string, apiKey: string): Promise<boolean> {
    try {
      let baseUrl = subdomain.replace(/^https?:\/\//, "");
      if (!baseUrl.includes(".amocrm.ru")) {
        baseUrl = `${baseUrl}.amocrm.ru`;
      }

      const url = `https://${baseUrl}/api/v4/leads/pipelines`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AmoCRM API error:", response.status, errorText);
        return false;
      }

      const data = await response.json();
      return !!(data && (data._embedded || data._links || Array.isArray(data)));
    } catch (error) {
      console.error("AmoCRM connection test failed:", error);
      return false;
    }
  }

  async refreshMetadata(userId: string): Promise<void> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error("AmoCRM settings not found");
      }

      const apiKey = settings.apiKey;

      let normalizedSubdomain = settings.subdomain.replace(/^https?:\/\//, "");
      if (!normalizedSubdomain.includes(".amocrm.ru")) {
        normalizedSubdomain = `${normalizedSubdomain}.amocrm.ru`;
      }
      const baseUrl = `https://${normalizedSubdomain}/api/v4`;

      // Получение воронок
      const pipelinesResponse = await fetch(`${baseUrl}/leads/pipelines`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      await this.logService.log(
        userId,
        "info",
        "Pipelines response",
        {
          status: pipelinesResponse.status,
          statusText: pipelinesResponse.statusText,
          url: `${baseUrl}/leads/pipelines`,
        },
        "metadata",
      );

      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        await this.logService.log(
          userId,
          "info",
          "Pipelines data received",
          { pipelinesData },
          "metadata",
        );
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: "pipelines",
          data: pipelinesData,
        });
      } else {
        const errorText = await pipelinesResponse.text();
        await this.logService.log(
          userId,
          "error",
          "Pipelines API error",
          {
            status: pipelinesResponse.status,
            error: errorText,
          },
          "metadata",
        );
      }

      // Получение полей сделок
      const leadsFieldsResponse = await fetch(
        `${baseUrl}/leads/custom_fields`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      await this.logService.log(
        userId,
        "info",
        "Leads fields response",
        {
          status: leadsFieldsResponse.status,
          statusText: leadsFieldsResponse.statusText,
        },
        "metadata",
      );

      if (leadsFieldsResponse.ok) {
        const fieldsData = await leadsFieldsResponse.json();
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: "leads_fields",
          data: fieldsData,
        });
      } else {
        const errorText = await leadsFieldsResponse.text();
        await this.logService.log(
          userId,
          "error",
          "Leads fields API error",
          {
            status: leadsFieldsResponse.status,
            error: errorText,
          },
          "metadata",
        );
      }

      // Получение полей контактов
      const contactsFieldsResponse = await fetch(
        `${baseUrl}/contacts/custom_fields`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      await this.logService.log(
        userId,
        "info",
        "Contacts fields response",
        {
          status: contactsFieldsResponse.status,
          statusText: contactsFieldsResponse.statusText,
        },
        "metadata",
      );

      if (contactsFieldsResponse.ok) {
        const fieldsData = await contactsFieldsResponse.json();
        await this.storage.saveAmoCrmMetadata({
          userId,
          type: "contacts_fields",
          data: fieldsData,
        });
      } else {
        const errorText = await contactsFieldsResponse.text();
        await this.logService.log(
          userId,
          "error",
          "Contacts fields API error",
          {
            status: contactsFieldsResponse.status,
            error: errorText,
          },
          "metadata",
        );
      }

      await this.logService.log(
        userId,
        "info",
        "Метаданные AmoCRM успешно обновлены",
        {},
        "metadata",
      );
    } catch (error) {
      await this.logService.log(
        userId,
        "error",
        "Ошибка при обновлении метаданных AmoCRM",
        { error },
        "metadata",
      );
      throw error;
    }
  }

  async syncToAmoCrm(userId: string, webhookData: any, searchBy: string = "phone"): Promise<any> {
    await this.logService.log(userId, 'info', 'Starting AmoCRM sync with Smart Field Mapping', { 
      webhookData, 
      searchBy,
      hasFieldMappings: !!(webhookData.fieldMappings && Object.keys(webhookData.fieldMappings).length > 0)
    }, 'amocrm');
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error("AmoCRM settings not found");
      }

      const apiKey = settings.apiKey;
      let normalizedSubdomain = settings.subdomain.replace(/^https?:\/\//, "");
      if (!normalizedSubdomain.includes(".amocrm.ru")) {
        normalizedSubdomain = `${normalizedSubdomain}.amocrm.ru`;
      }
      const baseUrl = `https://${normalizedSubdomain}/api/v4`;

      await this.logService.log(userId, 'info', 'Starting AmoCRM sync', { webhookData, searchBy, userId }, 'amocrm');

      // 1. Найти или создать контакт (с включенными сделками)
      const contact = await this.findOrCreateContact(userId, baseUrl, apiKey, webhookData, searchBy);
      
      // 2. Найти или создать сделку для контакта (используя данные из контакта)
      const deal = await this.findOrCreateDeal(userId, baseUrl, apiKey, contact.id, webhookData, contact._embedded?.leads);

      await this.logService.log(userId, 'info', 'AmoCRM sync completed', { 
        contact: { id: contact.id, name: contact.name },
        deal: { id: deal.id, name: deal.name }
      }, 'amocrm');

      return { contact, deal };
    } catch (error) {
      await this.logService.log(userId, 'error', 'AmoCRM sync failed', { 
        error: error.message,
        stack: error.stack,
        webhookData: {
          name: webhookData.name,
          phone: webhookData.phone,
          email: webhookData.email
        }
      }, 'amocrm');
      throw error;
    }
  }

  private async findOrCreateContact(userId: string, baseUrl: string, apiKey: string, webhookData: any, searchBy: string): Promise<any> {
    try {
      // Поиск контакта
      let searchValue = '';
      if (searchBy === 'phone' && webhookData.phone) {
        searchValue = webhookData.phone;
      } else if (searchBy === 'email' && webhookData.email) {
        searchValue = webhookData.email;
      } else if (searchBy === 'name' && webhookData.name) {
        searchValue = webhookData.name;
      }

      if (searchValue) {
        const searchResponse = await fetch(`${baseUrl}/contacts?query=${encodeURIComponent(searchValue)}&with=leads`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          if (searchResult._embedded && searchResult._embedded.contacts && searchResult._embedded.contacts.length > 0) {
            const existingContact = searchResult._embedded.contacts[0];
            await this.logService.log(userId, 'info', 'Found existing contact with leads', { 
              contactId: existingContact.id, 
              leadsCount: existingContact._embedded?.leads?.length || 0 
            }, 'amocrm');
            return existingContact;
          }
        }
      }

      // Создание нового контакта
      const contactData = {
        first_name: webhookData.first_name || webhookData.name || '',
        last_name: webhookData.last_name || '',
        name: webhookData.name || `${webhookData.first_name || ''} ${webhookData.last_name || ''}`.trim(),
        custom_fields_values: []
      };

      // Добавляем телефон
      if (webhookData.phone) {
        contactData.custom_fields_values.push({
          field_code: 'PHONE',
          values: [{ value: webhookData.phone, enum_code: 'WORK' }]
        });
      }

      // Добавляем email
      if (webhookData.email) {
        contactData.custom_fields_values.push({
          field_code: 'EMAIL',
          values: [{ value: webhookData.email, enum_code: 'WORK' }]
        });
      }

      // Добавляем кастомные поля из маппинга
      if (webhookData.custom_fields_values) {
        for (const [fieldId, value] of Object.entries(webhookData.custom_fields_values)) {
          if (value && fieldId) {
            contactData.custom_fields_values.push({
              field_id: parseInt(fieldId),
              values: [{ value }]
            });
          }
        }
      }

      const createResponse = await fetch(`${baseUrl}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([contactData]),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create contact: ${createResponse.status}`);
      }

      const createResult = await createResponse.json();
      const newContact = createResult._embedded.contacts[0];
      await this.logService.log(userId, 'info', 'Created new contact', { contactId: newContact.id }, 'amocrm');
      return newContact;

    } catch (error) {
      await this.logService.log(userId, 'error', 'Contact find/create failed', { error: error.message }, 'amocrm');
      throw error;
    }
  }

  private async findOrCreateDeal(userId: string, baseUrl: string, apiKey: string, contactId: number, webhookData: any, existingLeads?: any[]): Promise<any> {
    try {
      // Сначала проверяем сделки, полученные вместе с контактом
      if (existingLeads && existingLeads.length > 0) {
        const existingDeal = existingLeads[0];
        await this.logService.log(userId, 'info', 'Found existing deal from contact data', { dealId: existingDeal.id }, 'amocrm');
        
        // Обновляем существующую сделку
        const updateData = {
          id: existingDeal.id,
          name: webhookData.deal_name || existingDeal.name,
          price: webhookData.price || existingDeal.price,
        };

        const updateResponse = await fetch(`${baseUrl}/leads`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([updateData]),
        });

        if (updateResponse.ok) {
          const updateResult = await updateResponse.json();
          return updateResult._embedded.leads[0];
        }
        
        return existingDeal;
      }

      // Создание новой сделки
      const dealData = {
        name: webhookData.deal_name || webhookData.name || 'Новая сделка',
        price: webhookData.price || 0,
        contacts: [{ id: contactId }],
        custom_fields_values: []
      };

      // Добавляем кастомные поля сделки из маппинга
      if (webhookData.deal_custom_fields) {
        for (const [fieldId, value] of Object.entries(webhookData.deal_custom_fields)) {
          if (value && fieldId) {
            dealData.custom_fields_values.push({
              field_id: parseInt(fieldId),
              values: [{ value }]
            });
          }
        }
      }

      const createResponse = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([dealData]),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create deal: ${createResponse.status}`);
      }

      const createResult = await createResponse.json();
      const newDeal = createResult._embedded.leads[0];
      await this.logService.log(userId, 'info', 'Created new deal', { dealId: newDeal.id }, 'amocrm');
      return newDeal;

    } catch (error) {
      await this.logService.log(userId, 'error', 'Deal find/create failed', { error: error.message }, 'amocrm');
      throw error;
    }
  }

  async updateLead(
    userId: string,
    leadId: number,
    leadData: any,
  ): Promise<any> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error("AmoCRM settings not found");
      }

      const apiKey = settings.apiKey;

      let normalizedSubdomain = settings.subdomain.replace(/^https?:\/\//, "");
      if (!normalizedSubdomain.includes(".amocrm.ru")) {
        normalizedSubdomain = `${normalizedSubdomain}.amocrm.ru`;
      }
      const url = `https://${normalizedSubdomain}/api/v4/leads/${leadId}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(
        userId,
        "info",
        "Сделка обновлена в AmoCRM",
        { result },
        "sync",
      );
      return result;
    } catch (error) {
      await this.logService.log(
        userId,
        "error",
        "Ошибка при обновлении сделки в AmoCRM",
        { error },
        "sync",
      );
      throw error;
    }
  }

  async createContact(userId: string, contactData: any): Promise<any> {
    try {
      const settings = await this.storage.getAmoCrmSettings(userId);
      if (!settings) {
        throw new Error("AmoCRM settings not found");
      }

      const apiKey = settings.apiKey;

      let normalizedSubdomain = settings.subdomain.replace(/^https?:\/\//, "");
      if (!normalizedSubdomain.includes(".amocrm.ru")) {
        normalizedSubdomain = `${normalizedSubdomain}.amocrm.ru`;
      }
      const url = `https://${normalizedSubdomain}/api/v4/contacts`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([contactData]),
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(
        userId,
        "info",
        "Контакт создан в AmoCRM",
        { result },
        "sync",
      );
      return result;
    } catch (error) {
      await this.logService.log(
        userId,
        "error",
        "Ошибка при создании контакта в AmoCRM",
        { error },
        "sync",
      );
      throw error;
    }
  }
}
