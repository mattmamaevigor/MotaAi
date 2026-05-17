# MChat — Mistral Large Edition

Умный веб-чат на **Mistral Large** (один из топовых frontier-моделей) с полным набором фич. Этап 4+5 полностью.

## Фичи

### Этап 4 — Улучшение чата ✅
- **Редактирование сообщений** — кнопка ✏️, срезает историю и переотправляет
- **Ветки разговора** — регенерация создаёт новую ветку, переключай ← →, модал со всеми ветками
- **Цитирование** — 💬 Ответить, цитата в поле ввода и в сообщении, клик переходит на сообщение
- **Закрепление** — 📌 Закрепить, панель закреплённых в топбаре с подсветкой и scroll-to
- **Реакции** — пикер 8 эмодзи, счётчик под сообщением, повторный клик убирает
- **Поиск в чате (Ctrl+F)** — строка поиска, highlight совпадений, навигация ↑↓/Enter/Shift+Enter
- **Счётчик токенов** — ~3.8 символа/токен, жёлтый >20k, красный >30k
- **Автосохранение черновика** — localStorage debounce 500мс, восстановление при смене чата

### Этап 5 — Работа с контентом ✅
- **Веб-поиск (Tavily)** — флаг 🌐 Веб, показывает спиннер, ответ помечается бейджем
- **PDF/TXT файлы** — кнопка 📎, загружает документ, делает резюме
- **Голосовой ввод (STT)** — кнопка 🎤, браузерный Speech Recognition API, `ru-RU`
- **Озвучка** — убрана (только STT по твоему запросу)
- **Перевод** — флаг 🌍, выбор из 9 языков, backend меняет system prompt
- **Подсветка кода (Prism.js)** — автоматическое определение языка, темаone-dark
- **💡 Объяснить код** — кнопка в заголовке блока, отправляет "Объясни этот код"
- **▶ Запустить Python (Pyodide)** — кнопка в блоках Python, выполняет код в браузере
- **Статистика** — модал с 7 метриками и топ-5 чатов по длине

## Стек

| Часть | Технология |
|-------|-----------|
| **Frontend** | HTML5 + Vanilla JS (no framework) |
| **Backend** | Vercel Edge Runtime (Node.js) |
| **AI** | Mistral Large (mistral-large-latest / pixtral-large-latest для vision) |
| **Web Search** | Tavily API (optional) |
| **Code Highlight** | Prism.js |
| **Markdown** | Marked.js |
| **Python Runtime** | Pyodide (WASM) |
| **Storage** | localStorage (index versioning) |
| **PWA** | Service Worker + manifest.json |

## Деплой на Vercel

### 1. Подготовка

```bash
# Создай папку
mkdir mchat && cd mchat

# Скопируй файлы:
# - index.html → ./index.html (public folder)
# - manifest.json → ./public/manifest.json
# - sw.js → ./public/sw.js
# - chat.js → ./api/chat.js
```

### 2. Структура папок

```
mchat/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── sw.js
├── api/
│   └── chat.js
├── vercel.json
└── package.json
```

### 3. vercel.json

```json
{
  "buildCommand": "echo 'Static build'",
  "public": "public"
}
```

### 4. Переменные окружения (Vercel Dashboard)

Добавь в **Settings → Environment Variables**:

```
MISTRAL_API_KEY=your_mistral_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here (optional)
```

### 5. Deплой

```bash
npm install -g vercel
vercel deploy
```

Или просто push на GitHub и подключи Vercel (GitHub integration).

## Получение ключей

### Mistral API
1. https://console.mistral.ai
2. Регистрация → API Keys
3. Create API Key
4. Скопируй в `MISTRAL_API_KEY`

**Лимиты**: 2 RPM (free), ~1B токенов/месяц

### Tavily (опционально, веб-поиск)
1. https://tavily.com
2. Sign up → API Keys
3. Скопируй в `TAVILY_API_KEY`

**Лимиты**: free tier = 1000 запросов/месяц

## Локальный тест

```bash
# Serve static файлы
python3 -m http.server 8000

# Откройся http://localhost:8000
# API не будет работать (нужен backend)
```

## Архитектура данных

### Chat Object
```js
{
  id: "c{timestamp}",
  title: string,
  ts: timestamp,
  messages: [{
    id: "m{timestamp}",
    role: "user" | "assistant" | "system",
    content: string,
    ts: timestamp,
    imageBase64?: string,
    imageMime?: string,
    imageUrl?: string,
    quoteId?: string,        // цитируемое сообщение
    edited?: boolean,
    webSearch?: boolean,
    branches?: [{content: string}],  // регенерации
    // reactions[msgId]["me"] = [emoji1, emoji2, ...]
  }],
  pinned: [msgId],
  reactions: {[msgId]: {[userId]: [emoji]}}  // userId="me"
}
```

### localStorage ключи
- `mchat_ml_v1` — все чаты (JSON)
- `mchat_ml_set_v1` — сеттинги (persona, temperature, memory)
- `mchat_ml_draft_v1_{chatId}` — черновики

## API Endpoint

**POST /api/chat**

### Request
```js
{
  messages: [
    {role: "system", content: string},
    {role: "user", content: string, imageBase64?: string, imageMime?: string},
    {role: "assistant", content: string}
  ],
  temperature: 0.7,  // 0–1.5
  webSearch: false,  // включить Tavily
  translateTo: null  // "English", "Deutsch" и т.д.
}
```

### Response (SSE)
```
data: {"text": "chunk of response"}
data: {"text": " more text"}
...
data: [DONE]
```

## Стиль & Дизайн

- **Палетка**: Claude-inspired (коричневый accent #cc7722 вместо оранжевого)
- **Типография**: system-ui (ui-sans-serif, -apple-system, BlinkMacSystemFont)
- **Режимы**: только тёмная тема (--bg: #1a1a1a)
- **Отзывчивость**: мобильный сайдбар (fixed, overlay на <700px)

## Фичи по этапам

| Этап | Реализовано |
|------|------------|
| 1–3 | Базовый чат, personas, память, статистика |
| 4 | Редактирование, ветки, цитирование, закрепление, реакции, поиск, токены, черновик |
| 5 | Веб-поиск, PDF/TXT, STT, перевод, подсветка кода, объяснение, Python runner |

## Пути для развития

- **Этап 6**: Папки/теги, избранное ⭐, импорт/экспорт JSON, Markdown-экспорт
- **Этап 7**: Светлая/авто тема, размер шрифта, горячие клавиши Ctrl+K, звуки
- **Этап 8**: A/B сравнение, библиотека промптов, кастомные системные промпты

## Темпы & производительность

- **Загрузка**: ~200ms (static)
- **Первый AI ответ**: ~800ms–2s (Mistral Large, в зависимости от запроса)
- **SSE streaming**: живая подача текста в реал-тайме
- **localStorage**: мгновенное восстановление истории

## Ограничения & известные моменты

1. **Offline mode** — можно читать историю, но отправить нельзя (нужен API)
2. **Pyodide** — загружается только при клике на "Запустить" (lazy load), ~30MB
3. **Vision** — работает, но используется `pixtral-large-latest` (та же интеллектуальность)
4. **Токены** — оценка ~3.8 символа/токен (приблизительно для Mistral)
5. **File upload** — максимум одно изображение на сообщение; PDF/TXT обрабатываются как текст до 12k символов

## Поддержка браузеров

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile Safari 15+

PWA works: iOS (через "Add to Home Screen"), Android (через Chrome menu)

---

**Made with ❤️ on Mistral Large**
