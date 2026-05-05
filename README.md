# פרויקט קופות

מערכת ניהול קופות צדקה — קופות פזורות בערים, גובים מרוקנים ומדווחים, חדר כסף מזין סכומים.

## מבנה

```
kupot-project/
├── backend/                  Node.js + Express + PostgreSQL
├── kupot_wireframe_v10.html  ויירפריים מאושר ל-UI
├── CONTEXT.md                הקשר עסקי, ארכיטקטורה, לוגיקה קריטית
└── PROMPT_STAGE1.md          הפרומפט המקורי לבניית שלב 1
```

עתידיים:
- `frontend-admin/` — ממשק מנהל (Web)
- `frontend-cashroom/` — ממשק חדר כסף (Web)
- `mobile/` — אפליקציית גובה (React Native, Android)

## שלבי פיתוח

| שלב | תיאור | סטטוס |
|---|---|---|
| 1 | Backend + DB + APIs + Tests | ✅ הושלם |
| 2 | ממשק מנהל — Web | ⏳ בתכנון |
| 3 | ממשק חדר כסף — Web | ⏳ ממתין |
| 4 | ממשק גובה — React Native | ⏳ ממתין |
| 5 | פיצ'רים משלימים, הקשחת אבטחה | ⏳ ממתין |

## הוראות הפעלה — Backend

ראה [`backend/README.md`](backend/README.md).

## תיעוד נוסף

- [`CONTEXT.md`](CONTEXT.md) — לוגיקה עסקית, מודל נתונים, זרימות עיקריות.
- [`kupot_wireframe_v10.html`](kupot_wireframe_v10.html) — ה-UI המאושר.
