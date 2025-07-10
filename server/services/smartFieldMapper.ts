import { IStorage } from '../storage';
import { LogService } from './logService';

interface FieldMappingResult {
  contactFields: any;
  leadFields: any;
  customFields: any;
}

export class SmartFieldMapper {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  /**
   * Маппинг полей с использованием пользовательских настроек маппирования
   * Пользователь сам указывает, в какую сущность (контакт/лид) и в какое поле записывать данные
   */
  async smartMapFields(userId: string, fieldMappings: any, sourceData: any, targetCrm: 'amocrm' | 'lptracker'): Promise<FieldMappingResult> {
    const result: FieldMappingResult = {
      contactFields: {},
      leadFields: {},
      customFields: {}
    };

    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      return result;
    }

    await this.logService.log(userId, 'info', `Smart Field Mapper - Начинаем маппирование для ${targetCrm}`, { 
      fieldMappings
    }, 'smart_mapper');

    // Обрабатываем каждое маппирование
    for (const [sourceField, targetMapping] of Object.entries(fieldMappings)) {
      if (!sourceField || !targetMapping) continue;

      // Получаем значение из исходных данных
      const sourceValue = this.extractSourceValue(sourceField, sourceData);
      if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
        continue;
      }

      // Новый формат маппирования: { entity: 'contact|lead', field: 'field_id_or_name', type: 'standard|custom' }
      const mapping = typeof targetMapping === 'string' 
        ? this.parseOldFormatMapping(targetMapping) 
        : targetMapping;

      if (!mapping || !mapping.entity || !mapping.field) {
        await this.logService.log(userId, 'warning', `Smart Field Mapper - Неверный формат маппирования`, { 
          sourceField,
          targetMapping
        }, 'smart_mapper');
        continue;
      }

      // Применяем маппирование
      await this.applyFieldMapping(result, mapping, sourceValue, targetCrm, userId);

      await this.logService.log(userId, 'info', `Smart Field Mapper - Поле успешно замаппировано`, { 
        sourceField,
        targetMapping: mapping,
        sourceValue,
        targetCrm
      }, 'smart_mapper');
    }

    await this.logService.log(userId, 'info', `Smart Field Mapper - Результат маппирования`, { 
      contactFieldsCount: Object.keys(result.contactFields).length,
      leadFieldsCount: Object.keys(result.leadFields).length,
      customFieldsCount: Object.keys(result.customFields).length,
      result
    }, 'smart_mapper');

    return result;
  }

  /**
   * Парсит старый формат маппирования (для обратной совместимости)
   */
  private parseOldFormatMapping(targetFieldId: string): any {
    // Стандартные поля
    const standardFields = {
      'name': { entity: 'contact', field: 'name', type: 'standard' },
      'phone': { entity: 'contact', field: 'phone', type: 'standard' },
      'email': { entity: 'contact', field: 'email', type: 'standard' },
      'first_name': { entity: 'contact', field: 'name', type: 'standard' },
      'last_name': { entity: 'contact', field: 'name', type: 'standard' }
    };

    if (standardFields[targetFieldId]) {
      return standardFields[targetFieldId];
    }

    // Если это числовой ID, предполагаем что это кастомное поле
    if (/^\d+$/.test(targetFieldId)) {
      // Без метаданных нельзя определить, поэтому возвращаем null
      return null;
    }

    return null;
  }

  /**
   * Применяет маппирование поля к результату
   */
  private async applyFieldMapping(result: FieldMappingResult, mapping: any, sourceValue: any, targetCrm: 'amocrm' | 'lptracker', userId: string): Promise<void> {
    const { entity, field, type } = mapping;

    if (entity === 'contact') {
      if (type === 'standard') {
        // Стандартные поля контакта
        if (field === 'name') {
          result.contactFields.name = sourceValue;
        } else if (field === 'phone') {
          if (targetCrm === 'lptracker') {
            result.contactFields.phone = sourceValue;
          } else {
            // AmoCRM - находим ID поля телефона из метаданных
            const phoneFieldId = await this.findStandardFieldId(userId, targetCrm, 'phone');
            if (phoneFieldId) {
              if (!result.contactFields.custom_fields_values) {
                result.contactFields.custom_fields_values = [];
              }
              result.contactFields.custom_fields_values.push({
                field_id: phoneFieldId,
                values: [{ value: sourceValue, enum_code: 'WORK' }]
              });
            }
          }
        } else if (field === 'email') {
          if (targetCrm === 'lptracker') {
            result.contactFields.email = sourceValue;
          } else {
            // AmoCRM - находим ID поля email из метаданных
            const emailFieldId = await this.findStandardFieldId(userId, targetCrm, 'email');
            if (emailFieldId) {
              if (!result.contactFields.custom_fields_values) {
                result.contactFields.custom_fields_values = [];
              }
              result.contactFields.custom_fields_values.push({
                field_id: emailFieldId,
                values: [{ value: sourceValue, enum_code: 'WORK' }]
              });
            }
          }
        }
      } else if (type === 'custom') {
        // Кастомные поля контакта
        if (targetCrm === 'lptracker') {
          result.contactFields[field] = sourceValue;
        } else {
          // AmoCRM
          if (!result.contactFields.custom_fields_values) {
            result.contactFields.custom_fields_values = [];
          }
          result.contactFields.custom_fields_values.push({
            field_id: parseInt(field),
            values: [{ value: sourceValue }]
          });
        }
      }
    } else if (entity === 'lead') {
      if (type === 'standard') {
        // Стандартные поля лида
        if (field === 'name') {
          result.leadFields.name = sourceValue;
        } else if (field === 'price') {
          result.leadFields.price = sourceValue;
        }
      } else if (type === 'custom') {
        // Кастомные поля лида
        if (targetCrm === 'lptracker') {
          result.leadFields[field] = sourceValue;
        } else {
          // AmoCRM
          if (!result.leadFields.custom_fields_values) {
            result.leadFields.custom_fields_values = [];
          }
          result.leadFields.custom_fields_values.push({
            field_id: parseInt(field),
            values: [{ value: sourceValue }]
          });
        }
      }
    }
  }

  private async getTargetCrmMetadata(userId: string, targetCrm: 'amocrm' | 'lptracker'): Promise<any> {
    try {
      if (targetCrm === 'amocrm') {
        const contactFields = await this.storage.getAmoCrmMetadata(userId, 'contacts_fields');
        const leadFields = await this.storage.getAmoCrmMetadata(userId, 'leads_fields');
        return {
          contactFields: contactFields?.data,
          leadFields: leadFields?.data
        };
      } else {
        const contactFields = await this.storage.getLpTrackerMetadata(userId, 'contact_fields');
        const customFields = await this.storage.getLpTrackerMetadata(userId, 'custom_fields');
        return {
          contactFields: contactFields?.data,
          customFields: customFields?.data
        };
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка получения метаданных`, { 
        error: error.message, 
        targetCrm 
      }, 'smart_mapper');
      return null;
    }
  }

  /**
   * Получает список доступных полей для маппирования
   */
  async getAvailableFields(userId: string, targetCrm: 'amocrm' | 'lptracker'): Promise<{
    contactFields: { standard: any[], custom: any[] },
    leadFields: { standard: any[], custom: any[] }
  }> {
    const result = {
      contactFields: { standard: [], custom: [] },
      leadFields: { standard: [], custom: [] }
    };

    // Стандартные поля
    result.contactFields.standard = [
      { id: 'name', name: 'Имя', type: 'standard' },
      { id: 'phone', name: 'Телефон', type: 'standard' },
      { id: 'email', name: 'Email', type: 'standard' }
    ];

    result.leadFields.standard = [
      { id: 'name', name: 'Название сделки', type: 'standard' },
      { id: 'price', name: 'Бюджет', type: 'standard' }
    ];

    try {
      const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
      
      if (metadata && targetCrm === 'amocrm') {
        // AmoCRM кастомные поля
        const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
        const leadFields = metadata.leadFields?._embedded?.custom_fields || [];

        result.contactFields.custom = contactFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom',
          code: field.code,
          field_type: field.type
        }));

        result.leadFields.custom = leadFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom',
          code: field.code,
          field_type: field.type
        }));
      } else if (metadata && targetCrm === 'lptracker') {
        // LPTracker кастомные поля
        const contactFields = metadata.contactFields?.result || [];
        const customFields = metadata.customFields?.result || [];

        result.contactFields.custom = contactFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom'
        }));

        result.leadFields.custom = customFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom'
        }));
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка получения доступных полей`, { 
        error: error.message,
        targetCrm
      }, 'smart_mapper');
    }

    return result;
  }

  private extractSourceValue(sourceField: string, sourceData: any): any {
    // Стандартные поля
    const standardFields: { [key: string]: (data: any) => any } = {
      'name': (data) => data.leadDetails?.name || data.contactsDetails?.[0]?.name || data.name || '',
      'first_name': (data) => data.contactsDetails?.[0]?.first_name || data.first_name || '',
      'last_name': (data) => data.contactsDetails?.[0]?.last_name || data.last_name || '',
      'phone': (data) => this.extractPhoneFromContact(data.contactsDetails?.[0]) || data.phone || '',
      'email': (data) => this.extractEmailFromContact(data.contactsDetails?.[0]) || data.email || '',
      'deal_name': (data) => data.leadDetails?.name || data.deal_name || '',
      'price': (data) => data.leadDetails?.price || data.price || 0
    };

    if (standardFields[sourceField]) {
      return standardFields[sourceField](sourceData);
    }

    // Кастомные поля AmoCRM
    if (/^\d+$/.test(sourceField)) {
      const fieldId = sourceField;
      
      // Поиск в лидах
      const leadCustomField = sourceData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == fieldId);
      if (leadCustomField) {
        return leadCustomField.values?.[0]?.value || '';
      }
      
      // Поиск в контактах
      const contactCustomField = sourceData.contactsDetails?.[0]?.custom_fields_values?.find((f: any) => f.field_id == fieldId);
      if (contactCustomField) {
        return contactCustomField.values?.[0]?.value || '';
      }
    }

    return '';
  }

  /**
   * Находит ID стандартного поля (phone, email) в метаданных CRM
   */
  private async findStandardFieldId(userId: string, targetCrm: 'amocrm' | 'lptracker', fieldType: 'phone' | 'email'): Promise<number | null> {
    if (targetCrm !== 'amocrm') return null;

    try {
      const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
      if (!metadata) return null;

      const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
      
      // Ищем поле по типу
      const standardField = contactFields.find((field: any) => {
        if (fieldType === 'phone') {
          return field.type === 'multitext' && field.code === 'PHONE';
        } else if (fieldType === 'email') {
          return field.type === 'multitext' && field.code === 'EMAIL';
        }
        return false;
      });

      if (standardField) {
        await this.logService.log(userId, 'info', `Smart Field Mapper - Найдено стандартное поле ${fieldType}`, { 
          fieldId: standardField.id,
          fieldName: standardField.name,
          fieldCode: standardField.code
        }, 'smart_mapper');
        return standardField.id;
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка поиска стандартного поля ${fieldType}`, { 
        error: error.message,
        targetCrm
      }, 'smart_mapper');
    }

    return null;
  }

  private extractPhoneFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const phoneField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'PHONE' || field.field_name === 'Телефон'
    );
    
    return phoneField?.values?.[0]?.value || '';
  }

  private extractEmailFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const emailField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'EMAIL' || field.field_name === 'Email'
    );
    
    return emailField?.values?.[0]?.value || '';
  }
}