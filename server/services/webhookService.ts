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

      // Определяем тип события из структуры payload
      let eventType = null;
      let entityData = null;

      // Проверяем на добавление сделки
      if (payload['leads[add][0][id]']) {
        eventType = 'lead_created';
        entityData = {
          id: payload['leads[add][0][id]'],
          status_id: payload['leads[add][0][status_id]'],
          pipeline_id: payload['leads[add][0][pipeline_id]']
        };
      }
      // Проверяем на изменение статуса сделки
      else if (payload['leads[status][0][id]']) {
        eventType = 'lead_status_changed';
        entityData = {
          id: payload['leads[status][0][id]'],
          status_id: payload['leads[status][0][status_id]'],
          old_status_id: payload['leads[status][0][old_status_id]'],
          pipeline_id: payload['leads[status][0][pipeline_id]']
        };
      }
      // Проверяем на обновление сделки
      else if (payload['leads[update][0][id]']) {
        eventType = 'lead_updated';
        entityData = {
          id: payload['leads[update][0][id]'],
          status_id: payload['leads[update][0][status_id]'],
          pipeline_id: payload['leads[update][0][pipeline_id]']
        };
      }

      console.log("AmoCRM Event Type detected:", eventType, "Data:", entityData);
      
      if (!eventType) {
        await this.logService.log(undefined, 'warning', 'AmoCRM - Неизвестный тип события', { 
          subdomain,
          payload,
          availableKeys: Object.keys(payload)
        }, 'webhook');
        return;
      }

      // Получаем полную информацию о сделке через API
      if (entityData && entityData.id) {
        try {
          const leadDetails = await this.getLeadDetails(userId, entityData.id);
          await this.logService.log(userId, 'info', `AmoCRM - Получена детальная информация о сделке ${entityData.id}`, { 
            leadDetails,
            eventType,
            originalPayload: payload
          }, 'webhook');

          // Обработка различных типов событий с полными данными
          switch (eventType) {
            case 'lead_status_changed':
              await this.handleLeadStatusChanged({...payload, userId, leadDetails, entityData});
              break;
            case 'lead_created':
              await this.handleLeadCreated({...payload, userId, leadDetails, entityData});
              break;
            case 'lead_updated':
              await this.handleLeadUpdated({...payload, userId, leadDetails, entityData});
              break;
            default:
              await this.logService.log(userId, 'info', `Необработанный тип события: ${eventType}`, { 
                payload, leadDetails, entityData 
              }, 'webhook');
          }
        } catch (error) {
          await this.logService.log(userId, 'error', `Ошибка получения данных сделки ${entityData.id}`, { 
            error, entityData, eventType 
          }, 'webhook');
        }
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

  private async handleLeadStatusChanged(payload: any): Promise<void> {
    const { userId, leadDetails, entityData } = payload;

    await this.logService.log(userId, 'info', 'AmoCRM - Статус сделки изменен', { 
      leadId: entityData.id,
      newStatusId: entityData.status_id,
      oldStatusId: entityData.old_status_id,
      leadDetails,
      entityData
    }, 'webhook');

    try {
      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { 
          type: 'lead_status_changed', 
          leadId: entityData.id, 
          newStatus: entityData.status_id,
          oldStatus: entityData.old_status_id,
          leadData: leadDetails
        })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { 
          leadId: entityData.id, 
          newStatus: entityData.status_id,
          oldStatus: entityData.old_status_id,
          leadData: leadDetails, 
          userId 
        });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при применении правил для изменения статуса сделки', { error, entityData }, 'webhook');
    }
  }

  private async handleLeadCreated(payload: any): Promise<void> {
    const { userId, leadDetails, entityData } = payload;
    
    await this.logService.log(userId, 'info', 'AmoCRM - Новая сделка создана', { 
      leadId: entityData.id,
      leadDetails,
      entityData
    }, 'webhook');

    // Здесь можно добавить логику отправки в LPTracker или другие действия
    // на основе правил синхронизации пользователя
    try {
      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'lead_created', leadId: entityData.id, leadData: leadDetails })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { leadId: entityData.id, leadData: leadDetails, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при применении правил для новой сделки', { error, entityData }, 'webhook');
    }
  }

  private async handleLeadUpdated(payload: any): Promise<void> {
    const { userId, leadDetails, entityData } = payload;
    
    await this.logService.log(userId, 'info', 'AmoCRM - Сделка обновлена', { 
      leadId: entityData.id,
      leadDetails,
      entityData
    }, 'webhook');

    try {
      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'lead_updated', leadId: entityData.id, leadData: leadDetails })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { leadId: entityData.id, leadData: leadDetails, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при применении правил для обновленной сделки', { error, entityData }, 'webhook');
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
      const applicableRules = rules.filter(rule => 
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
      // Простая проверка условий - можно расширить
      if (!conditions || !conditions.rules) {
        return false;
      }

      return conditions.rules.every((condition: any) => {
        switch (condition.type) {
          case 'event_type':
            return eventData.type === condition.value;
          case 'field_equals':
            return eventData[condition.field] === condition.value;
          case 'field_contains':
            return eventData[condition.field]?.includes(condition.value);
          default:
            return false;
        }
      });
    } catch (error) {
      return false;
    }
  }

  private async executeActions(actions: any, eventData: any): Promise<void> {
    try {
      if (!actions || !actions.list) {
        return;
      }

      for (const action of actions.list) {
        switch (action.type) {
          case 'create_amocrm_lead':
            await this.amoCrmService.createLead(eventData.userId, action.data);
            break;
          case 'update_amocrm_lead':
            await this.amoCrmService.updateLead(eventData.userId, action.leadId, action.data);
            break;
          case 'create_amocrm_contact':
            await this.amoCrmService.createContact(eventData.userId, action.data);
            break;
          case 'send_to_lptracker':
            await this.lpTrackerService.sendLead(eventData.userId, action.data);
            break;
          case 'update_lptracker_lead':
            await this.lpTrackerService.updateLead(eventData.userId, action.leadId, action.data);
            break;
          default:
            await this.logService.log(eventData.userId, 'warning', `Неизвестный тип действия: ${action.type}`, { action }, 'webhook');
        }
      }
    } catch (error) {
      await this.logService.log(eventData.userId, 'error', 'Ошибка при выполнении действий', { error, actions }, 'webhook');
    }
  }
}
