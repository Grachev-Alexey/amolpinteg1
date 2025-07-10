import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Save, Play, Trash2 } from "lucide-react";

interface RuleConstructorProps {
  onSave?: (rule: any) => void;
  onTest?: (rule: any) => void;
  initialRule?: any;
  isEditing?: boolean;
}

export default function RuleConstructor({ 
  onSave, 
  onTest, 
  initialRule,
  isEditing = false 
}: RuleConstructorProps) {
  const [rule, setRule] = useState(initialRule || {
    name: "",
    webhookSource: "",
    conditions: { operator: "AND", rules: [] },
    actions: { list: [] },
    isActive: true
  });

  const webhookSources = [
    { value: "amocrm", label: "AmoCRM" },
    { value: "lptracker", label: "LPTracker" },
  ];

  // Define condition types based on webhook source
  const getConditionTypes = () => {
    if (rule.webhookSource === 'amocrm') {
      return [
        { value: "pipeline", label: "Воронка" },
        { value: "status", label: "Статус" },
        { value: "field_equals", label: "Поле равно" },
        { value: "field_contains", label: "Поле содержит" },
        { value: "field_not_empty", label: "Поле заполнено" },
      ];
    } else if (rule.webhookSource === 'lptracker') {
      return [
        { value: "status", label: "Статус лида" },
        { value: "field_equals", label: "Поле равно" },
        { value: "field_contains", label: "Поле содержит" },
        { value: "field_not_empty", label: "Поле заполнено" },
      ];
    }
    return [];
  };

  const conditionTypes = getConditionTypes();

  const actionTypes = [
    { value: "sync_to_amocrm", label: "Синхронизировать с AmoCRM" },
    { value: "sync_to_lptracker", label: "Синхронизировать с LPTracker" },
  ];

  // Load AmoCRM metadata
  const { data: pipelinesData } = useQuery({
    queryKey: ['/api/amocrm/metadata/pipelines'],
    retry: false,
  });

  const { data: leadsFieldsData } = useQuery({
    queryKey: ['/api/amocrm/metadata/leads_fields'],
    retry: false,
  });

  const { data: contactsFieldsData } = useQuery({
    queryKey: ['/api/amocrm/metadata/contacts_fields'],
    retry: false,
  });

  // Load LPTracker metadata
  const { data: lpTrackerContactFieldsData } = useQuery({
    queryKey: ['/api/lptracker/metadata/contact_fields'],
    retry: false,
  });

  const { data: lpTrackerCustomFieldsData } = useQuery({
    queryKey: ['/api/lptracker/metadata/custom_fields'],
    retry: false,
  });

  const { data: lpTrackerFunnelData } = useQuery({
    queryKey: ['/api/lptracker/metadata/funnel'],
    retry: false,
  });

  // Extract pipelines and statuses from metadata
  const pipelines = pipelinesData?.data?._embedded?.pipelines || [];
  const allStatuses = pipelines.flatMap((pipeline: any) => 
    pipeline._embedded?.statuses?.map((status: any) => ({
      ...status,
      pipelineName: pipeline.name,
      pipelineId: pipeline.id
    })) || []
  );

  // Extract custom fields
  const leadsFields = leadsFieldsData?.data?._embedded?.custom_fields || [];
  const contactsFields = contactsFieldsData?.data?._embedded?.custom_fields || [];
  
  // Extract LPTracker metadata
  const lpTrackerContactFields = lpTrackerContactFieldsData?.data?.result || [];
  const lpTrackerCustomFields = lpTrackerCustomFieldsData?.data?.result || [];
  const lpTrackerFunnelSteps = lpTrackerFunnelData?.data?.result || [];

  // Define fields based on webhook source
  const getAvailableFields = () => {
    if (rule.webhookSource === 'amocrm') {
      return {
        pipelines,
        statuses: allStatuses,
        fields: [...leadsFields, ...contactsFields]
      };
    } else if (rule.webhookSource === 'lptracker') {
      // Combine contact fields and custom fields for LPTracker
      const allLpTrackerFields = [
        // Standard contact fields
        { id: 'name', name: 'Имя' },
        { id: 'phone', name: 'Телефон' },
        { id: 'email', name: 'Email' },
        // Contact fields from LPTracker
        ...lpTrackerContactFields.map((field: any) => ({ 
          id: field.id, 
          name: field.name,
          type: field.type 
        })),
        // Custom fields from LPTracker
        ...lpTrackerCustomFields.map((field: any) => ({ 
          id: field.id, 
          name: field.name,
          type: field.type 
        }))
      ];

      return {
        pipelines: [], // LPTracker doesn't have pipelines, only funnel steps
        statuses: lpTrackerFunnelSteps.map((step: any) => ({
          id: step.id,
          name: step.name
        })),
        fields: allLpTrackerFields
      };
    }
    return { pipelines: [], statuses: [], fields: [] };
  };

  const availableData = getAvailableFields();

  const addCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      type: "",
      field: "",
      operator: "equals",
      value: ""
    };
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        rules: [...rule.conditions.rules, newCondition]
      }
    });
  };

  const removeCondition = (id: string) => {
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        rules: rule.conditions.rules.filter((r: any) => r.id !== id)
      }
    });
  };

  const updateCondition = (id: string, field: string, value: any) => {
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        rules: rule.conditions.rules.map((r: any) => 
          r.id === id ? { ...r, [field]: value } : r
        )
      }
    });
  };

  const addAction = () => {
    const newAction = {
      id: Date.now().toString(),
      type: "",
      searchBy: "phone", // default search field
      fields: {}, // fields to sync
      createIfNotFound: true
    };
    setRule({
      ...rule,
      actions: {
        ...rule.actions,
        list: [...rule.actions.list, newAction]
      }
    });
  };

  const removeAction = (id: string) => {
    setRule({
      ...rule,
      actions: {
        ...rule.actions,
        list: rule.actions.list.filter((a: any) => a.id !== id)
      }
    });
  };

  const updateAction = (id: string, field: string, value: any) => {
    setRule({
      ...rule,
      actions: {
        ...rule.actions,
        list: rule.actions.list.map((a: any) => 
          a.id === id ? { ...a, [field]: value } : a
        )
      }
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave(rule);
    }
  };

  const handleTest = () => {
    if (onTest) {
      onTest(rule);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{isEditing ? "Редактирование правила" : "Создание нового правила"}</span>
          <Badge variant={rule.isActive ? "default" : "secondary"}>
            {rule.isActive ? "Активно" : "Неактивно"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="ruleName">Название правила</Label>
            <Input
              id="ruleName"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              placeholder="Например: Обработка горячих лидов"
            />
          </div>

          <div>
            <Label htmlFor="webhookSource">Источник webhook</Label>
            <Select
              value={rule.webhookSource}
              onValueChange={(value) => setRule({ ...rule, webhookSource: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите источник" />
              </SelectTrigger>
              <SelectContent>
                {webhookSources.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Conditions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">ЕСЛИ (условия)</h3>
            <Button onClick={addCondition} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить условие
            </Button>
          </div>
          
          {rule.conditions.rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет условий. Добавьте первое условие.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rule.conditions.rules.map((condition: any, index: number) => (
                <div key={condition.id} className="flex items-center space-x-2 p-3 bg-card rounded-lg border">
                  {index > 0 && (
                    <Badge variant="outline" className="mr-2">
                      {rule.conditions.operator}
                    </Badge>
                  )}
                  <Select
                    value={condition.type}
                    onValueChange={(value) => updateCondition(condition.id, "type", value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Тип условия" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {condition.type === "pipeline" && rule.webhookSource === 'amocrm' && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">равно</span>
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(condition.id, "value", value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Выберите воронку" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableData.pipelines?.map((pipeline: any) => (
                            <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                              {pipeline.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}


                  
                  {condition.type === "status" && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">равно</span>
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(condition.id, "value", value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableData.statuses?.map((status: any) => (
                            <SelectItem key={status.id} value={status.id.toString()}>
                              {rule.webhookSource === 'amocrm' 
                                ? `${status.pipelineName}: ${status.name}`
                                : status.name
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {condition.type === "field_not_empty" && (
                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(condition.id, "field", value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Выберите поле" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableData.fields?.map((field: any) => (
                          <SelectItem key={field.id} value={field.id.toString()}>
                            {rule.webhookSource === 'amocrm' ? '📋' : '🎯'} {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {(condition.type === "field_equals" || condition.type === "field_contains") && (
                    <>
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(condition.id, "field", value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Выберите поле" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableData.fields?.map((field: any) => (
                            <SelectItem key={field.id} value={field.id.toString()}>
                              {rule.webhookSource === 'amocrm' ? '📋' : '🎯'} {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm">
                        {condition.type === "field_equals" ? "равно" : "содержит"}
                      </span>
                      <Input
                        placeholder="Значение"
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                        className="w-32"
                      />
                    </>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">ТО (действия)</h3>
            <Button onClick={addAction} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить действие
            </Button>
          </div>
          
          {rule.actions.list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет действий. Добавьте первое действие.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rule.actions.list.map((action: any, index: number) => (
                <div key={action.id} className="p-4 bg-card rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Действие {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(action.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Тип действия</Label>
                      <Select
                        value={action.type}
                        onValueChange={(value) => updateAction(action.id, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите действие" />
                        </SelectTrigger>
                        <SelectContent>
                          {actionTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {action.type && (
                      <div>
                        <Label className="text-sm font-medium">Поиск по полю</Label>
                        <Select
                          value={action.searchBy}
                          onValueChange={(value) => updateAction(action.id, "searchBy", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите поле" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone">Телефон</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="name">Имя</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  {action.type && (
                    <div className="space-y-4">
                      <Label className="text-sm font-medium">Настройки синхронизации полей</Label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Источник данных</Label>
                          <div className="text-sm bg-muted p-2 rounded">Webhook {rule.webhookSource}</div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Назначение</Label>
                          <div className="text-sm bg-muted p-2 rounded">
                            {action.type === 'sync_to_amocrm' ? 'AmoCRM' : 'LPTracker'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Маппинг полей</Label>
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
                            <div>Поле источника</div>
                            <div>→</div>
                            <div>Поле назначения</div>
                          </div>
                          
                          {/* Основные поля */}
                          <div className="grid grid-cols-3 gap-2 items-center py-1">
                            <div className="text-sm">name</div>
                            <div className="text-center">→</div>
                            <div className="text-sm">{action.type === 'sync_to_amocrm' ? 'Имя контакта' : 'Имя лида'}</div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 items-center py-1">
                            <div className="text-sm">phone</div>
                            <div className="text-center">→</div>
                            <div className="text-sm">Телефон</div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 items-center py-1">
                            <div className="text-sm">email</div>
                            <div className="text-center">→</div>
                            <div className="text-sm">Email</div>
                          </div>

                          {action.type === 'sync_to_amocrm' && (
                            <div className="grid grid-cols-3 gap-2 items-center py-1">
                              <div className="text-sm">deal_name</div>
                              <div className="text-center">→</div>
                              <div className="text-sm">Название сделки</div>
                            </div>
                          )}

                          {action.type === 'sync_to_amocrm' && (
                            <div className="grid grid-cols-3 gap-2 items-center py-1">
                              <div className="text-sm">price</div>
                              <div className="text-center">→</div>
                              <div className="text-sm">Бюджет сделки</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <div className="text-sm text-muted-foreground">
                          <strong>Логика работы:</strong>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          1. Система ищет существующий контакт по выбранному полю ({action.searchBy})
                        </div>
                        <div className="text-sm text-muted-foreground">
                          2. Если контакт найден - обновляет данные
                        </div>
                        <div className="text-sm text-muted-foreground">
                          3. Если не найден - создает новый контакт
                        </div>
                        {action.type === 'sync_to_amocrm' && (
                          <div className="text-sm text-muted-foreground">
                            4. Для AmoCRM дополнительно создает или обновляет связанную сделку
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center space-x-4">
          <Button onClick={handleSave} className="gradient-primary hover:opacity-90">
            <Save className="w-4 h-4 mr-2" />
            Сохранить правило
          </Button>
          <Button onClick={handleTest} variant="outline">
            <Play className="w-4 h-4 mr-2" />
            Тестировать
          </Button>
          {isEditing && (
            <Button variant="destructive" className="ml-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить правило
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
