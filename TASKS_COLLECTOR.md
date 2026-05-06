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

**משימה 32: היסטוריית מעטפות** — ✅ בוצע
- בתחתית CollectionPage: 5 המעטפות האחרונות של הקופה
- GET `/api/envelopes?card_id=X&limit=5`
- אימות: רשימה מציגה את המעטפות.

---

### שלב ה׳ — משימות והתראות (33–37)

**משימה 33: TasksAlertsPage שלד** — ✅ בוצע
- `src/pages/TasksAlertsPage.jsx`
- 2 טאבים פנימיים: "משימות" / "התראות"
- אימות: מעבר בין הטאבים.

**משימה 34: רשימת משימות** — ✅ בוצע
- GET `/api/tasks?status=open` (סינון לפי משתמש מתבצע אוטומטית בבק עבור collector)
- מציג: כותרת, תאריך יעד, קופה משויכת
- onClick → `navigate(\`/task/\${id}\`)`
- אימות: רשימה נטענת.

**משימה 35: TaskViewPage** — ✅ בוצע
- `src/pages/TaskViewPage.jsx`
- GET `/api/tasks/:id`
- view-only של כל הפרטים
- כפתור "סמן כבוצע" → POST `/api/tasks/:id/complete` (endpoint קיים מהאדמין)
- אחרי ביצוע → `navigate('/tasks-alerts')`
- אימות: ביצוע משימה משנה סטטוס.

**משימה 36: רשימת התראות** — ✅ בוצע
- GET `/api/alerts/no-collection` (מסונן אוטומטית לפי שיוכי האזור של הגובה)
- מציג: שם/מספר קופה, ימים ללא גביה, כתובת
- onClick → `navigate(\`/collection/\${cardId}\`)`
- אימות: לחיצה פותחת את הקופה.

**משימה 37: badge התראות** — ✅ בוצע
- ב-BottomNav, מעל אייקון 🔔
- ספירה מ-GET `/api/alerts/no-collection` (`count`)
- נטען בכניסה ל-app + מתעדכן בכניסה ל-tasks-alerts ובאירוע `alerts:refresh`
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



### שלב ז׳ — תיקונים (41–49)

**משימה 41: הסרת היסטוריית מעטפות מתצוגת קופה** — ✅ בוצע
- ב-`CollectionPage.jsx`: הסר את section "5 המעטפות האחרונות" (הוספה במשימה 32)
- הסר את הקריאה ל-GET `/api/envelopes?card_id=X&limit=5`
- אימות: בכניסה לתצוגת קופה אין סקציית מעטפות אחרונות.

**משימה 42: איחוד טאב משימות+התראות לטאב אחד עם 3 תתי-טאבים** — ✅ בוצע
- ב-`TasksAlertsPage.jsx`: שנה את 2 הטאבים הפנימיים (משימות/התראות) ל-3 טאבים: "הכל" / "משימות" / "התראות"
- "הכל" (default): מציג קודם את כל המשימות הפתוחות, ואחריהן את כל ההתראות
- "משימות": כמו עכשיו (GET `/api/tasks?status=open`)
- "התראות": כמו עכשיו (GET `/api/alerts/no-collection`)
- כל פריט שומר על ה-onClick המתאים שלו (משימה → `/task/:id`, התראה → `/collection/:cardId`)
- אימות: 3 טאבים מוצגים, "הכל" מציג משימות לפני התראות, badge ב-BottomNav ממשיך לעבוד.

**משימה 43: תיקון אחזור קופה לפי מספר ידני** — ✅ בוצע
- ב-`CollectionPage.jsx` (מצב ללא `:cardId`): תקן את לוגיקת ה-"אחזר"
- כיום מחזיר תמיד את הקופה הראשונה — צריך להחזיר את הקופה לפי מספר ההזנה המדויק
- בצע GET `/api/cards?box_number=X` או endpoint דומה שמחפש לפי `box_number`
- **הבחנה בין מצבי שגיאה (חשוב — לא רק "קופה לא קיימת"):**
  - אם הקופה לא קיימת בכלל במסד → "מספר קופה שגוי / קופה לא קיימת"
  - אם הקופה קיימת אך לא משויכת למשתמש המחובר → "קופה זו אינה משויכת אליך"
  - אם הקופה קיימת אך הכרטסת סגורה (אין active card) → "כרטסת הקופה סגורה"
  - הצג בכל מקרה את ההודעה התואמת — אל תאחד הכל ל"קופה לא קיימת"
- אם נמצאה והכל תקין → `navigate(\`/scan/\${cardId}\`)` (לפי משימה 46 — פותח סורק ישירות)
- אימות: כל אחד מ-3 מצבי השגיאה מציג הודעה ייעודית תואמת. הזנת מספר קיים ומשויך → ניווט לסורק.

**משימה 44: הוספת אפשרות צילום מצלמה בדיווח** — ✅ בוצע
- ב-`ReportFormPage.jsx`: הוסף ליד שדה הצילום הקיים שני כפתורים נפרדים:
  - "📷 צלם" — `<input type="file" accept="image/*" capture="environment">`
  - "📁 בחר קובץ" — `<input type="file" accept="image/*">` (ללא `capture`)
- שניהם משתמשים באותו state ובאותו POST
- אימות: לחיצה על "צלם" פותחת מצלמה ישירות. לחיצה על "בחר קובץ" פותחת file picker.

**משימה 45: שמירת מצלמה פתוחה בסורק ברקוד** — ✅ בוצע
- ב-`BarcodeScanner.jsx`: ודא שה-`BrowserMultiFormatReader` רץ ב-`decodeFromVideoDevice` רציף (לא single-shot)
- בדוק את ה-cleanup ב-`useEffect` — שלא יקרא ל-`reset()` בכל re-render
- ה-stream של המצלמה צריך להישאר פעיל עד אחד מהשניים: ברקוד נקלט (קורא `onScan`) או המשתמש לחץ X (קורא `onClose`)
- הסר כל לוגיקה שעוצרת את המצלמה אחרי timeout או אחרי error חד-פעמי
- אימות: פתיחת הסורק — המצלמה נשארת פעילה ברציפות עד סריקת ברקוד או לחיצה על X.

**משימה 46: שינוי flow של "בצע גביה" לפתיחת סורק ושיוך מעטפה** — ✅ בוצע
- **ההבהרה:** כשמאחזרים קופה לפי מספר ידני (במסך ללא `:cardId`) — אסור לפתוח קודם את תצוגת הקופה ואז להמתין שילחצו "בצע גביה". הסורק צריך להיפתח **מיד** כאילו לחצו "בצע גביה".
- **flow מבוקש (ידני):** הזנת מספר → "אחזר" → ולידציה (משימה 43) → אם תקין: `navigate(\`/scan/\${cardId}\`)` ישירות (לא ל-`/collection/:cardId`)
- **flow מבוקש מ-X בסורק (סגירת מצלמה ללא סריקה):** במצב שהגענו לסורק מאחזור ידני → לחיצה על X → ניווט ל-`/collection/:cardId` (תצוגת הקופה) כדי לאפשר "צור דיווח". כלומר X = "ביטול גביה, אבל אפשרות לדיווח".
- **flow מתצוגת קופה (לחיצה על "בצע גביה" מתוך `/collection/:cardId`):** סריקה → POST `/api/envelopes` → חזרה ל-`/collection/:cardId`. X → חזרה ל-`/collection/:cardId` ללא יצירה.
- "צור דיווח" נשאר כפתור נפרד ב-`/collection/:cardId` שמנווט ל-`/report/:cardId`.
- אימות:
  - אחזור ידני של מספר תקין → סורק נפתח מיד (לא תצוגת קופה).
  - X בסורק (במצב אחזור ידני) → תצוגת הקופה נפתחת, "צור דיווח" זמין.
  - סריקה מוצלחת → מעטפה נוצרת + ניווט לתצוגת הקופה.

**משימה 47: הצגת פרטי כתובת מלאים ב-BoxesPage** — ✅ בוצע
- ב-`BoxesPage.jsx`: בכל שורה הצג את הכתובת המלאה: `city, neighborhood, street number`
- פורמט מוצע: שורה שנייה מתחת לשם — `{city} • {neighborhood} • {street} {street_number}` (דלג על שדות ריקים)
- אימות: כל שורה מציגה עיר + שכונה + רחוב + מספר (כל הזמין מהמסד).

**משימה 48: הוספת מיון לפי רחוב** — ✅ בוצע
- ב-`BoxesPage.jsx`: הוסף ל-dropdown המיון אופציה נוספת: "רחוב (א-ת)"
- מיון לפי השדה `street` (אלפביתי עברי, `localeCompare('he')`)
- אימות: בחירת "רחוב" ממיינת את הרשימה לפי רחוב.

**משימה 49: שמירת state של חיפוש ומיון בין ניווטים** — ✅ בוצע
- ב-`BoxesPage.jsx`: העבר את ערכי החיפוש והמיון מ-`useState` מקומי ל-state גלובלי
- אופציות: Context ייעודי (`BoxesFilterContext`) או `sessionStorage` (קל יותר)
- בכניסה ל-BoxesPage — אם יש ערכים שמורים, טען אותם
- ביציאה (ניווט לגביה) — שמור את הערכים הנוכחיים
- חזרה ל-BoxesPage — הערכים נשמרים (גם החיפוש וגם המיון)
- אימות: הזן חיפוש + שנה מיון → לחץ על קופה → חזור ל-BoxesPage → החיפוש והמיון נשמרו.

**משימה 50: הבחנה בין מספר קופה למספר כרטסת ב-BoxesPage** — ✅ בוצע
- ב-`BoxesPage.jsx`: כיום בכל שורה מספר הכרטסת מופיע פעמיים (כפילות)
- צריך להציג שני מספרים נפרדים עם תוויות ברורות:
  - **מספר קופה** — `box.iron_number` (או השדה התואם מהמסד)
  - **מספר כרטסת** — `card.id` או `card.card_number` (המזהה של ה-active card)
- פורמט מוצע: `קופה: {iron_number} • כרטסת: {card_id}` (או בשתי שורות נפרדות עם labels)
- ודא שאף אחד מהשניים אינו מוצג פעמיים ושהתוויות בעברית ברורות
- אימות: בכל שורה ב-BoxesPage מוצגים שני מספרים נפרדים — מספר קופה ומספר כרטסת — ללא כפילות, עם תוויות תואמות.

**משימה 51: הסרת מספר כרטסת מ-BoxesPage (השארה רק ב-CollectionPage)** — ✅ בוצע
- ב-`BoxesPage.jsx`: בתצוגה הראשית של רשימת הקופות אין צורך במספר הכרטסת — הוא מיותר.
- הסר את שורת "כרטסת: {label}" שנוספה במשימה 50.
- השאר רק "קופה: {iron_number}" (או הצגה פשוטה של מספר הקופה ללא כפילות עם השם).
- ב-`CollectionPage.jsx`: ודא שמספר הכרטסת ממשיך להיות מוצג בתצוגת הקופה הפנימית (כבר מוצג ב-`#{cardLabel}` ב-sub-title).
- אימות: BoxesPage מציג רק מספר קופה (לא כרטסת). כניסה לקופה ב-CollectionPage עדיין מציגה את מספר הכרטסת.

**משימה 52: תיקון תצוגת "גביה אחרונה" ב-CollectionPage (שאיבה מ-events)** — ✅ בוצע
- **באג:** בתצוגת קופה (`/collection/:cardId`) השדה "גביה אחרונה" מציג "--" גם כאשר בוצעו גביות לקופה זו.
- **שורש הבעיה:** `GET /api/cards/:id` ב-[`backend/src/routes/cards.js`](backend/src/routes/cards.js#L189-L209) **לא** מחשב את השדה `last_collection_at`. בלִיסט של האדמין (`GET /api/cards`, [שורות 43-46](backend/src/routes/cards.js#L43-L46)) הוא כן מחושב.
- **התיקון — להשתמש באותה שיטה כמו תצוגת הכרטסות באדמין** ([`frontend-admin/src/pages/CardsPage.jsx:214`](frontend-admin/src/pages/CardsPage.jsx#L214)):
  ```sql
  GREATEST(
    (SELECT MAX(e.collected_at) FROM envelopes e WHERE e.card_id = c.id),
    (SELECT MAX(ev.created_at)  FROM events    ev WHERE ev.card_id = c.id AND ev.event_type = 'collection')
  ) AS last_collection_at
  ```
  הוסף את ה-subquery הזה ל-SELECT של `GET /api/cards/:id` כך שה-response יכלול `last_collection_at` (זהה לפורמט של `GET /api/cards`).
- **בצד הלקוח** ב-`CollectionPage.jsx`: ודא שהתצוגה משתמשת ב-`card.last_collection_at` ומפורמטת ב-`new Date(...).toLocaleDateString('he-IL')` (כמו באדמין). אם null → הצג "--" או "טרם נגבה".
- בדוק שאחרי יצירת מעטפה חדשה (POST `/api/envelopes`) — חזרה ל-`/collection/:cardId` מבצעת refetch ומציגה את הגביה החדשה.
- אימות:
  - קופה עם מעטפות/אירועי גביה במסד → "גביה אחרונה" מציג את התאריך הנכון (לא "--").
  - קופה ללא גביות כלל → "גביה אחרונה" מציג "--" או "טרם נגבה".
  - יצירת מעטפה חדשה דרך הסורק → חזרה לתצוגה מציגה את הגביה החדשה.

**משימה 54: תצוגת משימה מלאה + אישור ביצוע + פתיחת מיקום בהתקנה** — ✅ בוצע
- **באג 1:** ב-`TaskViewPage` (תצוגת משימה ב-`/task/:taskId`) חסרים פרטי משימה ולא מוצגת תמונת המשימה (`image_path`).
- **באג 2:** באישור ביצוע — לא ניתן להזין הערות ביצוע ולצרף תמונה (הקריאה `tasksApi.complete(task.id, {})` נעשית עם body ריק).
- **באג 3:** באישור ביצוע משימת התקנה (`opens_card`) — לא נפתח טופס מיקום לפתיחת כרטסת חדשה (עיר/שכונה/רחוב/בניין).
- **התיקון — העתקה מ-frontend-admin:**
  - העתק לקולקטור: `LocationCombobox.jsx`, `TaskExecModal.jsx`, `TaskExecDetailsModal.jsx` (מ-`frontend-admin/src/components/`). כולם משתמשים ב-CSS classes הקיימים ב-`index.css` של הקולקטור (`.field`, `.modal-row`, `.btn`, `.alert.red`, וכו').
  - שדרג את backend `fetchTaskWithType` ב-[`backend/src/routes/tasks.js`](backend/src/routes/tasks.js) כך ש-GET `/api/tasks/:id` יחזיר גם `iron_number`, `assigned_name`, `created_by_name` (joins זהים לאלה שב-GET `/api/tasks`).
  - שכתב את `TaskViewPage.jsx`:
    - תצוגה מורחבת: lifecycle hint (`installation`/`transfer`/`removal`/`generic`), תאריך יצירה/יעד, משויכת ל, נוצרה ע"י, הערות, מיקום מתוכנן (`new_city/neighborhood/street/building`), הערות מיקום.
    - הצגת `image_path` (תמונת המשימה) כתמונה קליקבילית.
    - למשימות שבוצעו/בוטלו: הצגת `execution_notes`, `execution_image`, `cancellation_reason` במקום, וכפתור "פרטי ביצוע מלאים" שפותח את `TaskExecDetailsModal`.
    - למשימות פתוחות: כפתור "אישור ביצוע" פותח את `TaskExecModal` (שמטפל בהערות ביצוע, צילום/צירוף תמונה, ובמיקום מלא לפתיחת כרטסת — כולל ולידציה שעיר היא חובה לטיפוסי `opens_card`).
- אימות:
  - תצוגת משימה רגילה — מציגה את כל הפרטים ואת תמונת המשימה (אם קיימת).
  - לחיצה על "אישור ביצוע" במשימה רגילה — נפתח מודאל עם textarea להערות ביצוע + כפתורי "צרף קובץ"/"צלם עכשיו".
  - לחיצה על "אישור ביצוע" במשימת התקנה (`opens_card`) — המודאל כולל גם בלוק "📍 מיקום מדויק (לפתיחת הכרטסת החדשה)" עם 4 שדות + הערות מיקום, וניסיון אישור ללא עיר חוסם עם הודעת שגיאה.
  - אישור מוצלח — `POST /api/tasks/:id/complete` נשלח עם body מלא (כולל `execution_image` אם הועלתה תמונה), המשימה מתעדכנת, וניווט חזרה ל-`/tasks-alerts`.

**משימה 55: דיווחים פתוחים בטאב התראות (admin בלבד) + מודאל המרה למשימה** — ✅ בוצע
- **מטרה:** למשתמש admin בעמוד `/tasks-alerts` של הקולקטור — יוצגו גם **דיווחים פתוחים** (`reports.status='open'`), בנוסף להתראות אי-גביה הקיימות. קליק על דיווח יפתח את אותו מודאל ניהול דיווח כמו ב-frontend-admin, כולל כפתור "🔄 המרה למשימה".
- **רקע:** ב-frontend-admin `AlertsPage.jsx` יש שתי פאנלים בעמוד אחד: "קופות ללא גביה" + "דיווחים פתוחים". בקולקטור היום מוצגים רק התראות אי-גביה. צריך להשלים גם את צד הדיווחים — אבל רק ל-admin (collector רגיל לא רואה דיווחים פתוחים בעמוד הזה).
- **העתקת קומפוננטות מ-frontend-admin:**
  - `frontend-admin/src/components/ReportModal.jsx` → `frontend-collector/src/components/ReportModal.jsx` (משתמש ב-Modal, taskTypes, users, reports — כולם קיימים בקולקטור).
  - `frontend-admin/src/components/CloseReportModal.jsx` → `frontend-collector/src/components/CloseReportModal.jsx` (משתמש ב-`reports.close`, קיים).
  - הקבצים משתמשים ב-CSS classes שכבר קיימים ב-`index.css` של הקולקטור (`.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-close`, `.modal-footer`, `.field`, `.modal-row`, `.btn`, `.alert.red`, `.alert.info`).
- **שינויים ב-`TasksAlertsPage.jsx`:**
  - הוסף state ל-`openReports`, `reportsLoading`, `reportsError` + state למודאלים `openReport`, `closeReport`.
  - לאדמין בלבד: בטעינה — `reports.getAll({ status: 'open' })`.
  - בטאב "הכל" — אם admin: הוסף סקציית "📋 דיווחים פתוחים" אחרי המשימות וההתראות.
  - בטאב "התראות" — אם admin: הוסף סקציית "📋 דיווחים פתוחים" אחרי רשימת ההתראות.
  - כל פריט דיווח: שורה (`.simple-row`) עם אייקון/סוג/קופה/תיאור/ימים פתוח, ב-onClick → `setOpenReport(r)`.
  - אחרי `onSaved` של ReportModal — אם הדיווח עבר לסטטוס שאינו `open` → הסר מהרשימה; אחרת — עדכן בתוכה.
  - עדכון ספירה בטאבים — "הכל" יכלול גם `openReports.length` עבור admin; טאב "התראות" יציג ספירה מאוחדת `alertsList.length + (admin ? openReports.length : 0)`.
- אימות:
  - admin נכנס ל-`/tasks-alerts` → רואה במצב "הכל" וב-"התראות" את כל הדיווחים הפתוחים.
  - collector רגיל לא רואה את סקציית הדיווחים הפתוחים (אין POST/GET נוספים מבחינתו).
  - לחיצה על דיווח → פותח ReportModal עם פרטים מלאים, סטטוס, תיאור, תמונה אם קיימת.
  - לחיצה על "🔄 המרה למשימה" → נפתח בלוק עם שדות סוג משימה, שיוך, ולמשימות `opens_card` גם שדות מיקום (עיר חובה).
  - שמירה / המרה / סגירה → רענון מקומי של הרשימה ללא reload.

**משימה 53: כפתור "צור משימה" בכרטסת משימות (admin בלבד)** — ✅ בוצע
- ב-`TasksAlertsPage.jsx`: הוסף כפתור "➕ צור משימה" בראש הדף, מעל הטאבים.
- הצגה רק כש-`user.role === 'admin'` (משתמש collector לא יראה את הכפתור).
- לחיצה פותחת את `TaskModal` — קומפוננטת מודאל ליצירת משימה חדשה (תעתיק מ-`frontend-admin/src/components/TaskModal.jsx`).
- העתק לקולקטור: `Modal.jsx`, `BoxNumberAutocomplete.jsx`, `TaskModal.jsx` (כולם משתמשים ב-CSS classes שכבר קיימים ב-`index.css` של הקולקטור).
- אחרי שמירה מוצלחת — סגור את המודאל ובצע refetch של רשימת המשימות.
- אימות:
  - משתמש admin רואה כפתור "צור משימה" בעמוד משימות+התראות; לחיצה פותחת את הטופס המלא של אדמין.
  - משתמש collector לא רואה את הכפתור.
  - יצירת משימה דרך הטופס יוצרת אותה במסד והרשימה מתרעננת.
---

**משימה 56: חלוקה לסקציות בטאב "הכל" של תצוגת משימות+התראות** — ✅ בוצע
- **באג:** ב-`TasksAlertsPage.jsx`, בטאב "הכל" אין הפרדה ויזואלית בין רשימת המשימות לרשימת ההתראות. בטאב "התראות" כן יש הפרדה (כי `ReportsList` כולל כותרת סקציה `📋 דיווחים פתוחים`).
- **התיקון:**
  - הוסף ל-`TasksList` ול-`AlertsList` prop בשם `sectionTitle` שמרנדר `<div className="simple-row-section-title">{sectionTitle}</div>` בראש הרשימה (רק כאשר יש פריטים), בדומה ל-`ReportsList`.
  - בטאב "הכל" העבר `sectionTitle="📋 משימות"` ל-`TasksList` ו-`sectionTitle="⚠️ התראות"` ל-`AlertsList`. סקציית הדיווחים כבר כוללת כותרת.
  - בטאב "משימות" ובטאב "התראות" — אל תעביר `sectionTitle` (אין צורך בכותרת כי הטאב עצמו הוא הכותרת).
- אימות: בטאב "הכל" מופיעות 3 כותרות סקציה (משימות / התראות / דיווחים פתוחים) עם הפרדה ויזואלית ברורה. בטאבים האחרים אין כותרות מיותרות.

## ✅ הושלם
(ריק)

## ❌ נכשל / חסום
(ריק)


