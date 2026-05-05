# פרומפט שלב 1 — העתק והדבק ל-Claude Code

---

קרא את הקובץ `CONTEXT.md` ואת הוויירפריים `kupot_wireframe_v10.html` שבתיקייה.

אנחנו בשלב 1 — בניית הבאקאנד המלא.

**בנה את הדברים הבאים לפי הסדר:**

## 1. מבנה תיקיות
```
backend/
├── src/
│   ├── db/
│   │   ├── schema.sql
│   │   └── seed.sql
│   ├── routes/
│   ├── middleware/
│   ├── logic/        ← לוגיקה עסקית קריטית כאן
│   └── index.js
├── tests/
├── .env.example
└── package.json
```

## 2. Schema — PostgreSQL
בנה את כל הטבלאות לפי CONTEXT.md. שים לב במיוחד ל:
- `cards` — כולל שדות: custom_name, receipt_required, receipt_details, alert_days_personal
- `task_types` — כולל: opens_card (boolean), closes_card (boolean)
- `users` — שדות area_assignments ו-area_exclusions כ-JSONB

## 3. Seed Data
- 3 ערים: בני ברק, ירושלים, אשדוד
- 3 סוגי קופות: גדולה, רגילה, קטנה
- סוגי משימות ברירת מחדל עם לוגיקה נכונה:
  - התקנה: opens_card=true, closes_card=false
  - הסרה: opens_card=false, closes_card=true
  - העברת מיקום: opens_card=true, closes_card=true
  - החלפת מנעול / תיקון / צביעה / שיפוץ: שניהם false
- 5 גובים, 20 קופות, כרטסות, מעטפות לדוגמה

## 4. APIs
כל הנתיבים עם JWT middleware:

**auth:** POST /login, GET /me

**boxes:** GET / (פילטר סטטוס), POST /, PUT /:id, PATCH /:id/status

**cards:** GET / (פילטרים: עיר/שכונה/גובה/סטטוס/שם מותאם/דרוש קבלה), GET /:id, POST /, PUT /:id, GET /:id/history

**envelopes:** GET / (פילטרים מלאים), GET /pending, POST /, PUT /:id

**events:** GET /by-card/:cardId, POST /

**tasks:** GET / (פילטרים), POST /, PUT /:id, POST /:id/complete (← מפעיל לוגיקת כרטסת)

**reports:** GET /, POST /, PUT /:id, POST /:id/convert-to-task

**users:** GET /, POST /, PUT /:id, DELETE /:id

**alerts:** GET /no-collection (כרטסות שלא רוקנו מעל הסף)

**reports-export:** GET /summary, GET /per-box, GET /compare → מחזיר JSON (יצוא לאקסל בצד הלקוח)

**settings:** GET /, PUT /

## 5. לוגיקה עסקית — קריטי
קובץ `src/logic/cardLogic.js`:
- `getActiveCard(boxId)` — מחזיר כרטסת פעילה של קופה
- `openCard(boxId, location, userId)` — פותח כרטסת חדשה + יוצר אירוע
- `closeCard(cardId, reason, userId)` — סוגר כרטסת + יוצר אירוע
- `completeTask(taskId, executionData)` — מאשר ביצוע + מפעיל לוגיקת כרטסת לפי task_type

קובץ `src/logic/userAssignment.js`:
- `getBoxesForCollector(userId)` — מחזיר קופות לפי שיוך היררכי + החרגות

## 6. Tests
כתוב tests ל:
- `cardLogic` — התקנה, הסרה, העברת מיקום
- `userAssignment` — שיוך לפי עיר עם החרגת שכונה
- alerts — חישוב ימים נכון (אישי מול גלובלי)

---

**Effort: High**
**Model: Opus**
