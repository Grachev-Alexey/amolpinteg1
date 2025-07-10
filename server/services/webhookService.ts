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
      
      await this.logService.log(undefined, 'info', 'AmoCRM Webhook - Детальный анализ', { 
        payloadKeys: Object.keys(payload || {}),
        payloadType: typeof payload,
        payloadLength: JSON.stringify(payload).length,
        fullPayload: payload 
      }, 'webhook');

      // Определяем тип события
      const eventType = payload.type || payload.event_type || payload.event;
      
      console.log("AmoCRM Event Type detected:", eventType);
      
      if (!eventType) {
        await this.logService.log(undefined, 'warning', 'AmoCRM - Неизвестный тип события', { 
          payload,
          possibleEventFields: {
            type: payload.type,
            event_type: payload.event_type,
            event: payload.event
          }
        }, 'webhook');
        return;
      }

      // Обработка различных типов событий
      switch (eventType) {
        case 'lead_status_changed':
          await this.handleLeadStatusChanged(payload);
          break;
        case 'lead_created':
          await this.handleLeadCreated(payload);
          break;
        case 'contact_created':
          await this.handleContactCreated(payload);
          break;
        case 'contact_updated':
          await this.handleContactUpdated(payload);
          break;
        default:
          await this.logService.log(undefined, 'info', `Необработанный тип события: ${eventType}`, { payload }, 'webhook');
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

  private async handleLeadStatusChanged(payload: any): Promise<void> {
    try {
      const leadId = payload.lead_id;
      const newStatus = payload.status;
      const userId = payload.user_id; // Предполагаем, что в payload есть user_id

      // Получаем правила пользователя
      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'lead_status_changed', leadId, newStatus })
      );

      // Выполняем действия для каждого подходящего правила
      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { leadId, newStatus, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке изменения статуса сделки', { error, payload }, 'webhook');
    }
  }

  private async handleLeadCreated(payload: any): Promise<void> {
    try {
      const leadId = payload.lead_id;
      const leadData = payload.lead;
      const userId = payload.user_id;

      const rules = await this.storage.getSyncRules(userId);
      const applicableRules = rules.filter(rule => 
        rule.isActive && 
        this.checkConditions(rule.conditions, { type: 'lead_created', leadId, leadData })
      );

      for (const rule of applicableRules) {
        await this.executeActions(rule.actions, { leadId, leadData, userId });
        await this.storage.incrementRuleExecution(rule.id);
      }
    } catch (error) {
      await this.logService.log(undefined, 'error', 'Ошибка при обработке создания сделки', { error, payload }, 'webhook');
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
