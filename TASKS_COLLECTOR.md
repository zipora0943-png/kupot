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

**משימה 38: בניית web ו-sync** — ✅ בוצע
- `npm run build`
- `npx cap add android` (אם עוד לא נוסף)
- `npx cap sync android`
- אימות: תיקיית `android/` מאוכלסת.

**משימה 39: הרשאות והגדרות native** — ✅ בוצע
- `android/app/src/main/AndroidManifest.xml`:
  - `<uses-permission android:name="android.permission.CAMERA"/>`
  - `<uses-permission android:name="android.permission.INTERNET"/>`
  - `<uses-feature android:name="android.hardware.camera" android:required="true"/>`
- `capacitor.config.json`:
  - `server.androidScheme: "https"`
  - `server.cleartext: true` (אם הבקאנד ב-HTTP)
- אימות: ההרשאות מופיעות.

**משימה 40: בניית APK Debug** — ✅ בוצע
- `cd android && ./gradlew assembleDebug` (או `gradlew.bat` ב-Windows)
- APK ב-`android/app/build/outputs/apk/debug/app-debug.apk`
- אימות: התקנה במכשיר אנדרואיד אמיתי, login, סריקה.
- **סטטוס 2026-05-12:** APK נבנה בהצלחה (4.18MB). סביבה הותקנה ב-`C:\android-dev\`: Microsoft OpenJDK 21 + Android SDK (cmdline-tools, platform-tools, platforms;android-36, build-tools;35.0.0 + 36.0.0). אימות התקנה במכשיר ממתין למשתמש.



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

**משימה 57: אישור כתובת לפני גביה מתוך אחזור קופה** — ✅ בוצע
- **בעיה:** כשגובה מאחזר קופה לפי מספר בטופס "אחזור קופה" ולוחץ ישירות על "💰 בצע גביה" (בלי לעבור דרך "📋 הצג פרטים"), הוא לא רואה את הכתובת ועלול ליצור גביה לקופה הלא נכונה.
- **התיקון ב-[CollectionPage.jsx](frontend-collector/src/pages/CollectionPage.jsx):**
  - "💰 בצע גביה" בטופס האחזור עוצר עכשיו במודאל אישור (`Modal` מ-`@shared/components`) שמציג: מספר קופה, שם, כתובת מלאה (עיר/שכונה/רחוב/בניין) והערות מיקום.
  - שני כפתורים במודאל: **"✓ אשר והמשך לגביה"** → `/scan/:id`, **"📝 צור דיווח כתובת"** → `/report/:id?reason=address`.
  - הזרימות האחרות לא נגעו: "📝 צור דיווח" ו-"📋 הצג פרטים" עובדים כרגיל; כניסה דרך פרטי הקופה ל-"בצע גביה" גם היא ללא מודאל (הכתובת כבר נראתה).
- **התיקון ב-[ReportFormPage.jsx](frontend-collector/src/pages/ReportFormPage.jsx):**
  - קורא `?reason=address` ומכין את התיאור עם `"כתובת שגויה: "` בשדה description.
- אימות: אחזור קופה לפי מספר → "בצע גביה" פותח מודאל עם הכתובת; אישור ממשיך לסריקה; "צור דיווח כתובת" מגיע לטופס הדיווח עם תיאור התחלתי.

**משימה 58: אימות מיקום GPS במקום אישור כתובת ידני (רדיוס 25 מטר)** — ✅ בוצע
- **מטרה:** במקום שהגובה רק יראה את הכתובת ויאשר ידנית (משימה 57), האפליקציה תוודא אוטומטית שהגובה אכן נמצא פיזית במיקום של הקופה — באמצעות המרת הכתובת לקואורדינטות והשוואה למיקום ה-GPS של המכשיר.
- **ארכיטקטורה — כל הלוגיקה בצד שרת:**
  - הקליינט **לא** מדבר עם Google Maps ישירות, ולא מבצע חישובי מרחק.
  - הקליינט: (1) קורא ל-GPS דרך Capacitor/Web API, (2) שולח `{lat, lng}` לשרת שלנו, (3) מקבל החלטה מהשרת.
  - השרת: מבצע את כל הגאוקודינג, שומר קואורדינטות במסד, מחשב Haversine ומחזיר תשובה.
  - יתרון: ה-`GOOGLE_MAPS_API_KEY` נשאר רק בשרת, אין חשיפה במכשירים.

#### 58.א — שינויי DB ובאקאנד
- **מיגרציה ב-[schema.sql](backend/src/db/schema.sql):** הוסף לטבלת `cards`:
  - `latitude DECIMAL(10,7) NULL`
  - `longitude DECIMAL(10,7) NULL`
  - `geocoded_at TIMESTAMP NULL`
  - `geocode_status TEXT NULL` (ערכים אפשריים: `ok`, `not_found`, `error`)
- **הגדרת `GOOGLE_MAPS_API_KEY` ב-`.env`** (`backend/.env.example` לעדכון, ללא חשיפת המפתח האמיתי).
  - **חשוב:** המפתח נשאר רק בשרת. הקליינט לעולם לא מקבל אותו, ולא מבצע קריאות ל-Google Maps.
- **שירות גאוקודינג חדש ב-[backend/src/services/](backend/src/services/) (תיקייה חדשה אם לא קיימת):**
  - `geocoding.js` עם פונקציה `geocodeAddress({ city, neighborhood, street, building })` שמחזירה `{ lat, lng, status }`.
  - בונה query string מהשדות, קורא ל-Google Maps API מהשרת בלבד, מחזיר התוצאה הראשונה.
- **שירות חישוב מרחק ב-[backend/src/services/distance.js](backend/src/services/distance.js):**
  - `haversineMeters(lat1, lng1, lat2, lng2)` — מחזיר מרחק במטרים. רדיוס כדור הארץ = 6,371,000 מ'.
- **טריגר אוטומטי לגאוקודינג:**
  - בכל `POST /api/cards` ו-`PATCH /api/cards/:id` (כאשר אחד מ-`city/neighborhood/street/building` משתנה) — קרא לגאוקודינג ועדכן את העמודות החדשות.
  - אם הגאוקודינג נכשל → `geocode_status='error'`, האפליקציה תטפל בכך גרייספול.
- **endpoint עזר חדש:** `POST /api/cards/:id/geocode` — מאלץ גאוקודינג מחדש של קופה (לשימוש admin בלבד, במקרה של עדכון ידני).
- **endpoint אימות מיקום (הליבה של המשימה):** `POST /api/cards/:id/verify-location`
  - body: `{ lat: number, lng: number }` (קואורדינטות המכשיר מה-GPS)
  - response: `{ within_radius: boolean, distance_meters: number, radius_meters: 25, card_geocoded: boolean }`
    - `within_radius=true` אם המרחק ≤ 25 מ'
    - `card_geocoded=false` אם לקופה אין קואורדינטות במסד (geocode_status !== 'ok') — במקרה זה הקליינט ידלג על האזהרה
  - השרת קורא לקואורדינטות הקופה מ-DB, מחשב מרחק עם `haversineMeters`, ומחזיר את ההחלטה.
- **שום שינוי ב-`GET /api/cards/:id` ביחס לקליינט:** השדות `latitude/longitude` **לא** נחשפים לקליינט (כדי לא להדליף מיקומים). הקליינט מקבל החלטה מ-`verify-location` בלבד.

#### 58.ב — Capacitor: הרשאת מיקום
- **התקנה:** `npm install @capacitor/geolocation` בתיקיית `frontend-collector`.
- **`npx cap sync android`** אחרי ההתקנה.
- **[AndroidManifest.xml](frontend-collector/android/app/src/main/AndroidManifest.xml):** הוסף:
  - `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>`
  - `<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>`
- **בדפדפן:** השתמש ב-`navigator.geolocation.getCurrentPosition()` (Web API) — `@capacitor/geolocation` נופל אוטומטית ל-Web fallback.

#### 58.ג — לוגיקת אימות בקליינט ([CollectionPage.jsx](frontend-collector/src/pages/CollectionPage.jsx))
- **הקליינט אחראי רק לקבלת GPS ולקריאה ל-API שלנו. אין חישובי מרחק, אין קריאות ל-Google Maps.**
- **שינוי הזרימה במודאל אישור הגביה (שהתווסף במשימה 57):**
  - כפתור "✓ אשר והמשך לגביה" → לפני ה-navigate ל-`/scan/:id`:
    1. בקש מיקום מהמכשיר עם `Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })`.
    2. אם המשתמש דחה הרשאה / timeout / כל שגיאה אחרת → הצג הודעה: "לא ניתן לאמת מיקום. ניתן להמשיך, אבל מומלץ לאפשר מיקום." + 2 כפתורים: "המשך בכל זאת" / "ביטול".
    3. אם התקבל מיקום → קרא ל-`POST /api/cards/:id/verify-location` עם `{lat, lng}` של המכשיר.
    4. אם `within_radius=true` (השרת אישר) → המשך ישירות ל-`/scan/:id` (ללא הודעה).
    5. אם `card_geocoded=false` (אין קואורדינטות לקופה במסד) → דלג על האימות, המשך לסריקה (fallback בטוח).
    6. אם `within_radius=false` (השרת קבע שרחוק) → פתח **מודאל אזהרה** עם `distance_meters` מהתגובה (סעיף 58.ד).

#### 58.ד — מודאל אזהרה + הזנת סיבה
- **טקסט הכותרת:** "אתה רחוק מהכתובת הרשומה"
- **גוף ההודעה:**
  - "המיקום שלך: רחוק כ-{distance_meters} מ' מהכתובת הרשומה של הקופה."
  - "כתובת רשומה: {city}, {street} {building}"
- **שדה חובה:** `<textarea>` "סיבה להמשך גביה" (placeholder: "לדוגמה: ניסיון איתור הקופה, הגעה מוקדמת, GPS לא מדויק...")
- **שני כפתורים:**
  - **"המשך לגביה בכל זאת"** (פעיל רק כשהוזנה סיבה בעלת לפחות 5 תווים) — שולח את הסיבה ל-API (סעיף 58.ה) ואז `navigate('/scan/:id')`.
  - **"ביטול"** — סוגר את המודאל, נשארים בטופס האחזור.

#### 58.ה — שמירת הסיבה במסד
- **endpoint חדש:** `POST /api/location-overrides` עם body: `{ card_id, distance_meters, reason, gps_lat, gps_lng }`.
- **טבלה חדשה [schema.sql](backend/src/db/schema.sql):**
  ```sql
  CREATE TABLE location_overrides (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id),
    user_id INTEGER REFERENCES users(id),
    distance_meters INTEGER,
    reason TEXT,
    gps_lat DECIMAL(10,7),
    gps_lng DECIMAL(10,7),
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- מטרת הטבלה: רישום audit של מקרים שגובה אישר גביה למרות שהיה רחוק. ניתן יהיה לדווח עליהם ל-admin בעתיד (לא חלק ממשימה זו).

#### אימות
- כתובת חדשה נוצרת או מתעדכנת → `latitude`, `longitude`, `geocoded_at` מתמלאים אוטומטית במסד (קריאה לגוגל מתבצעת בשרת בלבד).
- בדיקת רשת בקליינט (DevTools/Charles): **אין** קריאות ל-`maps.googleapis.com` מהמכשיר. כל הקריאות הן רק לשרת שלנו.
- במכשיר אנדרואיד: בלחיצה על "אשר והמשך לגביה" — נפתחת הרשאה למיקום בפעם הראשונה.
- גובה במיקום הקופה (≤ 25 מ') → השרת מחזיר `within_radius=true`, הקליינט ממשיך ישירות לסורק.
- גובה רחוק (> 25 מ') → השרת מחזיר `within_radius=false` + `distance_meters`, מודאל אזהרה נפתח, חייב להזין סיבה, ואז ממשיך.
- הסיבה נשמרת בטבלת `location_overrides` עם הקואורדינטות של המכשיר.
- במצב שאין לקופה קואורדינטות במסד → השרת מחזיר `card_geocoded=false`, הזרימה הישנה ממשיכה ללא אימות (גרייספול).
- במצב שהמשתמש דחה הרשאת מיקום בצד הלקוח → מוצגת הודעה ברורה, ויש אפשרות "המשך בכל זאת".

**משימה 59: עדכון אוטומטי של גרסת האפליקציה כאשר עולה גרסה חדשה לשרת** — ✅ בוצע
- **מטרה:** כאשר עולה לשרת גרסה חדשה של הקולקטור (APK / web build), האפליקציה במכשיר תזהה זאת אוטומטית ותציע / תבצע עדכון — בלי שהמשתמש יצטרך להסיר ולהתקין ידנית.
- **רקע:** הקולקטור עטוף ב-Capacitor ומותקן כ-APK ידני (לא דרך Google Play), לכן אין מנגנון עדכון אוטומטי מובנה. רץ גם בדפדפן.

#### 59.א — תשתית גרסאות בשרת
- **`package.json` של `frontend-collector`** — `version` הוא מקור האמת. כל בנייה חדשה מחייבת bump (לדוגמה `1.0.1` → `1.0.2`).
- **endpoint חדש [backend/src/routes/version.js](backend/src/routes/version.js):**
  - `GET /api/version/collector` → מחזיר `{ version, apk_url, min_supported_version, released_at, release_notes }`.
  - הנתונים נשמרים בקובץ סטטי על השרת (לדוגמה `backend/public/collector-version.json`) או בטבלת `settings` חדשה.
- **תיקיית הורדות לשרת:** `backend/public/downloads/collector-{version}.apk` (או הגשה דרך nginx ישירות מ-`/var/www/kupot/downloads/`).
- **תהליך release אוטומטי — סקריפט חדש [frontend-collector/scripts/release.js](frontend-collector/scripts/release.js):**
  - מופעל ע"י `npm run release` בתיקיית `frontend-collector`.
  - שלבים אוטומטיים:
    1. `npm version patch` (או `minor`/`major` לפי flag) — מעדכן את `package.json`.
    2. `npm run build` — בונה את ה-web.
    3. `npx cap sync android` — מסנכרן ל-android.
    4. `cd android && ./gradlew assembleRelease` — בונה APK חתום.
    5. העלאה ל-production דרך `scp` או endpoint ייעודי `POST /api/version/collector/upload` (admin-only, multipart) שמקבל את ה-APK + מטא-דאטה ושומר אותו ב-`backend/public/downloads/`.
    6. עדכון אוטומטי של `collector-version.json` עם הגרסה החדשה, `apk_url`, `released_at`, ו-`release_notes` (אם סופקו כ-flag).
  - כל גרסה חדשה ב-`package.json` מפעילה אוטומטית את כל השרשרת — בלי שלבים ידניים נוספים.

#### 59.ב — בדיקת גרסה בקליינט
- **utility חדש [frontend-collector/src/utils/versionCheck.js](frontend-collector/src/utils/versionCheck.js):**
  - `getCurrentVersion()` — קורא מ-`import.meta.env.VITE_APP_VERSION` (יוזרק ב-build מ-`package.json`) או מ-`Capacitor App.getInfo()` בנייטיב.
  - `checkServerVersion()` — `GET /api/version/collector`, משווה עם המקומית, מחזיר `{ hasUpdate, isMandatory, latest, current }`.
  - `isMandatory` = `current < min_supported_version` (semver compare).
- **vite.config.js:** הוסף `define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) }` כך שהגרסה ב-`package.json` נחשפת לקוד.

#### 59.ג — לוגיקת עדכון לפי פלטפורמה
- **Web (דפדפן):** אם `hasUpdate` — הצג באנר/modal "יש גרסה חדשה — רענן את הדף". כפתור "רענן" עושה `window.location.reload(true)`. אם `isMandatory` — חסום שימוש עד רענון.
- **Android (Capacitor) — עדכון בתוך האפליקציה עצמה (ללא פתיחת דפדפן):**
  - **התקנה:** `npm install @capawesome/capacitor-app-update` (תוסף שמטפל ב-APK update flow מחוץ ל-Play Store).
  - **הרשאות נדרשות ב-[AndroidManifest.xml](frontend-collector/android/app/src/main/AndroidManifest.xml):**
    - `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>`
    - `<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>` (לאחסון ה-APK שירד)
  - **זרימה (הכל בתוך האפליקציה, ללא מעבר לדפדפן):**
    1. הורדה ברקע של ה-APK מ-`apk_url` דרך `Filesystem` API של Capacitor → שמירה ב-`Cache` או `External` directory.
    2. הצגת progress bar למשתמש בתוך ה-Modal של העדכון ("מוריד 3.2/4.1 MB...").
    3. אחרי הורדה — קריאה ל-`AppUpdate.openAppStore()` או יותר נכון ל-`FileOpener`/intent ישיר עם `application/vnd.android.package-archive` שמפעיל את מסך ההתקנה של אנדרואיד **בתוך** ההקשר של האפליקציה.
    4. הסכמת המשתמש להתקנה → אנדרואיד מבצע upgrade in-place (שומר על נתונים, JWT, הגדרות).
    5. אחרי התקנה — האפליקציה נסגרת ונפתחת מחדש בגרסה החדשה.
  - **לא** נפתח דפדפן ולא יוצאים מ-context של האפליקציה.

#### 59.ד — תזמון בדיקה
- בכניסה לאפליקציה (אחרי login מוצלח, ב-`AuthContext` או ב-`App.jsx`) — קריאה אחת ל-`checkServerVersion()`.
- בנוסף, בדיקה תקופתית כל שעה (`setInterval`) כל עוד האפליקציה פתוחה.
- אחסון `lastCheckedAt` ב-localStorage כדי לא להציג שוב את אותו עדכון שהמשתמש דחה (אלא אם הוא mandatory).

#### 59.ה — UI
- **UpdateBanner.jsx חדש** — באנר עליון דק בצבע `--accent`, טקסט "גרסה חדשה זמינה — {version}" + כפתור "עדכן עכשיו" + X לסגירה (רק אם לא mandatory).
- **UpdateModal.jsx חדש** — מודאל מלא ל-`isMandatory=true`, ללא אפשרות סגירה, כפתור יחיד "התקן עכשיו".

#### אימות
- העלאת גרסה חדשה לשרת (עדכון `collector-version.json` ל-`1.0.2`) → אפליקציה מותקנת בגרסה `1.0.1` מציגה תוך דקה באנר עדכון.
- לחיצה על "עדכן עכשיו" בדפדפן → דף מתרענן וטוען את ה-build החדש.
- לחיצה על "עדכן עכשיו" במכשיר אנדרואיד → התקנה של APK חדש מהשרת.
- הגדרת `min_supported_version=1.0.2` → אפליקציה בגרסה `1.0.1` מציגה modal חסימה ולא מאפשרת המשך שימוש עד עדכון.
- ללא חיבור לאינטרנט / שרת לא זמין → לא מציג שום הודעה (silent fail, האפליקציה ממשיכה כרגיל).

**משימה 60: חזרה למסך אחזור קופה אחרי גביה מוצלחת** — 🔄 בביצוע
- **באג / שינוי UX:** היום אחרי שיוך מעטפה מוצלח ב-[ScanPage.jsx](frontend-collector/src/pages/ScanPage.jsx) האפליקציה חוזרת ל-`/collection/:cardId` (תצוגת אותה קופה ספציפית). הגובה רוצה לעבור מיד לקופה הבאה — להזין מספר חדש בטופס האחזור.
- **התיקון ב-[ScanPage.jsx](frontend-collector/src/pages/ScanPage.jsx):**
  - בפונקציה `confirmEnvelope` — אחרי `envelopesApi.create(...)` המוצלח, שנה את `navigate(\`/collection/\${cardId}\`, { state: { toast: ... } })` ל-`navigate('/collection', { state: { toast: ... } })`.
  - ה-`handleClose` (כפתור X בסורק ללא שיוך מעטפה) **לא** משתנה — נשאר עם הזרימה הקיימת (`/collection/:cardId` אם הגיעו מתצוגת קופה, או `/collection` אם הגיעו מאחזור ידני).
- **תצוגת toast במסך אחזור הקופה:** [CollectionPage.jsx:58-65](frontend-collector/src/pages/CollectionPage.jsx#L58-L65) כבר תומך ב-`location.state.toast` בשני המצבים (`cardId` או בלי), אז הודעת ההצלחה ("שיוך מעטפה מס׳ X") תוצג כתקין גם במסך האחזור.
- **APK + גרסה חדשה:** bump גרסת `frontend-collector/package.json` והעלאה לשרת 178.105.96.70 דרך `npm run release` (משימה 59).
- אימות:
  - שיוך מעטפה מוצלח (סריקה או ידני) → מעבר ל-`/collection` (טופס אחזור) עם toast "שיוך מעטפה מס׳ X".
  - לחיצה על X בסורק ללא סריקה → ההתנהגות הקיימת נשמרת (חוזר לקופה אם הגיעו ממנה, אחרת לאחזור).
  - APK חדש זמין בשרת ומשתמשים בגרסה ישנה רואים הודעת עדכון.

---

## ✅ הושלם
(ריק)

## ❌ נכשל / חסום
(ריק)


