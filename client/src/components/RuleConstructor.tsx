import { useState } from "react";
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
    description: "",
    conditions: { operator: "AND", rules: [] },
    actions: { list: [] },
    isActive: true
  });

  const conditionTypes = [
    { value: "event_type", label: "Тип события" },
    { value: "field_equals", label: "Поле равно" },
    { value: "field_contains", label: "Поле содержит" },
    { value: "status_changed", label: "Изменение статуса" },
    { value: "pipeline_changed", label: "Изменение воронки" },
  ];

  const actionTypes = [
    { value: "create_amocrm_lead", label: "Создать сделку в AmoCRM" },
    { value: "update_amocrm_lead", label: "Обновить сделку в AmoCRM" },
    { value: "create_amocrm_contact", label: "Создать контакт в AmoCRM" },
    { value: "send_to_lptracker", label: "Отправить в LPTracker" },
    { value: "update_lptracker_lead", label: "Обновить лид в LPTracker" },
    { value: "create_task", label: "Создать задачу" },
  ];

  const eventTypes = [
    { value: "lead_created", label: "Создана сделка" },
    { value: "lead_status_changed", label: "Изменен статус сделки" },
    { value: "contact_created", label: "Создан контакт" },
    { value: "contact_updated", label: "Обновлен контакт" },
    { value: "call_completed", label: "Завершен звонок" },
  ];

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
      data: {}
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
            <Label htmlFor="ruleDescription">Описание</Label>
            <Textarea
              id="ruleDescription"
              value={rule.description}
              onChange={(e) => setRule({ ...rule, description: e.target.value })}
              placeholder="Опишите что делает это правило..."
              rows={2}
            />
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
                  
                  {condition.type === "event_type" && (
                    <Select
                      value={condition.value}
                      onValueChange={(value) => updateCondition(condition.id, "value", value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Тип события" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((event) => (
                          <SelectItem key={event.value} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {(condition.type === "field_equals" || condition.type === "field_contains") && (
                    <>
                      <Input
                        placeholder="Поле"
                        value={condition.field}
                        onChange={(e) => updateCondition(condition.id, "field", e.target.value)}
                        className="w-32"
                      />
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
            <div className="space-y-3">
              {rule.actions.list.map((action: any, index: number) => (
                <div key={action.id} className="flex items-center space-x-2 p-3 bg-card rounded-lg border">
                  <span className="text-sm font-medium text-muted-foreground min-w-[2rem]">
                    {index + 1}.
                  </span>
                  <Select
                    value={action.type}
                    onValueChange={(value) => updateAction(action.id, "type", value)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Тип действия" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(action.id)}
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
