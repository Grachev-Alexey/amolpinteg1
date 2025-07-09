import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, BarChart3, Settings, Webhook, FileText } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/95 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">CRM Интегратор</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => window.location.href = '/auth'}
                variant="outline"
              >
                Войти
              </Button>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="gradient-primary hover:opacity-90"
              >
                Регистрация
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            Интеграция CRM систем
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Автоматизируйте интеграцию между AmoCRM и LPTracker
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Создавайте сложные правила синхронизации, обрабатывайте данные и автоматизируйте рабочие процессы между системами.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/auth'}
              className="gradient-primary hover:opacity-90"
            >
              Начать работу
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline">
              Узнать больше
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold mb-4">Возможности системы</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Полный набор инструментов для создания и управления интеграциями между CRM системами
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="hover-lift transition-all">
            <CardHeader>
              <Settings className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Конструктор правил</CardTitle>
              <CardDescription>
                Создавайте сложные правила синхронизации с помощью интуитивного интерфейса
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Условная логика "ЕСЛИ-ТО"</li>
                <li>• Маппинг полей между системами</li>
                <li>• Множественные условия и действия</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-lift transition-all">
            <CardHeader>
              <Webhook className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Webhook интеграция</CardTitle>
              <CardDescription>
                Мгновенная реакция на события в AmoCRM и LPTracker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Обработка событий в реальном времени</li>
                <li>• Автоматическое выполнение правил</li>
                <li>• Надежная доставка данных</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-lift transition-all">
            <CardHeader>
              <FileText className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Загрузка файлов</CardTitle>
              <CardDescription>
                Массовая обработка контактов и данных прозвонов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Поддержка XLSX и CSV файлов</li>
                <li>• Фоновая обработка больших файлов</li>
                <li>• Отслеживание прогресса загрузки</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-lift transition-all">
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Аналитика и отчеты</CardTitle>
              <CardDescription>
                Подробная статистика работы интеграций
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Мониторинг выполнения правил</li>
                <li>• Статистика успешных операций</li>
                <li>• Детальные логи всех действий</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-lift transition-all">
            <CardHeader>
              <Shield className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>
                Защищенное хранение данных и API ключей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Шифрование API ключей</li>
                <li>• Безопасная аутентификация</li>
                <li>• Изолированные пользовательские данные</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-lift transition-all">
            <CardHeader>
              <Zap className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Высокая производительность</CardTitle>
              <CardDescription>
                Быстрая обработка данных и надежная синхронизация
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Асинхронная обработка</li>
                <li>• Кэширование метаданных</li>
                <li>• Оптимизированные API запросы</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="glass-effect border-primary/20">
          <CardContent className="text-center py-12">
            <h3 className="text-3xl font-bold mb-4">
              Готовы начать автоматизацию?
            </h3>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Присоединяйтесь к системе и создайте свою первую интеграцию между AmoCRM и LPTracker уже сегодня
            </p>
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/auth'}
              className="gradient-primary hover:opacity-90"
            >
              Войти в систему
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 CRM Интегратор. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}
