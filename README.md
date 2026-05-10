# פרויקט קופות

מערכת ניהול קופות צדקה — קופות פזורות בערים, גובים מרוקנים ומדווחים, חדר כסף מזין סכומים.

## מבנה

```
kupot-project/
├── backend/                 Node.js + Express + PostgreSQL
├── frontend-admin/          Vite + React 18 — ממשק מנהל ו-cashroom
├── frontend-collector/      Vite + React 19 + Capacitor — אפליקציית גובה
├── ecosystem.config.js      pm2 — הרצת 3 השירותים יחד
├── kupot_wireframe_v10.html ויירפריים מאושר ל-UI
├── CLAUDE.md                ארכיטקטורה, schema, routes, לוגיקה עסקית, אבטחה
├── DEPLOY.md                הוראות הפעלה לשרת
└── TASKS.md / TASKS_COLLECTOR.md   רשימות משימות
```

## הפעלה מהירה — פיתוח מקומי

### Backend
```bash
cd backend
cp .env.example .env       # ערוך לפי הצורך
npm install
psql -U postgres -c "CREATE DATABASE kupot_db;"
npm run db:init            # סכמה
npm run db:seed            # נתוני דמו (משתמשים: admin / collector1-5 / cashroom — סיסמה password123)
npm run dev                # nodemon על port 3000
```

### Frontends
```bash
cd frontend-admin && npm install && npm run dev      # http://localhost:5173
cd frontend-collector && npm install && npm run dev  # http://localhost:5174
```
שני הפרונטים מוגדרים עם proxy ל-`http://localhost:3000` בפיתוח.

## הפעלה לפרודקשן

ראה [`DEPLOY.md`](DEPLOY.md).

## תיעוד נוסף

- [`CLAUDE.md`](CLAUDE.md) — הרחבה על ארכיטקטורה, schema, routes, לוגיקה עסקית, בדיקות, אבטחה.
- [`kupot_wireframe_v10.html`](kupot_wireframe_v10.html) — ה-UI המאושר. כל שינוי ויזואלי חייב להתאים לוויירפריים.
