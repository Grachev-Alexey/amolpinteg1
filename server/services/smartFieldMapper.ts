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
   * "Умное" маппинг полей с использованием метаданных CRM
   * Автоматически определяет, куда записывать поля (контакт, лид, кастомные поля)
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

    // Получаем метаданные целевой CRM
    const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
    
    await this.logService.log(userId, 'info', `Smart Field Mapper - Начинаем умное маппирование для ${targetCrm}`, { 
      fieldMappings,
      hasMetadata: !!metadata
    }, 'smart_mapper');

    // Обрабатываем каждое маппирование
    for (const [sourceField, targetFieldId] of Object.entries(fieldMappings)) {
      if (!sourceField || !targetFieldId) continue;

      // Получаем значение из исходных данных
      const sourceValue = this.extractSourceValue(sourceField, sourceData);
      if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
        continue;
      }

      // Определяем тип целевого поля и где его записать
      const fieldPlacement = await this.determineFieldPlacement(targetFieldId as string, targetCrm, metadata, userId);
      
      if (fieldPlacement) {
        switch (fieldPlacement.location) {
          case 'contact':
            if (targetCrm === 'lptracker') {
              result.contactFields[targetFieldId as string] = sourceValue;
            } else {
              // AmoCRM - записываем в массив custom_fields_values
              if (!result.contactFields.custom_fields_values) {
                result.contactFields.custom_fields_values = [];
              }
              result.contactFields.custom_fields_values.push({
                field_id: parseInt(targetFieldId as string),
                values: [{ value: sourceValue }]
              });
            }
            break;
          
          case 'lead':
            if (targetCrm === 'lptracker') {
              result.leadFields[targetFieldId as string] = sourceValue;
            } else {
              // AmoCRM - записываем в массив custom_fields_values
              if (!result.leadFields.custom_fields_values) {
                result.leadFields.custom_fields_values = [];
              }
              result.leadFields.custom_fields_values.push({
                field_id: parseInt(targetFieldId as string),
                values: [{ value: sourceValue }]
              });
            }
            break;
          
          case 'standard':
            // Стандартные поля (name, phone, email)
            if (fieldPlacement.standardField === 'name') {
              result.contactFields.name = sourceValue;
            } else if (fieldPlacement.standardField === 'phone') {
              if (targetCrm === 'lptracker') {
                result.contactFields.phone = sourceValue;
              } else {
                // AmoCRM phone в custom_fields_values
                if (!result.contactFields.custom_fields_values) {
                  result.contactFields.custom_fields_values = [];
                }
                result.contactFields.custom_fields_values.push({
                  field_id: 449213, // PHONE field ID в AmoCRM
                  values: [{ value: sourceValue, enum_code: 'WORK' }]
                });
              }
            } else if (fieldPlacement.standardField === 'email') {
              if (targetCrm === 'lptracker') {
                result.contactFields.email = sourceValue;
              } else {
                // AmoCRM email в custom_fields_values
                if (!result.contactFields.custom_fields_values) {
                  result.contactFields.custom_fields_values = [];
                }
                result.contactFields.custom_fields_values.push({
                  field_id: 449215, // EMAIL field ID в AmoCRM
                  values: [{ value: sourceValue, enum_code: 'WORK' }]
                });
              }
            }
            break;
        }

        await this.logService.log(userId, 'info', `Smart Field Mapper - Поле успешно замаппировано`, { 
          sourceField,
          targetFieldId,
          sourceValue,
          fieldPlacement,
          targetCrm
        }, 'smart_mapper');
      } else {
        await this.logService.log(userId, 'warning', `Smart Field Mapper - Не удалось определить размещение поля`, { 
          sourceField,
          targetFieldId,
          targetCrm
        }, 'smart_mapper');
      }
    }

    await this.logService.log(userId, 'info', `Smart Field Mapper - Результат умного маппирования`, { 
      contactFieldsCount: Object.keys(result.contactFields).length,
      leadFieldsCount: Object.keys(result.leadFields).length,
      customFieldsCount: Object.keys(result.customFields).length,
      result
    }, 'smart_mapper');

    return result;
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

  private async determineFieldPlacement(targetFieldId: string, targetCrm: 'amocrm' | 'lptracker', metadata: any, userId: string): Promise<{ location: 'contact' | 'lead' | 'standard', standardField?: string } | null> {
    // Обработка стандартных полей
    const standardFields = {
      'name': 'name',
      'phone': 'phone', 
      'email': 'email',
      'first_name': 'name',
      'last_name': 'name'
    };

    if (standardFields[targetFieldId]) {
      return { location: 'standard', standardField: standardFields[targetFieldId] };
    }

    if (!metadata) {
      // Если нет метаданных, пытаемся угадать по ID
      if (/^\d+$/.test(targetFieldId)) {
        const fieldIdNum = parseInt(targetFieldId);
        if (targetCrm === 'lptracker') {
          // LPTracker: поля контактов обычно в диапазоне 286000+, кастомные поля лидов 2785000+
          return fieldIdNum < 2000000 ? { location: 'contact' } : { location: 'lead' };
        } else {
          // AmoCRM: контакты 449000+, лиды 1136000+
          return fieldIdNum < 1000000 ? { location: 'contact' } : { location: 'lead' };
        }
      }
      return null;
    }

    if (targetCrm === 'amocrm') {
      // AmoCRM metadata проверка
      const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
      const leadFields = metadata.leadFields?._embedded?.custom_fields || [];

      const isContactField = contactFields.some((field: any) => field.id == targetFieldId);
      const isLeadField = leadFields.some((field: any) => field.id == targetFieldId);

      if (isContactField) return { location: 'contact' };
      if (isLeadField) return { location: 'lead' };
    } else {
      // LPTracker metadata проверка
      const contactFields = metadata.contactFields?.result || [];
      const customFields = metadata.customFields?.result || [];

      const isContactField = contactFields.some((field: any) => field.id == targetFieldId);
      const isCustomField = customFields.some((field: any) => field.id == targetFieldId);

      if (isContactField) return { location: 'contact' };
      if (isCustomField) return { location: 'lead' };
    }

    await this.logService.log(userId, 'warning', `Smart Field Mapper - Поле не найдено в метаданных`, { 
      targetFieldId,
      targetCrm,
      metadataKeys: metadata ? Object.keys(metadata) : []
    }, 'smart_mapper');

    return null;
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