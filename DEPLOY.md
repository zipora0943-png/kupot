# הפעלה לשרת — 178.105.96.70

מדריך זה מתאר איך להריץ את המערכת על שרת לינוקס (Ubuntu/Debian) עם:

| שירות           | פורט |
|------------------|-----:|
| Backend (API)    | 3000 |
| Frontend אדמין   | 5000 |
| Frontend גובה    | 5001 |

הפרונטים נבנים עם Vite, מוגשים ע"י `vite preview`, ופונים ישירות ל-`http://178.105.96.70:3000/api` (מוגדר ב-`.env.production` של כל פרונט).

ניהול תהליכים: **pm2** דרך `ecosystem.config.js` בשורש הפרויקט.

---

## דרישות מקדימות בשרת

```bash
# Node.js 20 (או 18+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 14+
sudo apt-get install -y postgresql postgresql-contrib

# pm2 גלובלי
sudo npm install -g pm2

# git (אם עוד לא מותקן)
sudo apt-get install -y git
```

---

## שלב 1 — יצירת מסד הנתונים

```bash
sudo -u postgres psql <<SQL
CREATE USER kupot WITH PASSWORD 'CHANGE_ME_DB_PASSWORD';
CREATE DATABASE kupot_db OWNER kupot;
GRANT ALL PRIVILEGES ON DATABASE kupot_db TO kupot;
SQL
```

> אם תשנה את הסיסמה — עדכן גם ב-`backend/.env` בשלב הבא.

---

## שלב 2 — שכפול הקוד

```bash
cd /opt
sudo git clone <REPO_URL> kupot
sudo chown -R $USER:$USER /opt/kupot
cd /opt/kupot
```

או אם מעלים בדרך אחרת (rsync/scp), צריך לוודא שכל המבנה הזה קיים:
```
/opt/kupot/
├── backend/
├── frontend-admin/
├── frontend-collector/
└── ecosystem.config.js
```

---

## שלב 3 — הגדרת ה-Backend

```bash
cd /opt/kupot/backend
cp .env.production.example .env
nano .env        # עדכן: DB_PASSWORD, JWT_SECRET (חובה ערך אקראי חזק), DEMO_PASSWORD
```

ייצור `JWT_SECRET` חזק:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

התקנה + טעינת סכמה + נתוני דמו:
```bash
npm ci --omit=dev
npm run db:init
npm run db:seed     # אופציונלי — טוען משתמשי דמו
```

---

## שלב 4 — Build של ה-Frontends

```bash
# Admin
cd /opt/kupot/frontend-admin
npm ci
npm run build

# Collector
cd /opt/kupot/frontend-collector
npm ci
npm run build
```

> ה-build משתמש ב-`.env.production` ש-Vite טוען אוטומטית. אם השרת לא יושב על `178.105.96.70` בעתיד — רק לשנות שם את `VITE_API_BASE` ולעשות `npm run build` מחדש.

---

## שלב 5 — חומת אש

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 5001/tcp
sudo ufw reload
```

---

## שלב 6 — הרצה דרך pm2

```bash
cd /opt/kupot
pm2 start ecosystem.config.js
pm2 save
pm2 startup       # להריץ את הפקודה ש-pm2 יציע (כדי שיופעל אחרי reboot)
```

בדיקה:
```bash
pm2 status
pm2 logs kupot-backend --lines 50
curl -s http://localhost:3000/health     # אמור להחזיר {"ok":true}
```

מהרשת:
- אדמין: <http://178.105.96.70:5000>
- גובה: <http://178.105.96.70:5001>
- API: <http://178.105.96.70:3000/health>

---

## עדכון קוד אחרי שינויים

```bash
cd /opt/kupot
git pull
cd backend && npm ci --omit=dev
cd ../frontend-admin && npm ci && npm run build
cd ../frontend-collector && npm ci && npm run build
cd ..
pm2 reload ecosystem.config.js
```

---

## איתור תקלות

| בעיה                                                | פתרון                                                                 |
|-----------------------------------------------------|-----------------------------------------------------------------------|
| הפרונט עולה אבל קריאות API נכשלות (CORS / 404)      | ודא ש-`backend/.env` מכיל `CORS_ORIGIN=http://178.105.96.70:5000,http://178.105.96.70:5001` ושעשית `pm2 reload kupot-backend` |
| תמונות לא נטענות (`/uploads/...` נכשל)              | בנית את הפרונט אחרי שינוי? `npm run build` לכל פרונט משתמש ב-`assetUrl()` שמייצר URL מוחלט מול הבק |
| התחברות נכשלת אחרי restart של הבק                   | השרת עדיין יחכה ל-DB. בדוק `pm2 logs kupot-backend` ו-`systemctl status postgresql` |
| `vite preview` נופל עם "port already in use"        | `lsof -i :5000` או `:5001` — הרוג את התהליך הקודם או `pm2 delete` |
| 401 על כל קריאה אחרי build חדש                      | ה-token ב-localStorage עדיין תקף לפי ה-`JWT_SECRET` הישן. נקה את ה-storage בדפדפן |

---

## הערות אבטחה (חובה לפני שימוש אמיתי)

- [ ] `JWT_SECRET` מוחלף לערך אקראי חזק (32+ תווים).
- [ ] מחק או החלף סיסמת משתמשי הדמו (`DEMO_PASSWORD`).
- [ ] `CORS_ORIGIN` מוגדר רק לדומיינים/IP שלנו (לא `*`).
- [ ] גיבוי תקופתי של ה-DB (`pg_dump`).
- [ ] שקול לעטוף הכל ב-nginx + HTTPS (Let's Encrypt) במקום לחשוף 3 פורטים ישירות.
