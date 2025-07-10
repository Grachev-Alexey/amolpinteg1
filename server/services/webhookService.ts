import { IStorage } from "../storage";
import { LogService } from "./logService";
import { AmoCrmService } from "./amoCrmService";
import { LpTrackerService } from "./lpTrackerService";

export class WebhookService {
  private storage: IStorage;
  private logService: LogService;
  private amoCrmService: AmoCrmService;
  private lpTrackerService: LpTrackerService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
    this.amoCrmService = new AmoCrmService(storage);
    this.lpTrackerService = new LpTrackerService(storage);
  }

  async handleAmoCrmWebhook(payload: any): Promise<void> {
    try {
      console.log("AmoCRM Webhook Processing - Payload structure:", {
        keys: Object.keys(payload || {}),
        payload: payload
      });
      
      // Извлекаем информацию о поддомене для идентификации клиента
      const subdomain = payload['account[subdomain]'];
      const accountId = payload['account[id]'];
      
      await this.logService.log(undefined, 'info', 'AmoCRM Webhook - Детальный анализ', { 
        subdomain,
        accountId,
        payloadKeys: Object.keys(payload || {}),
        payloadType: typeof payload,
        payloadLength: JSON.stringify(payload).length,
        fullPayload: payload 
      }, 'webhook');

      if (!subdomain) {
        await this.logService.log(undefined, 'warning', 'AmoCRM Webhook без поддомена', { payload }, 'webhook');
        return;
      }

      // Находим пользователя по поддомену
      const userId = await this.findUserBySubdomain(subdomain);
      if (!userId) {
        await this.logService.log(undefined, 'warning', `AmoCRM - Пользователь не найден для поддомена: ${subdomain}`, { 
          subdomain, payload 
        }, 'webhook');
        return;
      }

      // Извлекаем ID сделки из любого типа события
      let leadId = null;
      
      // Ищем ID сделки в различных форматах
      if (payload['leads[add][0][id]']) {
        leadId = payload['leads[add][0][id]'];
      } else if (payload['leads[status][0][id]']) {
        leadId = payload['leads[status][0][id]'];
      } else if (payload['leads[update][0][id]']) {
        leadId = payload['leads[update][0][id]'];
      } else if (payload['leads[delete][0][id]']) {
        leadId = payload['leads[delete][0][id]'];
      }

      console.log("AmoCRM Lead ID extracted:", leadId);
      
      if (!leadId) {
        await this.logService.log(userId, 'warning', 'AmoCRM - ID сделки не найден в вебхуке', { 
          subdomain,
          payload,
          availableKeys: Object.keys(payload)
        }, 'webhook');
        return;
      }

      // Получаем полную информацию о сделке через API
      try {
        const leadDetails = await this.getLeadDetails(userId, leadId);
        await this.logService.log(userId, 'info', `AmoCRM - Получена детальная информация о сделке ${leadId}`, { 
          leadDetails,
          originalPayload: payload
        }, 'webhook');

        // Получаем детали всех связанных контактов
        let contactsDetails = [];
        if (leadDetails._embedded?.contacts && leadDetails._embedded.contacts.length > 0) {
          for (const contact of leadDetails._embedded.contacts) {
            try {
              const contactDetails = await this.getContactDetails(userId, contact.id);
              contactsDetails.push(contactDetails);
              
              await this.logService.log(userId, 'info', `AmoCRM - Получена информация о контакте ${contact.id}`, { 
                contactDetails,
                isMainContact: contact.is_main,
                leadId
              }, 'webhook');
            } catch (error) {
              await this.logService.log(userId, 'warning', `AmoCRM - Не удалось получить данные контакта ${contact.id}`, { 
                error, contactId: contact.id, leadId 
              }, 'webhook');
            }
          }
        }

        // Проверяем правила пользователя и выполняем подходящие действия
        await this.processLeadRules(userId, leadId, leadDetails, contactsDetails, payload);

      } catch (error) {
        await this.logService.log(userId, 'error', `Ошибка получения данных сделки ${leadId}`, { 
          error, leadId, payload 
        }, 'webhook');
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке webhook AmoCRM', { error, payload }, 'webhook');
    }
  }

  async handleLpTrackerWebhook(payload: any): Promise<void> {
    try {
      console.log("LPTracker Webhook Processing - Payload structure:", {
        keys: Object.keys(payload || {}),
        payload: payload
      });
      
      await this.logService.log(undefined, 'info', 'LPTracker Webhook - Детальный анализ', { 
        payloadKeys: Object.keys(payload || {}),
        payloadType: typeof payload,
        payloadLength: JSON.stringify(payload).length,
        fullPayload: payload 
      }, 'webhook');

      // Определяем тип события
      const eventType = payload.event || payload.type || payload.event_type;
      
      console.log("LPTracker Event Type detected:", eventType);
      
      if (!eventType) {
        await this.logService.log(undefined, 'warning', 'LPTracker - Неизвестный тип события', { 
          payload,
          possibleEventFields: {
            event: payload.event,
            type: payload.type,
            event_type: payload.event_type
          }
        }, 'webhook');
        return;
      }

      // Обработка различных типов событий
      switch (eventType) {
        case 'call_completed':
          await this.handleCallCompleted(payload);
          break;
        case 'lead_status_updated':
          await this.handleLpTrackerLeadStatusUpdated(payload);
          break;
        default:
          await this.logService.log(undefined, 'info', `Необработанный тип события: ${eventType}`, { payload }, 'webhook');
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке webhook LPTracker', { error, payload }, 'webhook');
    }
  }

  // Вспомогательный метод для поиска пользователя по поддомену
  private async findUserBySubdomain(subdomain: string): Promise<string | null> {
    try {
      // Получаем всех пользователей и проверяем их настройки AmoCRM
      const { db } = await import('../db');
      const { users } = await import('../../shared/schema');
      const allUsers = await db.select().from(users);
      
      for (const user of allUsers) {
        const amoCrmSettings = await this.storage.getAmoCrmSettings(user.id);
        if (amoCrmSettings?.subdomain === subdomain) {
          return user.id;
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding user by subdomain:', error);
      return null;
    }
  }

  // Получение детальной информации о сделке через AmoCRM API
  private async getLeadDetails(userId: string, leadId: string): Promise<any> {
    try {
      const amoCrmSettings = await this.storage.getAmoCrmSettings(userId);
      if (!amoCrmSettings?.subdomain || !amoCrmSettings?.apiKey) {
        throw new Error('AmoCRM настройки не найдены');
      }

      const url = `https://${amoCrmSettings.subdomain}.amocrm.ru/api/v4/leads/${leadId}?with=contacts,companies,catalog_elements,loss_reason,source`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${amoCrmSettings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching lead details:', error);
      throw error;
    }
  }

  // Получение детальной информации о контакте через AmoCRM API
  private async getContactDetails(userId: string, contactId: string): Promise<any> {
    try {
      const amoCrmSettings = await this.storage.getAmoCrmSettings(userId);
      if (!amoCrmSettings?.subdomain || !amoCrmSettings?.apiKey) {
        throw new Error('AmoCRM настройки не найдены');
      }

      const url = `https://${amoCrmSettings.subdomain}.amocrm.ru/api/v4/contacts/${contactId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${amoCrmSettings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AmoCRM Contact API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching contact details:', error);
      throw error;
    }
  }

  // Главный метод обработки правил для сделки
  private async processLeadRules(userId: string, leadId: string, leadDetails: any, contactsDetails: any[], originalPayload: any): Promise<void> {
    try {
      // Получаем правила пользователя только для AmoCRM
      const rules = await this.storage.getSyncRules(userId);
      const amoCrmRules = rules.filter(rule => rule.webhookSource === 'amocrm');
      const activeRules = amoCrmRules.filter(rule => rule.isActive);

      await this.logService.log(userId, 'info', `AmoCRM - Проверяем ${activeRules.length} активных правил для сделки ${leadId}`, { 
        leadId, 
        rulesCount: activeRules.length,
        leadName: leadDetails.name || 'Без названия'
      }, 'webhook');

      for (const rule of activeRules) {
        try {
          // Проверяем условия правила
          const eventData = {
            leadId,
            leadDetails,
            contactsDetails,
            webhookPayload: originalPayload,
            userId
          };

          // Детальное логирование для отладки
          await this.logService.log(userId, 'info', `AmoCRM - Проверяем правило "${rule.name}"`, { 
            ruleId: rule.id,
            ruleName: rule.name,
            leadId,
            conditions: rule.conditions,
            pipelineFromLead: leadDetails.pipeline_id,
            statusFromLead: leadDetails.status_id,
            pipelineFromPayload: originalPayload?.['leads[add][0][pipeline_id]'],
            statusFromPayload: originalPayload?.['leads[add][0][status_id]']
          }, 'webhook');

          if (this.checkConditions(rule.conditions, eventData)) {
            await this.logService.log(userId, 'info', `AmoCRM - Правило "${rule.name}" подходит для сделки ${leadId}`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId
            }, 'webhook');

            // Выполняем действия правила
            await this.executeActions(rule.actions, eventData);
            await this.storage.incrementRuleExecution(rule.id);
          } else {
            await this.logService.log(userId, 'info', `AmoCRM - Правило "${rule.name}" не подходит для сделки ${leadId}`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId
            }, 'webhook');
          }
        } catch (error) {
          await this.logService.log(userId, 'error', `Ошибка применения правила "${rule.name}" для сделки ${leadId}`, { 
            error, 
            ruleId: rule.id,
            leadId 
          }, 'webhook');
        }
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Ошибка обработки правил для сделки ${leadId}`, { 
        error, 
        leadId 
      }, 'webhook');
    }
  }



  private async handleContactCreated(payload: any): Promise<void> {
    try {
      const contactId = payload.contact_id;
      const contactData = payload.contact;
      const userId = payload.user_id;

      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'contact_created', contactId, contactData })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { contactId, contactData, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке создания контакта', { error, payload }, 'webhook');
    }
  }

  private async handleContactUpdated(payload: any): Promise<void> {
    try {
      const contactId = payload.contact_id;
      const contactData = payload.contact;
      const userId = payload.user_id;

      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'contact_updated', contactId, contactData })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { contactId, contactData, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке обновления контакта', { error, payload }, 'webhook');
    }
  }

  private async handleCallCompleted(payload: any): Promise<void> {
    try {
      const callData = payload.call;
      const userId = payload.user_id;

      // Сохраняем результат прозвона
      await this.storage.createCallResult({
        userId,
        contactName: callData.contact_name,
        phone: callData.phone,
        result: callData.result,
        duration: callData.duration,
        callDate: new Date(callData.call_date),
        syncStatus: 'pending',
      });

      // Обрабатываем правила
      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'call_completed', callData })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { callData, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке завершения звонка', { error, payload }, 'webhook');
    }
  }

  private async handleLpTrackerLeadStatusUpdated(payload: any): Promise<void> {
    try {
      const leadId = payload.lead_id;
      const newStatus = payload.status;
      const userId = payload.user_id;

      const rules = await this.storage.getSyncRules(userId);
      const lpTrackerRules = rules.filter(rule => rule.webhookSource === 'lptracker');
      const applicableRules = lpTrackerRules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'lptracker_lead_status_updated', leadId, newStatus })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { leadId, newStatus, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке обновления статуса лида LPTracker', { error, payload }, 'webhook');
    }
  }

  private checkConditions(conditions: any, eventData: any): boolean {
    try {
      if (!conditions || !conditions.rules) {
        return false;
      }

      const operator = conditions.operator || 'AND';
      const results = conditions.rules.map((condition: any) => {
        switch (condition.type) {
          case 'event_type':
            return eventData.type === condition.value;
          
          case 'pipeline':
            // Проверяем ID воронки из данных сделки
            const pipelineId = eventData.leadDetails?.pipeline_id || eventData.webhookPayload?.['leads[add][0][pipeline_id]'];
            return String(pipelineId) === String(condition.value);
          
          case 'status':
            // Проверяем ID статуса из данных сделки
            const statusId = eventData.leadDetails?.status_id || eventData.webhookPayload?.['leads[add][0][status_id]'];
            return String(statusId) === String(condition.value);
          
          case 'field_equals':
            const fieldValue = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            return String(fieldValue) === String(condition.value);
          
          case 'field_contains':
            const fieldValueContains = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            return fieldValueContains?.includes(condition.value);
          
          case 'field_not_empty':
            const fieldValueNotEmpty = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            return fieldValueNotEmpty != null && fieldValueNotEmpty !== '';
          
          default:
            console.log(`Неизвестный тип условия: ${condition.type}`, condition);
            return false;
        }
      });

      // Применяем оператор AND/OR
      if (operator === 'OR') {
        return results.some(result => result);
      } else {
        return results.every(result => result);
      }
    } catch (error) {
      console.error('Ошибка проверки условий:', error);
      return false;
    }
  }

  private async executeActions(actions: any, eventData: any): Promise<void> {
    try {
      if (!actions || !actions.list) {
        return;
      }

      for (const action of actions.list) {
        try {
          await this.logService.log(eventData.userId, 'info', `Выполняется действие: ${action.type}`, { action }, 'webhook');

          // Подготавливаем данные для синхронизации из различных источников
          const webhookData = {
            name: eventData.leadDetails?.name || eventData.contactsDetails?.[0]?.name || eventData.callData?.contact_name || 'Новый контакт',
            first_name: eventData.contactsDetails?.[0]?.first_name || eventData.callData?.contact_name || '',
            last_name: eventData.contactsDetails?.[0]?.last_name || '',
            phone: this.extractPhoneFromContact(eventData.contactsDetails?.[0]) || eventData.callData?.phone || '',
            email: this.extractEmailFromContact(eventData.contactsDetails?.[0]) || eventData.callData?.email || '',
            deal_name: eventData.leadDetails?.name || 'Новая сделка',
            price: eventData.leadDetails?.price || 0,
            custom_fields: eventData.leadDetails?.custom_fields_values || {},
            source: 'webhook_automation',
            campaign: eventData.callData?.campaign || '',
            keyword: eventData.callData?.keyword || ''
          };

          // Применяем маппинг полей если он настроен
          const mappedWebhookData = this.applyFieldMapping(webhookData, action.fieldMappings || {}, eventData);

          switch (action.type) {
            case 'sync_to_amocrm':
              await this.amoCrmService.syncToAmoCrm(eventData.userId, mappedWebhookData, action.searchBy || 'phone');
              break;
            case 'sync_to_lptracker':
              await this.lpTrackerService.syncToLpTracker(eventData.userId, mappedWebhookData, action.searchBy || 'phone');
              break;
            default:
              await this.logService.log(eventData.userId, 'warning', `Неизвестный тип действия: ${action.type}`, { action }, 'webhook');
          }
        } catch (error) {
          await this.logService.log(eventData.userId, 'error', `Ошибка выполнения действия: ${action.type}`, { error, action }, 'webhook');
        }
      }
    } catch (error) {
      await this.logService.log(eventData.userId, 'error', 'Ошибка при выполнении действий', { error, actions }, 'webhook');
    }
  }

  private extractPhoneFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const phoneField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'PHONE' || field.field_name === 'Телефон'
    );
    
    if (phoneField && phoneField.values && phoneField.values.length > 0) {
      return phoneField.values[0].value;
    }
    
    return '';
  }

  private extractEmailFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const emailField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'EMAIL' || field.field_name === 'Email'
    );
    
    if (emailField && emailField.values && emailField.values.length > 0) {
      return emailField.values[0].value;
    }
    
    return '';
  }

  private applyFieldMapping(webhookData: any, fieldMappings: any, eventData: any): any {
    // Создаем копию исходных данных
    const mappedData = { ...webhookData };

    // Если нет настроек маппинга, возвращаем исходные данные
    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      return mappedData;
    }

    // Применяем маппинг полей
    for (const [sourceField, targetField] of Object.entries(fieldMappings)) {
      if (sourceField && targetField) {
        // Получаем значение из исходных данных вебхука
        const sourceValue = this.getFieldValue(sourceField, eventData);
        
        if (sourceValue !== undefined && sourceValue !== null) {
          // Устанавливаем значение в целевое поле
          mappedData[targetField as string] = sourceValue;
          
          // Логируем примененное маппинг
          this.logService.log(eventData.userId, 'info', `Применен маппинг поля: ${sourceField} → ${targetField}`, { 
            sourceField, 
            targetField, 
            sourceValue 
          }, 'webhook');
        }
      }
    }

    return mappedData;
  }

  private getFieldValue(fieldPath: string, eventData: any): any {
    try {
      // Обработка стандартных полей
      const standardFields: { [key: string]: (data: any) => any } = {
        'name': (data) => data.leadDetails?.name || data.contactsDetails?.[0]?.name || '',
        'first_name': (data) => data.contactsDetails?.[0]?.first_name || '',
        'last_name': (data) => data.contactsDetails?.[0]?.last_name || '',
        'phone': (data) => this.extractPhoneFromContact(data.contactsDetails?.[0]) || '',
        'email': (data) => this.extractEmailFromContact(data.contactsDetails?.[0]) || '',
        'deal_name': (data) => data.leadDetails?.name || '',
        'price': (data) => data.leadDetails?.price || 0,
        'pipeline_id': (data) => data.leadDetails?.pipeline_id || '',
        'status_id': (data) => data.leadDetails?.status_id || ''
      };

      // Если это стандартное поле, используем функцию извлечения
      if (standardFields[fieldPath]) {
        return standardFields[fieldPath](eventData);
      }

      // Если это кастомное поле, ищем в custom_fields_values
      if (fieldPath.startsWith('custom_field_')) {
        const fieldId = fieldPath.replace('custom_field_', '');
        const customField = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == fieldId);
        return customField?.values?.[0]?.value || '';
      }

      // Если это поле контакта, ищем в custom_fields_values контакта
      if (fieldPath.startsWith('contact_field_')) {
        const fieldId = fieldPath.replace('contact_field_', '');
        const contactField = eventData.contactsDetails?.[0]?.custom_fields_values?.find((f: any) => f.field_id == fieldId);
        return contactField?.values?.[0]?.value || '';
      }

      // Прямое обращение к полю
      const pathParts = fieldPath.split('.');
      let value = eventData;
      
      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    } catch (error) {
      console.error('Ошибка получения значения поля:', error);
      return undefined;
    }
  }
}
