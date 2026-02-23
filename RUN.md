# Запуск

PostgreSQL должен быть запущен. Настройки — в `server/.env` (DB_URI, PORT, JWT_SECRET, ROUND_DURATION, COOLDOWN_DURATION).

**Сборка (один раз):**
```bash
cd contract && npm install && npm run build && cd ..
cd server   && npm install && npm run build && cd ..
cd client   && npm install && cd ..
```

**Запуск:**
```bash
# Терминал 1
cd server && npm run start:dev

# Терминал 2
cd client && npm run dev
```

Открыть в браузере адрес из вывода Vite (обычно http://localhost:5173). API на порту 3000.

Тестовые пользователи после первого старта: **admin** / **admin**, **roma** / **roma**.
