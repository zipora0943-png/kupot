# Kupot Backend

Node.js + Express + PostgreSQL API for the charity-box management system.

## דרישות
- Node.js 18+
- PostgreSQL 14+

## התקנה

```bash
cd backend
cp .env.example .env
# ערוך .env: DB_PASSWORD, JWT_SECRET (מחרוזת אקראית ארוכה)

npm install

# צור database ריק
psql -U postgres -c "CREATE DATABASE kupot_db;"

# טעינת סכמה + נתוני דמו
npm run db:init
npm run db:seed

# הפעלה
npm start         # production
npm run dev       # פיתוח עם nodemon
```

ברירת מחדל: השרת רץ על http://localhost:3000.

## משתמשים לדמו

לאחר `npm run db:seed`, הסיסמה לכל המשתמשים היא `password123` (מוגדרת ב-`DEMO_PASSWORD` ב-`.env`).

| Username | Role |
|---|---|
| `admin` | admin |
| `collector1`–`collector5` | collector |
| `cashroom` | cashroom |

## בדיקות

```bash
npm test                            # יחידה (אין צורך ב-DB)
RUN_DB_TESTS=true npm test          # יחידה + אינטגרציה (דורש DB)
```

## מבנה

```
backend/
├── src/
│   ├── index.js                    כניסה לאפליקציה
│   ├── db/                         pool, schema, seed
│   ├── logic/                      cardLogic, userAssignment
│   ├── middleware/                 auth, roles, upload
│   ├── routes/                     11 קבצי REST
│   └── utils/                      csv
├── scripts/                        runSql.js, seedUsers.js
├── tests/
│   ├── unit/                       בדיקות ללא DB
│   └── integration/                בדיקות עם DB (RUN_DB_TESTS=true)
└── uploads/                        תמונות שהועלו (runtime)
```

## API — כללי

- כל בקשה (חוץ מ-`POST /api/auth/login`) דורשת header:
  `Authorization: Bearer <jwt-token>`
- תפקידים: `admin`, `collector`, `cashroom`.
- כל ה-endpoints מתחת ל-`/api/`.

ראה [CONTEXT.md](../CONTEXT.md) ללוגיקה עסקית מפורטת.

## הקשחת אבטחה לקראת ייצור

- [ ] להחליף `JWT_SECRET` למחרוזת אקראית ארוכה
- [ ] להגדיר `NODE_ENV=production`
- [ ] להגביל `CORS_ORIGIN` ל-domain ספציפי
- [ ] להחליף או למחוק משתמשי הדמו
- [ ] להוסיף HTTPS (proxy / load balancer)
- [ ] לחבר logging חיצוני (Sentry / Datadog)
