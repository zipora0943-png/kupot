# TASKS_COLLECTOR.md — אפליקציית גובים (frontend-collector)

## רקע

פרויקט אחות ל-`frontend-admin` הקיים — אפליקציית מובייל ייעודית לגובים בשטח.
התיקייה: `e:\kupot-project\kupot-project\frontend-collector\`
מקומפלת ל-APK להתקנה ידנית (לא דרך חנות) באמצעות Capacitor.
האפליקציה עובדת גם בדפדפן רגיל.

## החלטות ארכיטקטוניות

| נושא | החלטה |
|------|--------|
| סטאק | Vite + React + Capacitor |
| תיקייה | `frontend-collector` |
| סורק ברקוד | `@zxing/browser` |
| ערך הברקוד | זהה ל-`envelope_number` במסד |
| ניווט תחתון | 3 טאבים: קופות / גביה / משימות+התראות |
| "בצע גביה" | פותח מצלמה ישירות |
| "צור דיווח" | טופס מלא כמו `ManualReportModal` |
| מהתראה | → תצוגת גביה של הקופה |
| ממשימה | → תצוגת משימה (view) + כפתור נפרד לביצוע |
| Logout | לחיצה על 👤 בכותרת |
| יצירת משתמשים | רק ב-frontend-admin |

## מקורות לשימוש חוזר מ-frontend-admin

- `src/api/client.js` — HTTP wrapper + JWT
- `src/api/endpoints.js`
- `src/context/AuthContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/index.css` — design tokens
- `src/components/ManualReportModal.jsx` — תבנית טופס דיווח
- `src/pages/LoginPage.jsx` — תבנית login
- `src/utils/cardLabel.js`

---

## הוראות עבודה לסוכן

לכל משימה:
1. שנה סטטוס ל-🔄 **בביצוע**
2. בצע
3. אמת לפי קריטריון האימות
4. שנה סטטוס ל-✅ **בוצע**
5. עבור למשימה הבאה ברצף

- בצע את כל משימות השלב הנוכחי ברצף, ללא אישור בין משימות.
- בסוף השלב — עצור והודע שהשלב הסתיים.
- אם משימה נכשלה — סמן ❌ עם הסבר ועצור (אל תמשיך הלאה).
- אל תקרא קבצים שלא נדרשים במפורש במשימה.
- אל תסכם או תסביר ביניים — רק בצע ועדכן סטטוס.

---

## ⏳ משימות

### שלב א׳ — הקמת השלד (1–10)

**משימה 1: יצירת הפרויקט עם Vite** — ✅ בוצע
- מ-cwd `e:\kupot-project\kupot-project\` הרץ: `npm create vite@latest frontend-collector -- --template react`
- אימות: התיקייה `frontend-collector/` נוצרה עם `package.json`.

**משימה 2: התקנת תלויות בסיסיות** — ✅ בוצע
- `cd frontend-collector && npm install`
- `npm install react-router-dom @zxing/browser`
- אימות: שתי החבילות מופיעות ב-`dependencies` ב-`package.json`.

**משימה 3: התקנת Capacitor** — ✅ בוצע
- `npm install @capacitor/core @capacitor/cli @capacitor/android`
- `npx cap init "Kupot Collector" "com.kupot.collector" --web-dir=dist`
- אימות: `capacitor.config.json` נוצר בשורש הפרויקט.

**משימה 4: העתקת vite.config.js** — ✅ בוצע
- העתק מ-`frontend-admin/vite.config.js` ל-`frontend-collector/vite.config.js`
- שנה `port` ל-5174
- שמור את כל ה-proxy של `/api` ו-`/uploads`
- אימות: הקובץ קיים, port=5174.

**משימה 5: העתקת index.css** — ✅ בוצע
- העתק `frontend-admin/src/index.css` → `frontend-collector/src/index.css` ללא שינוי
- אימות: הקובץ קיים.

**משימה 6: העתקת api/client.js** — ✅ בוצע
- צור `frontend-collector/src/api/`
- העתק `client.js` ללא שינוי
- אימות: קובץ קיים.

**משימה 7: העתקת api/endpoints.js** — ✅ בוצע
- העתק ללא שינוי
- אימות: קובץ קיים.

**משימה 8: העתקת context/AuthContext.jsx** — ✅ בוצע
- צור `frontend-collector/src/context/`
- העתק ללא שינוי
- אימות: קובץ קיים.

**משימה 9: העתקת ProtectedRoute.jsx** — ✅ בוצע
- צור `frontend-collector/src/components/`
- העתק `ProtectedRoute.jsx` ללא שינוי
- אימות: קובץ קיים.

**משימה 10: עדכון main.jsx ו-index.html** — ✅ בוצע
- `main.jsx`: עטוף ב-`<BrowserRouter>` ו-`<AuthProvider>`
- `index.html`: `<html lang="he" dir="rtl">`, viewport `width=device-width, initial-scale=1, viewport-fit=cover`
- `App.jsx` זמני: `<div>Kupot Collector — בקרוב</div>`
- אימות: `npm run dev` רץ ללא שגיאות, מציג את הטקסט.

---

### שלב ב׳ — Auth + Layout בסיסי (11–17)

**משימה 11: LoginPage** — ✅ בוצע
- העתק מ-`frontend-admin/src/pages/LoginPage.jsx` ל-`frontend-collector/src/pages/LoginPage.jsx`
- התאם CSS למובייל: full-height, מרכוז אנכי, פדינג גדול לכפתור
- אימות: `/login` מציג טופס במובייל.

**משימה 12: BottomNav.jsx** — ✅ בוצע
- צור `src/components/BottomNav.jsx`
- 3 פריטים: 📦 קופות (`/boxes`), 💰 גביה (`/collection`), 🔔 משימות (`/tasks-alerts`)
- `position: fixed; bottom: 0; left: 0; right: 0`
- מציין טאב פעיל לפי `useLocation()`
- אימות: רינדור עם 3 כפתורים, עיצוב תקין.

**משימה 13: MobileLayout.jsx** — ✅ בוצע
- צור `src/components/MobileLayout.jsx`
- top bar: שם משתמש מ-AuthContext + אייקון 👤 בצד שמאל
- `<Outlet/>` באמצע עם `padding-bottom: 70px`
- `<BottomNav/>` בתחתית
- אימות: מבנה נכון.

**משימה 14: Routes ב-App.jsx** — ✅ בוצע
- `/login` → LoginPage
- `/` → ProtectedRoute → MobileLayout
  - `index` → `<Navigate to="/boxes"/>`
  - `/boxes` → placeholder `<div>קופות</div>`
  - `/collection` → placeholder
  - `/collection/:cardId` → placeholder
  - `/tasks-alerts` → placeholder
  - `/task/:taskId` → placeholder
- אימות: לחיצה על כל טאב ב-BottomNav מנווטת.

**משימה 15: logout מ-👤** — ✅ בוצע
- ב-MobileLayout: onClick על 👤 → קורא ל-`logout()` מ-AuthContext → `navigate('/login')`
- אימות: לחיצה מנתקת ומפנה ל-login.

**משימה 16: בדיקת auth flow** — ✅ בוצע
- בצע login עם משתמש collector קיים מהמסד
- אמת שה-JWT נשמר ב-localStorage
- אמת שניווט פנימי לא מאבד auth (רענון דף)
- אימות: ✅ או רשימת באגים.

**משימה 17: safe-area-inset לאייפונים** — ✅ בוצע
- ב-`index.css`: ל-BottomNav הוסף `padding-bottom: env(safe-area-inset-bottom)`
- ל-top bar הוסף `padding-top: env(safe-area-inset-top)`
- אימות: ב-DevTools במצב iPhone — לא נחתך.

---

### שלב ג׳ — תצוגת קופה (18–24)

**משימה 18: BoxesPage שלד** — ✅ בוצע
- `src/pages/BoxesPage.jsx`
- בטעינה: GET `/api/cards/active` (או endpoint שמסנן לפי הגובה המחובר)
- מציג רשימה: מספר קופה + שם + עיר
- אימות: רשימה נטענת.

**משימה 19: helper daysSince** — ✅ בוצע
- צור `src/utils/daysSince.js`
- פונקציה `daysSince(dateStr)` מחזירה מספר ימים, או `null` אם הקלט null
- אימות: ייבוא הפונקציה עובד.

**משימה 20: תג ימים-ללא-גביה** — ✅ בוצע
- בכל שורה ב-BoxesPage: תג עם מספר הימים מאז `last_collection_at`
- אם null → "טרם נגבה"
- צבע אחיד (`--accent`)
- אימות: התג מופיע בכל שורה.

**משימה 21: שדה חיפוש** — ✅ בוצע
- input אחד בראש BoxesPage
- מסנן client-side על: `box_number`, `custom_name`, `name`, `city`, `neighborhood`, `street`
- debounce 200ms (`useEffect` עם `setTimeout`)
- אימות: הקלדה מסננת בזמן אמת.

**משימה 22: מיון** — ✅ בוצע
- dropdown: ימים-ללא-גביה (default, יורד), מספר קופה (עולה), שם (א-ת)
- אימות: שינוי מיון מסדר את הרשימה.

**משימה 23: תצוגת custom_name** — ✅ בוצע
- העתק `src/utils/cardLabel.js` מ-frontend-admin
- השתמש בו ב-BoxesPage להצגת השם
- אימות: בקופה עם custom_name — מוצג השם המותאם.

**משימה 24: ניווט לתצוגת גביה** — ✅ בוצע
- onClick על שורה → `navigate(\`/collection/\${cardId}\`)`
- כל השורה לחיצה (לא רק טקסט)
- אימות: לחיצה פותחת תצוגת גביה.

---

### שלב ד׳ — תצוגת גביה (25–32)

**משימה 25: CollectionPage שלד** — ✅ בוצע

- `src/pages/CollectionPage.jsx`
- אם יש `:cardId` ב-URL → GET `/api/cards/:id`
- אם אין → שדה הזנת מספר קופה ידנית + כפתור "אחזר" → ניווט ל-`/collection/:id`
- אימות: שני המצבים עובדים.

**משימה 26: הצגת פרטי קופה** — ✅ בוצע
- מספר, שם (cardLabel), כתובת מלאה, הערות מיקום, תאריך גביה אחרון
- view-only
- אימות: כל השדות מוצגים.

**משימה 27: כפתור "בצע גביה"** — ✅ בוצע
- כפתור גדול מרכזי, רקע `--accent`
- onClick → `navigate(\`/scan/\${cardId}\`)` (route חדש שייווצר במשימה הבאה)
- אימות: הכפתור גלוי.

**משימה 28: BarcodeScanner.jsx** — ✅ בוצע
- `src/components/BarcodeScanner.jsx`
- שימוש ב-`BrowserMultiFormatReader` מ-`@zxing/browser`
- מבקש הרשאת מצלמה ב-mount
- מציג video full-screen
- props: `onScan(value)`, `onClose()`
- כפתור X בפינה
- הוסף route `/scan/:cardId` שמרנדר את הסורק
- אימות: סריקת ברקוד אמיתי בדפדפן (Chrome/HTTPS) מחזירה ערך.

**משימה 29: אישור סריקה ויצירת מעטפה** — ✅ בוצע
- אחרי scan: confirm dialog "מעטפה {value} — לאשר?"
- אישור → POST `/api/envelopes` עם `{ card_id, envelope_number: value }`
- הצלחה → toast + ניווט בחזרה ל-`/collection/:cardId`
- שגיאה → הודעה + השארות בסורק
- אימות: מעטפה נוצרת במסד.

**משימה 30: הזנה ידנית fallback** — ✅ בוצע
- בתוך מסך הסורק: כפתור משני "— או הזן ידנית —"
- פותח input פשוט עם submit
- אותה לוגיקת POST כמו במשימה 29
- אימות: יצירת מעטפה ללא סריקה.

**משימה 31: ReportFormPage** — ✅ בוצע
- `src/pages/ReportFormPage.jsx`, route `/report/:cardId`
- כפתור "צור דיווח" ב-CollectionPage מנווט אליו
- שדות: סוג דיווח (GET `/api/reports/types`), תיאור, צילום
- צילום: `<input type="file" accept="image/*" capture="environment">`
- POST `/api/reports` (multipart/form-data) — דומה ל-ManualReportModal
- אימות: דיווח נוצר עם תמונה.

**משימה 32: היסטוריית מעטפות** — 🔄 בביצוע
- בתחתית CollectionPage: 5 המעטפות האחרונות של הקופה
- GET `/api/envelopes?card_id=X&limit=5`
- אימות: רשימה מציגה את המעטפות.

---

### שלב ה׳ — משימות והתראות (33–37)

**משימה 33: TasksAlertsPage שלד** — ⏳ ממתינה
- `src/pages/TasksAlertsPage.jsx`
- 2 טאבים פנימיים: "משימות" / "התראות"
- אימות: מעבר בין הטאבים.

**משימה 34: רשימת משימות** — ⏳ ממתינה
- GET `/api/tasks?assigned_to_me=true&status=open`
- מציג: כותרת, תאריך יעד, קופה משויכת
- onClick → `navigate(\`/task/\${id}\`)`
- אימות: רשימה נטענת.

**משימה 35: TaskViewPage** — ⏳ ממתינה
- `src/pages/TaskViewPage.jsx`
- GET `/api/tasks/:id`
- view-only של כל הפרטים
- כפתור "סמן כבוצע" → POST `/api/tasks/:id/execute` (או endpoint קיים מהאדמין)
- אחרי ביצוע → `navigate('/tasks-alerts')`
- אימות: ביצוע משימה משנה סטטוס.

**משימה 36: רשימת התראות** — ⏳ ממתינה
- GET `/api/alerts?for_me=true`
- מציג: סוג, קופה, תאריך
- onClick → `navigate(\`/collection/\${cardId}\`)`
- אימות: לחיצה פותחת את הקופה.

**משימה 37: badge התראות** — ⏳ ממתינה
- ב-BottomNav, מעל אייקון 🔔
- ספירה מ-GET `/api/alerts?for_me=true&unread=true`
- מתעדכן בכניסה ל-tasks-alerts
- אימות: badge מציג מספר נכון.

---

### שלב ו׳ — בנייה ל-APK (38–40)

**משימה 38: בניית web ו-sync** — ⏳ ממתינה
- `npm run build`
- `npx cap add android` (אם עוד לא נוסף)
- `npx cap sync android`
- אימות: תיקיית `android/` מאוכלסת.

**משימה 39: הרשאות והגדרות native** — ⏳ ממתינה
- `android/app/src/main/AndroidManifest.xml`:
  - `<uses-permission android:name="android.permission.CAMERA"/>`
  - `<uses-permission android:name="android.permission.INTERNET"/>`
  - `<uses-feature android:name="android.hardware.camera" android:required="true"/>`
- `capacitor.config.json`:
  - `server.androidScheme: "https"`
  - `server.cleartext: true` (אם הבקאנד ב-HTTP)
- אימות: ההרשאות מופיעות.

**משימה 40: בניית APK Debug** — ⏳ ממתינה
- `cd android && ./gradlew assembleDebug` (או `gradlew.bat` ב-Windows)
- APK ב-`android/app/build/outputs/apk/debug/app-debug.apk`
- אימות: התקנה במכשיר אנדרואיד אמיתי, login, סריקה.

---

## ✅ הושלם
(ריק)

## ❌ נכשל / חסום
(ריק)



## תיקונים

**משימה 1
בתצוגת קופות, צריך להציג פרטים מלאים, עיר, שכונה, רחוב, מספר, הערו