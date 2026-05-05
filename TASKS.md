# משימות לתיקון - Kupot Project

> קובץ זה מנהל רשימת תיקונים ומשימות לפרויקט.
> Claude יבצע משימה אחת בכל פעם, יעדכן את הסטטוס, וימשיך הלאה.

---

## הוראות שימוש (לקלוד)

**בכל סשן חדש שמתבקש "המשך משימות" / "בצע משימות" / "המשך מהקובץ":**

1. קרא את הקובץ הזה במלואו
2. מצא את **המשימה הראשונה ב-`## ⏳ ממתינות`**
3. העבר אותה ל-`## 🔄 בביצוע` עם תאריך התחלה
4. בצע אותה במלואה (כולל בדיקה שעובדת)
5. העבר אותה ל-`## ✅ הושלמו` עם:
   - תאריך סיום
   - סיכום קצר של מה שנעשה (1-2 שורות)
   - קישור לקבצים ששונו
6. עבור למשימה הבאה — אל תעצור עד שאין יותר משימות, אלא אם נתקלת בבעיה שדורשת החלטה.

**חשוב:**
- אל תוסיף משימות חדשות בעצמך אלא אם המשתמשת ביקשה.
- אם משימה לא ברורה — סמן אותה כ-`❓ דורש הבהרה` ועבור לבאה.
- אם נכשלת במשימה — סמן `❌ נכשל` עם סיבה ועבור לבאה.

---

## ⏳ ממתינות

---

## 🔄 בביצוע

---

## ✅ הושלמו

<!-- פורמט:
### [שם המשימה] — YYYY-MM-DD
**מה נעשה:** סיכום קצר
**קבצים ששונו:** רשימה
-->

### 28. דוחות השוואה — עמודות זו לצד זו במקום אנכי — 2026-05-05
**מה נעשה:** ב-`DochotPage.jsx` (לשונית "השוואה") ה-JSX היה בנוי נכון מבחינה סמנטית — `<div className="compare-cols">` עוטף `<div className="compare-col">` לכל עמודה ועוד `<div className="add-compare-col">` בסוף — אבל **אף אחת מ-classes האלה לא הייתה מוגדרת ב-`index.css`**. בלי flex/grid כל `<div>` קיבל `display: block` כברירת מחדל, וכל פרמטר וכל עמודה תפסו 100% רוחב ונערמו לאורך אנכית במקום זה לצד זה.

הוספתי בלוק חדש "===== COMPARE COLUMNS =====" בסוף `index.css` עם:
- `.compare-cols` — `display: flex; flex-wrap: wrap; gap: 14px; align-items: stretch` — מסדר את העמודות זו לצד זו, עם wrap למסכים צרים. ה-`direction: rtl` הגלובלי על ה-`body` כבר דואג שעמודה 1 תוצב מימין ועמודה 2 משמאלה, וכן הלאה — בדיוק כמו בצילום שהמשתמשת שלחה.
- `.compare-col` — `flex: 0 0 220px` (רוחב קבוע, לא צמוח לא מתכווץ), רקע `--surface`, גבול, רדיוס, צל, ופנים `flex-direction: column` כדי שהשדות (`.field`) ייערמו אנכית בתוך כל עמודה. על `.compare-col .field` הוספתי `width: 100%` כדי שהשדות יתפסו את כל רוחב העמודה (בלי זה, כל field היה צמוד לתוכן הקצר ביותר).
- `.col-header` — flex עם `justify-content: space-between` ל"עמודה N" + ה-✕ ; טיפוגרפיה uppercase בצבע `--accent`.
- `.col-val` — 22px bold ל-"₪42,100" וכו׳; `.col-lbl` — 12px `--text2` לתוויות "סה"כ גביה" / "מעטפות" / "ממוצע לקופה".
- `.add-compare-col` — אותו רוחב 220px, רקע `--surface2`, גבול מקווקו 2px, hover שמשנה ל-`--accent-soft` עם גבול accent — כמו תיבת ה-"+ הוסף עמודה" בצילום.

כל השדות (תקופה, חודש/שנה, עיר, שכונה, גובה, סוג קופה, קופה ספציפית, שם מותאם, מעוניין בקבלה) נשארים גלויים גם אחרי "הפק" — בהתאם להוראת המשתמשת ("הכל ישאר גלוי"). הסטטיסטיקות מוצגות מתחתיהם באותה עמודה. אין שינוי ב-JSX או בלוגיקה — שינוי CSS בלבד.

**מספר טסטים:** Build של frontend-admin עובר ללא שגיאות (82 modules, 1.09s).

**קבצים ששונו:**
- frontend-admin/src/index.css (בלוק חדש "===== COMPARE COLUMNS =====" עם 8 selectors: `.compare-cols`, `.compare-col`, `.compare-col .col-header`, `.compare-col .field`, `.compare-col .col-val`, `.compare-col .col-lbl`, `.add-compare-col`, `.add-compare-col:hover`)

---

### 26. הזנת עיר/שכונה/רחוב — autocomplete היררכי מתוך ערכים קיימים — 2026-05-05
**מה נעשה (חלק א' — endpoint חדש בבק-אנד):** הוספתי ל-`backend/src/routes/cards.js` נתיב חדש `GET /api/cards/locations` שמחזיר ערכי `DISTINCT` של עמודה אחת (`city` / `neighborhood` / `street`) מטבלת `cards`, מסונן ב-`btrim(...) <> ''` כדי להחליף שורות עם רווחים בלבד, וממוין אלפביתית. ה-endpoint דורש `level` (אחד משלושת הערכים) ובמקרה של `neighborhood`/`street` גם `city` (אחרת `400`). ב-`level=street` אפשר להעביר גם `neighborhood` כדי לסנן הלאה. הסכמה משתמשת בפרמטרים מנוסחים (`$1`, `$2`) ולא ב-string concatenation, אז אין SQL-injection. **קריטי:** רשמתי את הנתיב **לפני** `GET /:id` הקיים — אחרת '/locations' היה נתפס כ-`id="locations"` ומחזיר `400 Invalid id`.

**חלק ב' — endpoint ב-API client:** ב-`frontend-admin/src/api/endpoints.js` הוספתי לאובייקט `cards` את המתודה `locations(params)` שעוטפת `api.get('/cards/locations', params)`.

**חלק ג' — רכיב `<LocationCombobox>` חדש:** קובץ חדש `frontend-admin/src/components/LocationCombobox.jsx`. דפוס ה-UX מקביל ל-`BoxNumberAutocomplete` (ממשימה 25): `<input>` חופשי + רשימת `<ul role="listbox">` נפתחת מתחת. ההבדלים העיקריים:
- **קלט חופשי לחלוטין** — בניגוד ל-`BoxNumberAutocomplete` שמסנן ל-digits, פה אין סינון על הקלט (האדם יכול להקליד עיר/רחוב חדש שלא קיים).
- **lazy fetch של הפול** — ב-`useEffect` שתלוי ב-`level`/`city`/`neighborhood` קוראים ל-`cardsApi.locations(...)`. כש-`level !== 'city'` ועוד אין עיר נבחרת, ה-effect מדלג על הקריאה (כדי לא לקבל `400` בכל פתיחת מודאל לפני שהמשתמש בחר עיר).
- **סינון לקוח-צד** — אחרי קבלת הפול מהשרת, סינון ה-substring בזמן הקלדה נעשה ב-frontend בלבד (`String.includes`, case-insensitive). הפול לרוב קטן (כמה עשרות עד מאות פריטים), אז אין צורך ב-debounce/בקשת רשת לכל הקלדה.
- **רשימה נפתחת בעת focus גם בלי טקסט** — אם המשתמש לוחץ על השדה הריק, ה-dropdown נפתח עם כל הפול (capped ב-`maxResults=50`) כדי שאפשר יהיה לדפדף גם בלי לדעת מה להקליד.
- **חיווי "ערך חדש"** — אם הפול לא ריק אבל הטקסט שהמשתמש הקליד לא תואם לאף ערך, מוצג קופסה דקה מתחת ל-input "ערך חדש — לא קיים במערכת". זה הרמז הויזואלי שאמור לעודד את המשתמש לבחור ערך קיים אם הוא מתכוון לאותו מקום, או להמשיך אם זה באמת מקום חדש.
- **ניווט מקלדת** — `ArrowDown`/`ArrowUp` להזזת ההדגשה, `Enter` לבחירה, `Escape` לסגירה. סגירה אוטומטית בלחיצה מחוץ ל-wrapper (`mousedown` listener על document).

**חלק ד' — החלפת השדות הקיימים בכל המקומות הרלוונטיים:** מצאתי באמצעות `Grep` שלוש מקומות *שמזינים* בהם ערך לעיר/שכונה/רחוב (להבדיל מהצגה בלבד או סינון `<select>` בלבד):

1. **`frontend-admin/src/components/TaskExecModal.jsx`** — אישור ביצוע משימה שפותחת כרטסת (installation/transfer). שלושת ה-`<input>`-ים (`עיר *`, `שכונה`, `רחוב`) הוחלפו ב-`<LocationCombobox>` עם השרשור ההיררכי הנכון: `city` עצמה ב-level עיר, השכונה מקבלת `city={newCity}` כדי שתסונן, הרחוב מקבל גם `city={newCity}` וגם `neighborhood={newNeighborhood}`. שדה ה`מספר/בניין` נשאר input רגיל — אין שם בעיית הטיות (זה מספר/חניה/מבנה).
2. **`frontend-admin/src/pages/CardDetailPage.jsx`** — מצב עריכה של כרטסת קיימת (אדמין). אותם שלושה שדות הוחלפו, עם `value` מתוך `form.city/neighborhood/street` ו-`onChange` שקורא ל-`updateForm(...)`. השרשור ההיררכי דרך הערכים שב-`form` (לא דרך state נפרד), כך שאם המשתמש משנה עיר תוך כדי עריכה — רשימת השכונות מתעדכנת אוטומטית מהאפקט שב-`<LocationCombobox>`.
3. **`frontend-admin/src/components/UserModal.jsx`** — `RulesEditor` ש-built בו רשימת חוקי הקצאה (area_assignments) ורשימת חוקי החרגה (area_exclusions) למשתמש. זה מקום *קריטי* כי החוקים האלה צריכים להתאים בדיוק לערכי העיר/שכונה/רחוב שמופיעים בכרטסות (אחרת כלל ההקצאה לא תופס את הקופה). שלושת ה-`<input>` הוחלפו ב-`<LocationCombobox>` באותה שרשרת היררכית. השדות `בנין` ו-`מס׳ קופה` (שניהם מספרים) נשארו `<input>` רגיל.

**מקומות שלא נגעתי בהם בכוונה:**
- `CardsPage.jsx` — שם יש `<select value={city}>` שזה *סינון* של הטבלה, לא הזנה. הוא כבר מציג ערכים DISTINCT מתוך `allCards` ולכן אין שם בעיית כפילויות. החלפה ל-combobox היא משימת UX נפרדת ולא הייתה במשימה 26.
- `TaskModal.jsx` — לא מחזיק שדות עיר/שכונה/רחוב כקלט; הוא רק *מציג* את כתובת הכרטסת הפעילה (`activeCardAddress`). אין מה להחליף.
- שדות `card.city` שמופיעים ב-`ReportModal`, `CashroomModal`, `EnvelopesPage`, `DochotPage`, `AlertsPage` וכו׳ — כל אלה הם *תצוגה* של ערך שכבר נשמר בכרטסת, לא קלט. אין מה להחליף.

**מספר טסטים:** 46/46 unit tests עוברים (`backend/`). הbuild של frontend-admin עובר ללא שגיאות (82 modules, 1.10s — מודול אחד נוסף לעומת הbuild של משימה 24).

**קבצים ששונו:**
- backend/src/routes/cards.js (נתיב חדש `GET /api/cards/locations` — DISTINCT עם סינון היררכי, רשום לפני `/:id`)
- frontend-admin/src/api/endpoints.js (`cards.locations(params)`)
- frontend-admin/src/components/LocationCombobox.jsx (קובץ חדש — combobox עם input חופשי + dropdown מהפול שהוחזר מהשרת + ניווט מקלדת + חיווי "ערך חדש")
- frontend-admin/src/components/TaskExecModal.jsx (3 inputs → 3 LocationCombobox עם שרשור היררכי `city → city+neighborhood`)
- frontend-admin/src/pages/CardDetailPage.jsx (3 inputs במצב עריכה → 3 LocationCombobox)
- frontend-admin/src/components/UserModal.jsx (3 inputs ב-`RulesEditor` → 3 LocationCombobox)

---

### 24. אפשרות להוסיף תמונה בדיווח אירוע — 2026-05-05
**מה נעשה:** הבק-אנד כבר תמך מלא ב-`reports.image_path` (העמודה קיימת ב-`backend/src/db/schema.sql:200`, ו-`POST /api/reports` מקבל ומאמת `image_path` כ-`string|null` ב-`backend/src/routes/reports.js:100,105-107,140-147`). מה שחסר היה רק ה-frontend.

הוספתי ל-`ManualReportModal.jsx` את אותו דפוס בדיוק שכבר קיים ב-`TaskModal` (ממשימה 21) וב-`TaskExecModal` (ממשימה 22): שני `useRef` (`fileInputRef`, `cameraInputRef`), שני כפתורים גלויים (📁 צרף קובץ + 📷 צלם עכשיו), שני inputs נסתרים (אחד `accept="image/jpeg,image/png,image/webp"` רגיל, אחד `accept="image/*" capture="environment"` למצלמה אחורית במובייל), state `imageFile`/`imagePreview`, handler `onPickImage` עם validation של MIME, תצוגה מקדימה דרך `URL.createObjectURL` עם cleanup ב-`useEffect`, וכפתור "בטל בחירה". ב-`handleSubmit`, אם יש קובץ נבחר אני קודם מעלה אותו דרך `uploadsApi.image(file)` ואז שולח את ה-`path` שחזר כ-`body.image_path` ב-`reportsApi.create()`. ההעלאה קורית רק אחרי שעברו ולידציות (`canSubmit` — תיאור לא ריק וכרטסת נבחרה אם לא locked) כדי לא להעלות קבצים שלא ייקשרו.

**תוספת — תצוגת התמונה השמורה:** ב-`ReportModal.jsx` (המודאל שצופה/עורך דיווח קיים) הוספתי בלוק קטן שמציג את `report.image_path` עם תמונה בגודל מתאים (`maxHeight: 200`) עטופה ב-`<a target="_blank">` שמאפשר ללחוץ ולהגדיל בכרטיסייה חדשה. זה מסתמך על אותו פרוקסי שתוקן במשימה 22 (`/uploads` → `localhost:3000` ב-`vite.config.js`), אז ב-dev התמונה נטענת בלי 404.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות (79 modules, 1.10s).

**קבצים ששונו:**
- frontend-admin/src/components/ManualReportModal.jsx (image picker — 2 refs + 2 כפתורים גלויים + 2 hidden inputs + state + onPickImage + העלאה לפני submit + שליחת `image_path`)
- frontend-admin/src/components/ReportModal.jsx (תצוגת `report.image_path` כתמונה לחיצה לפתיחה בכרטיסייה חדשה)

---

### 23. תיקון 2 דברים אחרונים בתצוגת משימות — תמונת המשימה + שבירת שורות — 2026-05-05
**מה נעשה (חלק א' — הצגת תמונת המשימה ב-`TaskExecDetailsModal`):** עד עכשיו החלון "פרטי ביצוע" הציג רק את `task.execution_image` (התמונה שהגובה צירף בעת אישור הביצוע — ממשימה 22). התמונה שמנהל מצרף בעת *יצירת* המשימה (`task.image_path` — ממשימה 7) לא הוצגה בכלל אחרי שהמשימה הועברה ל-`done`/`cancelled`. ה-`SELECT t.*` ב-`GET /api/tasks` כבר מחזיר את `image_path`, אז זו הייתה רק חוסר רנדור ב-frontend. הוספתי ל-`TaskExecDetailsModal.jsx` שתי סקציות "תמונה" נפרדות: (1) "תמונת המשימה" שמציגה את `image_path` (או טקסט "לא צורפה תמונה למשימה" כשאין), (2) הסקציה הקיימת קיבלה תווית מותאמת — "תמונת אישור ביצוע" (או "תמונת ביצוע" כשהמשימה בוטלה) — ומציגה את `execution_image`. כל תמונה עטופה כמו קודם ב-`<a target="_blank">` כדי לפתוח בגודל מלא.

**מה נעשה (חלק ב' — שבירת שורות):** היו שני גורמים נפרדים לשבירת שורות בטבלאות המשימות, ושניהם תוקנו:

1. **כפתורי הפעולה עטפו לשתי שורות** — בשורת משימה במצב `open`/`in_progress` (לאדמין), שלושת הכפתורים (פרטים + אישור ביצוע + 🚫 בטל) לא נכנסו לרוחב ה-cell, וכוון ש-`.actions` ב-`index.css:191` מוגדר כ-`display: flex; flex-wrap: wrap;`, הם עטפו. התיקון: על שני ה-cells של `<td className="actions">` בטבלאות המשימות הוספתי inline override `style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}`. זה משאיר את ה-`flex-wrap: wrap` הדיפולטי לכל שאר ה-`.actions` במערכת (footers של מודאלים, page-header — שם הוא רצוי), ומונע wrap רק בעמודת הפעולות של טבלאות המשימות. ה-`table-wrap` שכבר עוטף את הטבלה (`overflow-x: auto`) יטפל באוברפלו אם המסך צר מאוד.

2. **שורה משנית "סיבה: X" מתחת ל-pill "בוטל"** (תוקן בפידבק חוזר של המשתמשת) — ממשימה 20 הוספתי `<div>` עם `marginTop: 4` שהציג את `cancellation_reason` מקוצץ ל-200px מתחת לתווית הסטטוס. זה הוסיף שורה אנכית לכל שורת משימה מבוטלת והפך אותה לגבוהה מהאחרות, גם אחרי תיקון 1. אחרי שמשימה 19 הפכה את שורות הטבלה ל-clickable (פתיחת `TaskExecDetailsModal` עם הצגה מלאה של `cancellation_reason` ברקע אדום-רך) — הצגת ה-reason המקוצץ הפכה לכפילות ויזואלית. הסרתי את ה-`<div>` משני המקומות (`TasksPage` + `cardTabs/TasksTab`). ה-`title` (tooltip) על ה-pill נשמר לגישה מהירה ב-hover, וה-detail המלא נשאר זמין במודל הפרטים בלחיצה על השורה.

**חלק ג' — אותם שני תיקונים גם בטבלאות הדיווחים** (תוקן בפידבק נוסף של המשתמשת): המשתמשת ביקשה להחיל את אותו תיקון גם ב-`ReportsPage` וב-`cardTabs/ReportsTab`, ששם היה דפוס זהה — `<div>` עם "סיבה: X" מתחת ל-pill "סגור" (`closure_reason` ממשימה 20), ו-`flex-wrap: wrap` בעמודת הפעולות (ב-`ReportsPage` יש שני כפתורים בדיווח פתוח: "טיפול / המרה" + "🚫 סגור דיווח" — שעטפו לשתי שורות לאדמין). הסרתי את ה-`<div>` משני המקומות (ה-tooltip על ה-pill נשמר; הסיבה המלאה זמינה ב-`ReportModal` בלחיצה על השורה — שדה "סיבת סגירה" עם רקע ייעודי שכבר קיים ממשימה 20). הוספתי `flexWrap: 'nowrap', whiteSpace: 'nowrap'` ל-cells של עמודת הפעולות + שיניתי את ה-`flexWrap` ב-`<div>` הפנימי של ReportsPage מ-`'wrap'` ל-`'nowrap'` כדי שהשני כפתורים יישארו באותה שורה.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות (79 modules, 1.12s).

**קבצים ששונו:**
- frontend-admin/src/components/TaskExecDetailsModal.jsx (פיצול ל-2 סקציות תמונה — `image_path` ו-`execution_image` — עם תוויות מובחנות)
- frontend-admin/src/pages/TasksPage.jsx (אוברייד `flexWrap: nowrap` על td.actions + הסרת השורה המשנית "סיבה: X" מתחת ל-pill)
- frontend-admin/src/pages/cardTabs/TasksTab.jsx (אותם שני שינויים)
- frontend-admin/src/pages/ReportsPage.jsx (הסרת "סיבה: X" מתחת ל-pill "סגור" + `flexWrap: nowrap` על td.actions ועל ה-`<div>` הפנימי שעטף את שני הכפתורים)
- frontend-admin/src/pages/cardTabs/ReportsTab.jsx (הסרת "סיבה: X" מתחת ל-pill "סגור" + `whiteSpace: nowrap` על td הפעולות)

---

### 22. תיקון 2 דברים במשימות — צירוף תמונה באישור ביצוע + תיקון תצוגת תמונה — 2026-05-05
**מה נעשה (חלק א' — צירוף תמונה ב-`TaskExecModal`):** עד עכשיו רק ב-`TaskModal` (יצירת/עריכת משימה — ממשימה 7) הייתה אפשרות להעלות תמונה ל-`tasks.image_path`. ב-`TaskExecModal` (אישור ביצוע) שדה `execution_image` כבר היה קיים ב-DB ובלוגיקת `completeTask` (`backend/src/logic/cardLogic.js:166` — שולף `execution_image` מה-body ושומר ב-`UPDATE tasks SET ... execution_image=$2`), אבל ה-frontend לא שלח אותו. הוספתי ל-modal את אותו דפוס שכבר קיים ב-`TaskModal` (ממשימה 21): שני `useRef` (`fileInputRef`, `cameraInputRef`), שני כפתורים גלויים (📁 צרף קובץ + 📷 צלם עכשיו), שני inputs נסתרים (אחד `accept="image/jpeg,image/png,image/webp"` רגיל, אחד `accept="image/*" capture="environment"` למצלמה אחורית במובייל), state `imageFile`/`imagePreview`, handler `onPickImage` עם validation של MIME, תצוגה מקדימה דרך `URL.createObjectURL` עם cleanup ב-`useEffect`, וכפתור "בטל בחירה". ב-`handleSubmit`, אם יש קובץ נבחר אני קודם מעלה אותו דרך `uploadsApi.image(file)` ואז שולח את ה-`path` שחזר כ-`body.execution_image` ב-`tasks.complete()`. ההעלאה קורית רק אחרי שעברו ולידציות (`needsLocation && !newCity`) כדי לא להעלות קבצים שלא ייקשרו. ה-`useEffect` שמאפס את הטופס בעת פתיחה מאפס גם את ה-image state, כך שמעבר בין משימות לא משאיר תמונה ישנה.

**מה נעשה (חלק ב' — תיקון תצוגת התמונה):** התסמין שתוארה ("ריבוע שהוא קישור למיקום של התמונה") היה תמונה שבורה — `<img>` נטען ל-404. הסיבה: ב-`uploads.js:15` ה-backend מחזיר `path: '/uploads/<filename>'` (path יחסי), והתמונה מוגשת סטטית מ-`backend/src/index.js:40` (`app.use('/uploads', express.static(...))`) על port 3000. אבל ה-`TaskExecDetailsModal` (וגם `TaskModal`) רינדרו `<img src={task.execution_image}>` שמתפרש על-ידי הדפדפן יחסית למקור הנוכחי — ב-dev הקבצים ב-frontend (port 5173) אבל ה-`vite.config.js` proxy רק היה מסונן ל-`/api`, ו-`/uploads` לא היה מתפרש לבק-אנד → 404 (או fallback HTML של ה-SPA) → תמונה שבורה.

התיקון הוא הוספת entry שני ל-Vite proxy: `'/uploads': { target: 'http://localhost:3000', changeOrigin: true }`. עכשיו כל בקשת תמונה מ-`/uploads/<filename>` ב-dev עוברת לבק-אנד ומקבלת את הקובץ הסטטי. בפרודקשן הדפוס לא משתנה — אם ה-backend וה-frontend נמצאים על אותו origin (או מאחורי reverse proxy) אז `<img src="/uploads/...">` עובד ישירות.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות (79 modules, 1.10s).

**קבצים ששונו:**
- frontend-admin/src/components/TaskExecModal.jsx (image picker — 2 refs + 2 כפתורים גלויים + 2 hidden inputs + state + onPickImage + העלאה לפני submit + שליחת `execution_image`)
- frontend-admin/vite.config.js (entry חדש בפרוקסי: `/uploads` → `localhost:3000` כדי שתמונות סטטיות יוגשו דרך ה-Vite dev server)

---

### 21. צירוף תמונה ביצירת משימה — כפתור צילום ישיר במצלמה — 2026-05-05
**מה נעשה:** במשימה 7 כבר נוסף שדה `<input type="file">` רגיל ב-`TaskModal.jsx` שמאפשר העלאת קובץ תמונה. עכשיו, בנוסף לבחירת קובץ קיים, הוספתי גם אפשרות לפתיחת המצלמה וצילום ישיר.

המימוש: הוספתי שני `useRef` (`fileInputRef`, `cameraInputRef`) והחלפתי את ה-input הגלוי היחיד בזוג כפתורים גלויים + שני inputs נסתרים (`display: none`):
- **📁 צרף קובץ** — לוחץ על input רגיל (`accept="image/jpeg,image/png,image/webp"`).
- **📷 צלם עכשיו** — לוחץ על input עם `capture="environment"` (`accept="image/*"`). על מובייל הדפדפן פותח את המצלמה האחורית ישירות; על דסקטופ עם webcam, הדפדפן עשוי להציע שימוש במצלמה. ה-`accept="image/*"` רחב יותר כי מצלמות שונות מחזירות mime types שונים — הוולידציה עצמה (regex של JPEG/PNG/WEBP ב-`onPickImage`) נשארה כפי שהייתה כדי להתאים לבדיקת ה-backend.

שני ה-inputs משתמשים באותו handler `onPickImage` הקיים, כך שהתצוגה המקדימה (`URL.createObjectURL`), ה-cleanup, מחיקת התמונה, וההעלאה בעת submit כולם פועלים ללא שינוי בלוגיקת ה-state. הכפתורים נמצאים בתוך `flex` עם `gap` ו-`flex-wrap` כדי שיתחלקו יפה גם במסכים צרים.

**קבצים ששונו:**
- frontend-admin/src/components/TaskModal.jsx (שני refs + שני כפתורים גלויים + שני hidden inputs — אחד רגיל ואחד עם `capture="environment"`)

---

### 20. הצגת סיבת סגירה/ביטול + כפתור "סגור דיווח" בהתראות — 2026-05-05
**מה נעשה (חלק א' — שמירה והצגת סיבה):** בחרתי בפתרון הנקי שצוין בהמלצה — הוספתי שתי עמודות חדשות ב-DB: `tasks.cancellation_reason TEXT` ו-`reports.closure_reason TEXT`, גם בהגדרת הטבלאות הראשונית וגם כ-`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` בסוף `schema.sql` (אידמפוטנטי). הרצתי `node scripts/runSql.js src/db/schema.sql` על המסד החי כדי להחיל. עדכנתי את `POST /api/tasks/:id/cancel` כך שיכתוב את `trimmedReason || null` גם ל-`tasks.cancellation_reason` (במקביל לאירוע `task_cancelled` שכבר נוצר — שמירת ה-event לא נפגעה). עדכנתי את `POST /api/reports/:id/close` באותו אופן ל-`reports.closure_reason`. שתי העמודות נכללות אוטומטית בכל ה-`SELECT t.*` / `SELECT r.*` הקיימים ב-`routes/tasks.js` ו-`routes/reports.js`, אז ה-frontend מקבל אותן ללא שינוי נוסף ב-API.

ב-frontend עדכנתי 5 מקומות שמציגים סטטוס `cancelled` / `closed`:
- `TasksPage.jsx` — מתחת ל-pill של "בוטל" מוצגת שורה קטנה "סיבה: ..." (truncate ב-200px), עם tooltip מלא על ה-pill.
- `cardTabs/TasksTab.jsx` — אותו דפוס תחת ה-pill בטבלת המשימות של הכרטסת.
- `TaskExecDetailsModal.jsx` — כשהמשימה `cancelled`, הכותרת משתנה ל-"פרטי ביטול", התאריך משתנה ל-"בוטלה ב-...", ומוצג שדה ייעודי "סיבת ביטול" עם רקע אדום-רך (`var(--red-soft)`) או "לא צוינה סיבה" כש-`cancellation_reason` ריק. הערות הביצוע נשארו כפי שהיו.
- `ReportsPage.jsx` — אותו דפוס שורת "סיבה: ..." מתחת ל-pill "סגור" + tooltip.
- `cardTabs/ReportsTab.jsx` — אותו דפוס.
- `ReportModal.jsx` — כשהדיווח `closed` מוצג שדה "סיבת סגירה" מעל סטטוס/תיאור (גם כשהדיווח גם הומר וגם נסגר — מוצג בנוסף ל-info של "כבר הומר").

**מה נעשה (חלק ב' — כפתור "סגור דיווח" בהתראות):** ב-`AlertsPage.jsx` הוספתי import של `CloseReportModal` ו-`useAuth`, state חדש `closeReport` (לדיווח שעומד להיסגר) ו-`reloadCounter` שמרענן את ה-effect של טעינת הנתונים. הוספתי כפתור "🚫 סגור דיווח" (`btn sm danger`) לצד הכפתור הקיים "טיפול" בעמודת הפעולות של פאנל הדיווחים — מוצג רק ל-admin, וכל הדיווחים בפאנל הזה כבר מסוננים ל-`status='open'` (load קוראת `reportsApi.getAll({ status: 'open' })`). אחרי סגירה, `onClosed` מעדכן את הדיווח in-place (`handleReportSaved` שכבר מסיר דיווחים שאינם `open`) וגם מקדם את ה-`reloadCounter` כדי לרענן את ה-state במלואו (כולל פאנל הקופות אם יש קשר).

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות (79 modules, 1.04s).

**קבצים ששונו:**
- backend/src/db/schema.sql (עמודות `tasks.cancellation_reason` ו-`reports.closure_reason` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` אידמפוטנטי בסוף הקובץ)
- backend/src/routes/tasks.js (UPDATE של cancellation_reason ב-`POST /:id/cancel`)
- backend/src/routes/reports.js (UPDATE של closure_reason ב-`POST /:id/close`)
- frontend-admin/src/pages/TasksPage.jsx (תצוגת "סיבה: ..." מתחת ל-pill עבור משימות `cancelled` + tooltip)
- frontend-admin/src/pages/cardTabs/TasksTab.jsx (אותו דפוס בטבלת המשימות של הכרטסת)
- frontend-admin/src/components/TaskExecDetailsModal.jsx (כותרת/תאריך מותאמים ל-cancelled + שדה "סיבת ביטול")
- frontend-admin/src/pages/ReportsPage.jsx (תצוגת "סיבה: ..." מתחת ל-pill עבור דיווחים `closed` + tooltip)
- frontend-admin/src/pages/cardTabs/ReportsTab.jsx (אותו דפוס בטבלת הדיווחים של הכרטסת)
- frontend-admin/src/components/ReportModal.jsx (שדה "סיבת סגירה" כשהדיווח `closed`)
- frontend-admin/src/pages/AlertsPage.jsx (כפתור "🚫 סגור דיווח" admin-only בפאנל דיווחים פתוחים + state ו-handler + reloadCounter + CloseReportModal)

---

### 19. שורות ככפתורי-לינק שפותחים את החלון של הפריט — 2026-05-05
**מה נעשה:** הפכתי שורות בשלוש טבלאות לקליקביליות, בהתאם לדפוס שכבר היה ב-`CardsPage` (`<tr className="clickable">` עם `cursor: pointer` ו-hover שמוגדרים ב-`index.css`). בכל מקרה הוספתי גם `role="button"`, `tabIndex={0}` ו-`onKeyDown` לתמיכה ב-Enter/Space לשם נגישות. כפתורי הפעולה הקיימים בכל טבלה עוטפו ב-`e.stopPropagation()` כדי שלחיצה עליהם לא תפעיל את לינק השורה.

**חלק א' — `cardTabs/TasksTab.jsx`:** לחיצה על שורת משימה פותחת את חלון המשימה. למשימות שהושלמו/בוטלו (`done`/`cancelled`) — נפתח `TaskExecDetailsModal` (read-only, מציג הערות ביצוע + תמונה). למשימות `open`/`in_progress` — נפתח `TaskModal` במצב עריכה. הוספתי state חדשים `editTask` ו-`detailsTask`, helper `openTask(t)` שבוחר את המודאל המתאים לפי הסטטוס, ו-`handleTaskSaved` שמעדכן את הרשימה in-place אחרי שמירה. כפתור "🚫 בטל" בעמודת הפעולות עוטף ב-`stopPropagation`.

**חלק ב' — `cardTabs/ReportsTab.jsx`:** לחיצה על שורת דיווח פותחת את `ReportModal` הקיים (זה שכבר משמש ב-`ReportsPage` — מציג סוג, תיאור, סטטוס, מדווח, תאריך, ותומך גם בעריכת סטטוס/תיאור והמרה למשימה). לכן לא נדרש מודאל חדש (`ReportDetailModal`) — `ReportModal` כיסה את כל הדרישות. הוספתי state `openReport` ו-handler `handleReportSaved` שמעדכן את הרשימה in-place. כפתור "🚫 סגור דיווח" בעמודת הפעולות עוטף ב-`stopPropagation`. אחרי סגירה, `setReloadCounter` מרענן את הרשימה כדי לטעון מחדש מהשרת (כי הסטטוס משתנה ל-`closed` ויש אירוע חדש).

**חלק ג' — `BoxesPage.jsx` טאב "כרטסות פעילות":** השורה כולה הופכת לקליקבילית רק אם יש `active` card לקופה (אם אין — אין לאן לנווט). הקליק/Enter/Space מנווטים ל-`/cards/:cardId` של הכרטסת הפעילה. תווית הכרטסת בעמודה ("כרטסת פעילה") קיבלה צבע `var(--accent)` כדי לסמן ויזואלית שהיא לינק. שני הכפתורים בעמודת הפעולות ("🚫 סמן כלא שמישה" ו-"📇 עבור לתצוגת כרטסת") עוטפים את ה-handler ב-`e.stopPropagation()` כך שלא יפעילו את ה-onClick של השורה.

**הערה לעיצוב:** משתמש בקלאס `clickable` הקיים מ-`index.css` (שורה 202: `tr.clickable { cursor: pointer; transition: background .15s; }` + hover state) — אין צורך בסטיילים חדשים.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות (79 modules, 988ms).

**קבצים ששונו:**
- frontend-admin/src/pages/cardTabs/TasksTab.jsx (שורות clickable + a11y + שני state חדשים + פתיחת TaskModal/TaskExecDetailsModal לפי הסטטוס + stopPropagation על "בטל")
- frontend-admin/src/pages/cardTabs/ReportsTab.jsx (שורות clickable + a11y + state openReport + שילוב ReportModal הקיים + stopPropagation על "סגור דיווח")
- frontend-admin/src/pages/BoxesPage.jsx (טאב "כרטסות פעילות": שורות clickable מותנות ב-active + a11y + ניווט ל-/cards/:cardId + stopPropagation על שני הכפתורים + צבע accent על תווית הכרטסת)

---

### 18. אפשרות לסגירת דיווח ללא המרה למשימה — 2026-05-05
**מה נעשה:** הוספתי `EVENT.REPORT_CLOSED = 'report_closed'` ב-`cardLogic.js` (אוטומטית מתווסף ל-`ALLOWED_TYPES` של `POST /api/events` כי הוא נגזר מ-`Object.values(EVENT)`). הוספתי endpoint חדש `POST /api/reports/:id/close` (admin only) ב-`routes/reports.js` שעובד בתוך טרנזקציה: `SELECT ... FOR UPDATE` על הדיווח, ולידציה שהסטטוס לא `closed` (409 — "Report is already closed") ולא `converted` (409 — "Report has been converted to a task"), עדכון הסטטוס ל-`closed`, ויצירת אירוע `report_closed` ב-`events` המקושר ל-`card_id` של הדיווח עם תיאור עברי בפורמט `"סגירת דיווח: <reason>"` (או `"סגירת דיווח"` בלי הסיבה אם לא ניתנה). 404 חוזר אם הדיווח לא נמצא.

**הערה להבהרה:** הדרישות כללו "admin (ואולי גם collector על דיווחים שלו — דורש הבהרה)" — בחרתי בגישה הבטוחה של admin only. אם יוחלט בעתיד לאפשר גם ל-collector, יש להוסיף בדיקת בעלות (`reported_by === req.user.id`) ולשנות את ה-middleware ל-`requireRole('admin', 'collector')`.

ב-frontend הוספתי `reports.close(id, reason)` ל-`endpoints.js` (POST עם body `{ reason: reason || null }`). יצרתי קומפוננטה חדשה `CloseReportModal.jsx` במקביל לדפוס של `CancelTaskModal` — עם כותרת "סגירת דיווח", שדה `textarea` אופציונלי לסיבה, אזהרת info שמסבירה שתיווצר רשומת אירוע, וכפתור `btn danger` "🚫 סגור דיווח". המודאל מקבל את הדיווח ומפעיל `reportsApi.close()` בעצמו, ואחרי הצלחה קורא ל-`onClosed(updatedReport)`. תמיכה ב-Ctrl+Enter לסיבמיט.

ב-`ReportsPage.jsx` הוספתי state `closeReport` וכפתור "🚫 סגור דיווח" (`btn sm danger`) בעמודת הפעולות שמופיע רק לדיווחים בסטטוס `open` ורק ל-admin (תנאי `canCreate` שכבר קיים מעניק את `user?.role === 'admin'`). הכפתור מוצג ליד הכפתור הקיים "טיפול / המרה" — שניהם בתוך `flex` עם `gap` ו-`flex-wrap`. אחרי סגירה, `handleReportSaved` מעדכן את הדיווח in-place באותו דפוס של עריכה רגילה.

ב-`ReportsTab.jsx` (בתוך CardDetailPage) הוספתי עמודה חדשה "פעולות" שמופיעה רק ל-admin (כדי לא להוסיף עמודה ריקה לגובים), עם אותו כפתור. אחרי סגירה הטאב מתרענן דרך `reloadCounter` הקיים. ב-`EventsTab.jsx` הוספתי תווית "סגירת דיווח" עם `pill gray` ל-`report_closed`.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/logic/cardLogic.js (EVENT.REPORT_CLOSED)
- backend/src/routes/reports.js (POST /:id/close — טרנזקציה, ולידציה non-final, יצירת אירוע report_closed המקושר ל-card_id)
- frontend-admin/src/api/endpoints.js (reports.close)
- frontend-admin/src/components/CloseReportModal.jsx (חדש — מודאל confirm + textarea לסיבה)
- frontend-admin/src/pages/ReportsPage.jsx (כפתור "סגור דיווח" admin-only ליד "טיפול / המרה" + state ו-handler)
- frontend-admin/src/pages/cardTabs/ReportsTab.jsx (עמודת "פעולות" admin-only + אותו כפתור + רענון אחרי סגירה)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (תווית report_closed "סגירת דיווח" pill gray)

---

### 17. אפשרות למנהל ליצור דיווח ידני — 2026-05-04
**מה נעשה:** ה-backend כבר תמך ב-admin: `POST /api/reports` כבר חתום ב-`requireRole('admin', 'collector')`, ה-API מקבל `card_id` ישיר או `box_id` (ואז ה-backend פותר ל-active card דרך `getActiveCard`), והסטטוס הדיפולטיבי הוא `'open'` (DEFAULT בסכמה). בדקתי את הסכמה של `reports` והיא לא כוללת עמודת `assigned_to` — הקיים הוא `task_id` שמתמלא רק אחרי המרה למשימה דרך `convert-to-task`. לכן השדה האופציונלי "משויך ל" נשמט (אין למה לקשר אותו ב-DB ואין יישום ב-backend). `reports.create` כבר היה ב-`endpoints.js` — לא נדרש שינוי.

ב-frontend הוספתי קומפוננטה חדשה `ManualReportModal.jsx` עם 3 שדות: (1) סלקטור כרטסת (מוצג רק כשאין `cardId` נעול בפרופ — שולף את הכרטסות הפעילות דרך `cardsApi.getAll({ status: 'active' })`, ממפה תוויות `1019A`/`1019B`/... דרך `computeCardLabels` הקיים, ומציג גם את ה-location כעזר חיפוש; ממוין לפי label בעברית), (2) סלקטור סוג דיווח (אופציונלי — נשלף מ-`reportTypesApi.getAll()` שמכוון ל-`/api/settings/report-types`), (3) טקסטאריה לתיאור (חובה — אכיפת validation של `trimmed.length > 0`). בלוקיד מוצגת תווית הכרטסת בכותרת בדומה ל-`ManualEventModal`. ב-submit נקראת `reportsApi.create({ card_id, report_type_id, description })` — `report_type_id` נשלח כ-`null` אם לא נבחר. שגיאות מוצגות ב-`alert red` והכפתור מנוטרל בזמן טעינה. תמיכה ב-Ctrl+Enter לסיבמיט.

ב-`ReportsPage.jsx` הוספתי `useAuth` וכפתור "➕ צור דיווח" (`btn sm success`) שמופיע רק ל-admin, ליד כפתור הייצוא. הכפתור פותח את `ManualReportModal` ללא `cardId` (מצב גלובלי — סלקטור כרטסת מוצג). אחרי יצירה אני מקדם counter ב-state ש-loading effect תלוי בו → רשימת הדיווחים נטענת מחדש (כולל ה-stats בראש העמוד).

ב-`ReportsTab.jsx` (תוך CardDetailPage) הוספתי את אותו דפוס — `useAuth` + כפתור "➕ צור דיווח" admin-only שפותח את ה-modal עם `cardId` נעול ל-card הנוכחי + `cardLabel` מהפרופ. ב-`CardDetailPage.jsx` הוספתי העברה של `cardLabel={titleLabel}` ל-`ReportsTab` (בדומה ל-`EventsTab`). reload counter פנימי בטאב מרענן את רשימת הדיווחים אחרי יצירה.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- frontend-admin/src/components/ManualReportModal.jsx (חדש — סלקטור כרטסת/סוג + תיאור + ולידציה)
- frontend-admin/src/pages/ReportsPage.jsx (useAuth + כפתור admin-only + reloadCounter + שילוב ManualReportModal)
- frontend-admin/src/pages/cardTabs/ReportsTab.jsx (useAuth + כפתור admin-only + reloadCounter + ManualReportModal עם cardId נעול)
- frontend-admin/src/pages/CardDetailPage.jsx (העברת cardLabel ל-ReportsTab)

---

### 16. באג: יצירת אירוע גביה ידני על ידי מנהל לא נקלט כאירוע גביה — 2026-05-04
**מה נעשה:** האבחנה — אירוע ידני מסוג `collection` נוצר ב-`events` דרך `POST /api/events` (כבר עבד ממשימה 2), וה-aggregation של `last_collection_at` ב-`GET /api/cards` כבר עשה `GREATEST(MAX(envelopes.collected_at), MAX(events.created_at WHERE event_type='collection'))` (זה תוקן עוד לפני). מה שהיה שבור: ה-CTE `last_collections` ב-`GET /api/alerts/no-collection` הסתכל רק על `envelopes` ולכן אירועי גביה ידניים לא "סגרו" את חלון ההתראה והכרטסת המשיכה להופיע ב"אין גביה X ימים".

התיקון: עדכון ה-CTE ב-`alerts.js` כך שיחשב `MAX(ts)` מעל איחוד של `(SELECT card_id, collected_at AS ts FROM envelopes UNION ALL SELECT card_id, created_at AS ts FROM events WHERE event_type = 'collection')`. שמרתי את המבנה המקורי של ה-LEFT JOIN ושל החישוב `days_since` כדי לא לשנות סמנטיקה אחרת — רק המקור של `last_collection` הורחב. אירועים בלי `card_id` (אם יש כאלה) מתקבצים תחת NULL וה-LEFT JOIN לא ממפה אותם לשום שורה — לכן אין השפעה לוואי.

וידאתי שכל שאר הרכיבים שנדרשו במשימה כבר היו תקינים: `EVENT.COLLECTION = 'collection'` קיים ב-`cardLogic.js` (שורה 10); `'collection'` ברשימת `EVENT_OPTIONS` ב-`ManualEventModal.jsx` עם תווית "גביה"; ובמיפוי `EVENT_TYPE` ב-`EventsTab.jsx` יש `collection: { label: 'גביה', cls: 'blue' }`. גם ב-`cards.js` ה-aggregation כבר תקין — לא נגעתי בו.

**מספר טסטים:** 46/46 unit tests עוברים.

**קבצים ששונו:**
- backend/src/routes/alerts.js (CTE last_collections — איחוד envelopes עם events מסוג collection)

---

### 13. טאב "כרטסות פעילות" בתצוגת קופות — פעולות מקומיות במקום ניווט לכרטסת — 2026-05-04
**מה נעשה:** הטאב "מותקנות" ב-BoxesPage שונה לתווית "כרטסות פעילות" (התואמת לכותרת המשימה ולציפיית המשתמשת). קודם הטאב הציג רק `alert info` עם לינק ל-`/cards` שניווט אוטומטית למסך הכרטסות הראשי — כל מי שלחץ על הטאב נשלח החוצה. עכשיו הטאב מציג טבלה מלאה עם 5 עמודות: מספר קופה, סוג, כרטסת פעילה (label `1019A` וכו'), כתובת מלאה (city/neighborhood/street+building) ופעולות. הוספתי 2 כפתורים מקומיים פר-שורה — `🚫 סמן כלא שמישה` (`btn sm danger`, מפעיל את `handleMarkUnusable` הקיים שמשתמש ב-`boxes.setStatus(id, 'unusable', reason)` מהמשימה ה-5; ה-backend סוגר את הכרטסת הפעילה אוטומטית) ו-`📇 עבור לתצוגת כרטסת` (`btn sm`) שמנווט ל-`/cards/:cardId` רק כשמשתמש בוחר במפורש. אין יותר onClick אוטומטי על השורה.

ניצלתי את `activeCardByBox` ו-`labels` שכבר היו מחושבים בקובץ. גם הסרתי כפילות מבנית: ה-`filters-row` וה-alerts הוצאו מתוך ה-condition של `activeTab !== 'active'` והפכו ל-shared markup לכל הטאבים, כיוון שעכשיו יש לטאב active גם פילטרים. הוספתי alert info ייעודי לטאב active שמסביר את ההתנהגות החדשה.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- frontend-admin/src/pages/BoxesPage.jsx (תווית טאב + טבלת active חדשה + 2 כפתורים פר-שורה + הזזת filters/alerts ל-shared)

---

### 15. ביטול משימה על ידי מנהל — מעבר לסטטוס "בוטל" — 2026-05-04
**מה נעשה:** הוספתי `EVENT.TASK_CANCELLED = 'task_cancelled'` ב-`cardLogic.js` ו-endpoint חדש `POST /api/tasks/:id/cancel` (admin only) ב-`routes/tasks.js`. ה-endpoint עובד בתוך טרנזקציה: `SELECT ... FOR UPDATE` על המשימה, וולידציות שמחזירות 404 (לא נמצאה), 409 (`done` — "לא ניתן לבטל משימה שכבר בוצעה") או 409 (`cancelled` — "המשימה כבר בוטלה"). אם הולידציות עוברות, הסטטוס מתעדכן ל-`cancelled` עם `executed_at=NOW()`. אם למשימה משויך `card_id`, נרשם אירוע `task_cancelled` עם תיאור עברי (`"ביטול משימה (<type>): <reason>"` או בלי הסיבה אם לא ניתנה). הסיבה לא נשמרת ב-`execution_notes` כדי לא לערבב סמנטיקה — היא נשמרת רק ב-event description.

ב-frontend הוספתי `tasks.cancel(id, reason)` ל-`endpoints.js`, וקומפוננטה חדשה `CancelTaskModal.jsx` עם כותרת "ביטול משימה", שדה `textarea` אופציונלי לסיבה, אזהרה שמסבירה את השלכות הפעולה, וכפתור `btn danger` "🚫 בטל משימה". המודאל מקבל את ה-task ומפעיל `tasksApi.cancel()` בעצמו, ואחרי הצלחה קורא ל-`onCancelled(updatedTask)`. ב-`TasksPage.jsx` הוספתי `useAuth` כדי לדעת אם המשתמש admin, וכפתור "🚫 בטל" (`btn sm danger`) בעמודת הפעולות שמופיע רק ל-admin וכשהמשימה לא ב-final state (לא `done` ולא `cancelled`). `handleCancelled` מעדכן את השורה in-place באותו דפוס של `handleExecSuccess`. ב-`TasksTab.jsx` (בתוך CardDetailPage) הוספתי עמודה חדשה "פעולות" שמופיעה רק ל-admin, עם אותו כפתור — וטרגגר מרענן את הטאב דרך `reloadKey`. ב-`EventsTab.jsx` הוספתי תווית "ביטול משימה" עם `pill red` ל-`task_cancelled`.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/logic/cardLogic.js (EVENT.TASK_CANCELLED)
- backend/src/routes/tasks.js (POST /:id/cancel — טרנזקציה, ולידציה final-state, יצירת אירוע אם card_id קיים)
- frontend-admin/src/api/endpoints.js (tasks.cancel)
- frontend-admin/src/components/CancelTaskModal.jsx (חדש — מודאל confirm + textarea לסיבה)
- frontend-admin/src/pages/TasksPage.jsx (כפתור "בטל" admin-only בעמודת הפעולות + state ו-handler)
- frontend-admin/src/pages/cardTabs/TasksTab.jsx (עמודת "פעולות" admin-only + אותו כפתור + רענון אחרי ביטול)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (תווית task_cancelled "ביטול משימה" pill red)

---

### 10. יצירת משימת גביה חד פעמית עם הרשאת גישה זמנית — 2026-05-04
**מה נעשה:** הוספתי דגל חדש `task_types.grants_temporary_access BOOLEAN` (גם בהגדרת הטבלה הראשונית וגם כ-`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ב-idempotent migrations). הוספתי סוג משימה חדש `'גביה'` (אייקון 💰, `opens_card=FALSE, closes_card=FALSE, grants_temporary_access=TRUE`) — נוסף גם ל-`schema.sql` כ-`INSERT ... ON CONFLICT (name) DO UPDATE` כדי שמסדים קיימים יקבלו את הסוג החדש בעת מיגרציה (וגם ל-`seed.sql`). הרצתי `node scripts/runSql.js src/db/schema.sql` על המסד החי כדי להחיל. ב-`/api/settings/task-types` הרחבתי GET/POST/PUT לחשוף ולקבל את הדגל `grants_temporary_access`.

ב-`userAssignment.js` הוספתי helper חדש `temporaryAccessClause(paramIndex)` שמחזיר SQL fragment בצורת `EXISTS (SELECT 1 FROM tasks ... grants_temporary_access=TRUE AND status IN ('open','in_progress') AND assigned_to = $N)` — והרחבתי את `getBoxesForCollector(userId)` להשתמש בו: כעת ה-WHERE הוא `(area_branch OR temp_branch)`. אם למשתמש אין area_assignments, ה-area branch הופך ל-`FALSE` אבל ה-temp branch עדיין יכול להחזיר תוצאות. אותו עקרון יושם על `GET /api/cards` (מסלול collector) ב-`routes/cards.js`. בעקבות זאת, גם `isBoxAssignedToCollector` / `isCardAssignedToCollector` (שמשתמשים ב-`getBoxesForCollector`) ירשו את הגישה הזמנית באופן אוטומטי — מה שמאפשר לגובה ליצור מעטפה (`POST /api/envelopes`) על קופה מחוץ לאזור שלו, כל עוד יש לו משימת גביה פעילה.

ברגע שמשימת הגביה עוברת ל-status `done` (או `cancelled`), ה-EXISTS לא תופס יותר את הקופה והגישה הזמנית פגה אוטומטית — ללא צורך ב-cleanup ייעודי.

ב-`TaskModal.jsx` הוספתי תמיכה בדגל החדש (נשלף מ-`/settings/task-types`): כשנבחר סוג משימה עם `grants_temporary_access=TRUE`, מוצג alert בצבע אזהרה ("🎯 משימת גביה: הגובה המשויך יקבל גישה זמנית..."), שדה "משויך" מסומן כ-* חובה (placeholder משתנה ל"— בחר —"), ובסיבמיט יש validation שחוסם שמירה ללא assignee. בחירת קופה ספציפית מחוץ לאזור הגובה עובדת אוטומטית כי הרשימה ב-modal מציגה את כל הקופות (admin endpoint).

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/db/schema.sql (column task_types.grants_temporary_access + ALTER TABLE אידמפוטנטי + INSERT אידמפוטנטי לסוג 'גביה')
- backend/src/db/seed.sql (סוג 'גביה' בטבלת task_types)
- backend/src/routes/settings.js (חשיפת + קבלת grants_temporary_access ב-GET/POST/PUT /task-types)
- backend/src/logic/userAssignment.js (temporaryAccessClause + הרחבת getBoxesForCollector ל-OR area-branch + temp-branch)
- backend/src/routes/cards.js (GET / collector — אותה הרחבה ל-WHERE)
- frontend-admin/src/components/TaskModal.jsx (alert hint + assigned_to חובה + validation)

---

### 14. באג: סימון קופה כלא שמישה לא עובד — מחזיר "Invalid status" — 2026-05-04
**מה נעשה:** האבחנה הייתה שהשגיאה לא הייתה `Invalid status` של ה-backend אלא `new row for relation "boxes" violates check constraint "boxes_status_check"` — כלומר ה-CHECK constraint במסד הנתונים החי עדיין החזיק ב-3 ערכים בלבד (`uninstalled/active/inactive`) כי המיגרציה האידמפוטנטית שנוספה במשימה 5 ל-`schema.sql` (שורות 219-221) מעולם לא רצה על המסד החי. ה-VALID_STATUSES ב-backend וה-frontend היו תקינים — הבקשה הגיעה ל-DB וה-DB דחה אותה. התיקון: הרצתי `node scripts/runSql.js src/db/schema.sql` כדי לרענן את ה-CHECK (וגם לוודא ש-`tasks.image_path` ממשימה 7 קיים). הסכמה אידמפוטנטית, אז הריצה בטוחה על מסד עם נתונים.

**קבצים ששונו:** ללא — הקוד היה תקין; רק המסד נדרש לרענון.

---

### 9. דוחות — סינון לפי שם מותאם אישית + קבלה — 2026-05-04
**הבהרה שהתקבלה:** "קבלה" = הצ'קבוקס הקיים בכרטסת `cards.receipt_required` ("מעוניין בקבלה"), לא הפקת PDF ולא דוח חדש.

**מה נעשה:** הוספתי 2 query params ל-`GET /api/reports-export/per-box`: `custom_name` (חיפוש חלקי דרך `ILIKE '%...%'`) ו-`receipt_required` (`'true'`/`'false'` עם החזרת 400 על ערך לא תקין). העמודה `c.receipt_required` נוספה ל-SELECT (כבר היה `custom_name`) ולכותרות ה-CSV של ה-endpoint. ב-frontend (`DochotPage.jsx`) הוספתי 2 שדות סינון ב-SummaryTab — input חופשי ל"שם מותאם אישית" ו-select ל"מעוניין בקבלה" (הכל/כן/לא) — ושני הערכים מועברים ל-API. הוספתי עמודה חדשה "קבלה" בטבלה (תווית `pill green` "כן" כשמעוניין, מקף אחרת). הוספתי גם כפתור "📥 יצוא לאקסל" מקומי ב-SummaryTab (שלא היה קודם), שמייצא את התוצאות עם 11 עמודות כולל `מעוניין בקבלה` (עם פורמט "כן"/"לא"). ב-CompareTab הוספתי את אותם 2 הסינונים בכל עמודה (שדות `customName` + `receiptFilter` ב-state, מועברים ל-API באותו אופן), והרחבתי את `exportCompare` כך שכותרת העמודה ב-CSV תכלול את הסינונים (`שם: X`, `עם קבלה`, `ללא קבלה`).

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/routes/reportsExport.js (per-box: query params custom_name + receipt_required, SELECT של receipt_required, עמודה ב-CSV)
- frontend-admin/src/pages/DochotPage.jsx (SummaryTab — שדות סינון + עמודה בטבלה + כפתור יצוא; CompareTab — שדות סינון לכל עמודה + הוספה ל-label של ייצוא ההשוואה)

---

### 7. צירוף תמונה במשימה שמנהל יוצר — 2026-05-04
**מה נעשה:** הוספתי עמודה חדשה `tasks.image_path TEXT` לסכמה (גם בהגדרת הטבלה הראשונית וגם כ-`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` בסוף `schema.sql` כדי שמסדים קיימים יתעדכנו). הרחבתי את `POST /api/tasks` (admin only) לקבל ולוולדט שדה `image_path` (string|null) ולשמור אותו ב-DB. הרחבתי גם את `PUT /api/tasks/:id` לקבל `image_path` (כך שניתן להחליף או למחוק את התמונה גם אחרי היצירה). ב-frontend הוספתי `uploads.image(file)` ל-`endpoints.js` — wrapper שעוקף את ה-JSON client הקיים ושולח multipart/form-data ל-`POST /api/uploads/image` עם ה-Bearer token. עדכנתי את `TaskModal.jsx`: הוספתי שדה `<input type="file" accept="image/jpeg,image/png,image/webp">` עם וולידציה של MIME בצד הלקוח, תצוגה מקדימה של הקובץ הנבחר (`URL.createObjectURL` + cleanup דרך useEffect), ובמצב עריכה — תצוגה של התמונה הקיימת עם כפתור "הסר תמונה" שמסמן את הקובץ למחיקה (state `removeImage`) או החלפתו על-ידי בחירת קובץ חדש. ב-`handleSubmit`, כשיש קובץ נבחר אני קודם מעלה אותו דרך `uploadsApi.image(file)`, מקבל `path` ושולח אותו ב-body של יצירה/עדכון. בעריכה, `image_path` נשלח רק כשמשהו השתנה (העלאה חדשה → path; הסרה מסומנת → null). ההעלאה קורית רק אחרי שעברו ולידציות סוג-משימה/קופה/דרישת-כרטסת, כדי לא להעלות קבצים שלא ייקשרו למשימה.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/db/schema.sql (column tasks.image_path + ALTER TABLE אידמפוטנטי)
- backend/src/routes/tasks.js (POST + PUT — קבלת ולידציה ושמירה של image_path)
- frontend-admin/src/api/endpoints.js (uploads.image — multipart helper)
- frontend-admin/src/components/TaskModal.jsx (file input + preview + העלאה לפני שמירה + replace/remove במצב עריכה)

---

### 6. עריכת סכום במעטפה אחרי הזנה + אירוע שינוי — 2026-05-04
**מה נעשה:** הוספתי `EVENT.AMOUNT_CHANGED = 'amount_changed'` ב-`cardLogic.js`. הוספתי endpoint חדש `PATCH /api/envelopes/:id/amount` (admin/cashroom) שעובד בתוך טרנזקציה: `SELECT ... FOR UPDATE` על המעטפה, ולידציה שהסטטוס `entered` (אחרת 409), חסימת no-op כשהסכום החדש זהה לישן (409), עדכון `amount`, ויצירת אירוע `amount_changed` ב-`events` המקושר ל-`card_id` עם תיאור עברי בפורמט `"שינוי סכום מעטפה: <ישן> → <חדש> (סיבה: ...)"` (הסיבה אופציונלית). ב-frontend הוספתי `envelopes.updateAmount(id, amount, reason)` ל-`endpoints.js`. הרחבתי את `CashroomModal` למצב dual: כש-`pending` הוא נשאר כפי שהיה (PUT לעדכון ראשוני), כש-`entered` הוא נפתח במצב צפייה עם כפתור "✏️ ערוך סכום" שמעביר ל-mode עריכה (סכום editable + שדה "סיבת השינוי" אופציונלי + אזהרת info שמסבירה שיווצר אירוע). ב-`EnvelopesTab` (בתוך CardDetailPage) הכפתור בשורה הוא "✏️ ערוך סכום" למעטפה שהוזנה ו-"פרטים" אחרת. ב-`EnvelopesPage` (הרשימה הראשית) כפתור "פרטים" פותח את אותו modal — ניתן לערוך משם גם. ב-`EventsTab` הוספתי תווית "שינוי סכום" (pill yellow) עבור `amount_changed`.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- backend/src/logic/cardLogic.js (EVENT.AMOUNT_CHANGED)
- backend/src/routes/envelopes.js (PATCH /:id/amount — טרנזקציה, ולידציה, יצירת אירוע)
- frontend-admin/src/api/endpoints.js (envelopes.updateAmount)
- frontend-admin/src/components/CashroomModal.jsx (mode עריכה ל-entered + שדה סיבה)
- frontend-admin/src/pages/cardTabs/EnvelopesTab.jsx (כפתור "ערוך סכום" + onSaved)
- frontend-admin/src/pages/EnvelopesPage.jsx (כפתור "פרטים" שפותח את ה-modal לעריכה)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (תווית amount_changed)

---

### 3. כפתור "צור משימה" בתצוגת הכרטסת — 2026-05-04
**מה נעשה:** הוספתי כפתור "➕ צור משימה" ב-`TasksTab.jsx` (טאב המשימות בתוך CardDetailPage) שפותח את אותו `TaskModal` של דף המשימות, עם `defaults={{ box_id, lockBox: true }}` — בדיוק כמו הדפוס שכבר משמש ב-`BoxesPage` (טאב התקנה). הקופה ננעלת אוטומטית לקופה של הכרטסת הנוכחית (סלקטור הקופה ב-modal הופך ל-disabled), כך שלמשתמש נשאר רק לבחור סוג משימה / משויך / הערות. אחרי שמירה, הטאב מתרענן אוטומטית דרך `reloadKey` (counter ב-state, מקודם ב-`onSaved`). הכפתור מנוטרל אם `boxId` חסר. ה-modal מטפל לבדו בבחירת סוג משימה ובאחזור הכרטסת הפעילה (לוגיקה שכבר קיימת ממשימה 12 — אם נבחר סוג שדורש כרטסת קיימת והקופה נטולת כרטסת פעילה, השמירה נחסמת).

**הערה:** הכפתור הוצב בתוך הטאב ולא בכותרת העמוד כי הוא מקומי-להקשר (פעולה על משימות הכרטסת), והטאב כבר מציג את התוצאה אחרי השמירה. שאר הקבצים שצוינו במשימה (TaskModal.jsx, CardDetailPage.jsx) לא נדרשו לשינוי — ה-API של ה-modal כבר תומך ב-`defaults.lockBox`, ו-CardDetailPage רק מארח את ה-tab.

**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.

**קבצים ששונו:**
- frontend-admin/src/pages/cardTabs/TasksTab.jsx (כפתור צור משימה + state ל-modal + reloadKey לרענון אחרי שמירה + שילוב TaskModal)

---

### 2. אפשרות למנהל ליצור אירוע — 2026-05-04
**מה נעשה:** ה-backend כבר תמך ב-`POST /api/events` (admin/collector) ואת ה-API client `events.create` כבר היה. הוספתי בצד הלקוח: (1) קומפוננטה חדשה `ManualEventModal.jsx` — מודאל יצירת אירוע ידני עם סלקטור סוג אירוע (10 סוגים תואמים ל-`EVENT` ב-cardLogic, עם תוויות עבריות), טקסטאריה לתיאור, וולידציה ש-`description` חובה כשהסוג `other` (תואם לולידציה ב-backend), ניהול שגיאות ומצב טעינה. (2) עדכון `EventsTab.jsx` — מוסיף כפתור "➕ צור אירוע" שנראה רק ל-`user.role === 'admin'`, פותח את המודאל, וב-`onCreated` מרענן את רשימת האירועים דרך counter ב-state. (3) `CardDetailPage.jsx` עכשיו מעביר `cardLabel={titleLabel}` ל-`EventsTab` כדי שהמודאל יציג בכרטסת איזו כרטסת מתועדת.
**מספר טסטים:** 46/46 unit tests עוברים. הbuild של frontend-admin עובר ללא שגיאות.
**קבצים ששונו:**
- frontend-admin/src/components/ManualEventModal.jsx (חדש)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (כפתור + הזרמה ל-modal + reload)
- frontend-admin/src/pages/CardDetailPage.jsx (העברת cardLabel ל-EventsTab)

---

### 12. יצירת משימה חדשה לקופה — אחזור אוטומטי של הכרטסת הפעילה — 2026-05-04
**מה נעשה:** ב-backend, `POST /api/tasks` שולף את `task_types.opens_card` של סוג המשימה הנבחר. אם `opens_card === false` (משימת הסרה / מעבר-סגירה / תחזוקה / דיווח) — הוא שולף את הכרטסת הפעילה של הקופה (`SELECT id FROM cards WHERE box_id=$1 AND status='active' ORDER BY opened_at DESC LIMIT 1`) ושומר אותה ב-`tasks.card_id`. אם אין כרטסת פעילה לסוג כזה של משימה — מוחזרת תשובה 409 עם הודעה "אין כרטסת פעילה לקופה זו — לא ניתן ליצור משימה מסוג זה". משימות התקנה (`opens_card === true`) ממשיכות להיווצר ללא `card_id` (נקבע בעת ה-completion), בלי דרישה לכרטסת קיימת. ב-frontend, `TaskModal` קורא ל-`cardsApi.getAll({ box_id, status: 'active' })` כל פעם שבוחרים קופה במצב יצירה, ומציג: (1) "📇 כרטסת פעילה: <city, neighborhood, street, building>" כשנמצאה, (2) "ℹ️ אין כרטסת פעילה לקופה זו — תיפתח חדשה בעת ביצוע המשימה" אם בחרו סוג משימה שפותח כרטסת ואין כרטסת קיימת, או (3) "⛔ אין כרטסת פעילה לקופה זו — לא ניתן ליצור משימה מסוג זה" כשהסוג דורש כרטסת קיימת — במקרה זה כפתור השמירה מנוטרל ובסיבמיט יוצגה הודעה ברורה.

**מספר טסטים:** 46/46 unit tests עוברים.

**קבצים ששונו:**
- backend/src/routes/tasks.js (POST — שליפת opens_card, אחזור active card, persist card_id, החזרת 409 כשחסר)
- frontend-admin/src/components/TaskModal.jsx (state activeCard/loadingCard, useEffect לפי boxId, requiresActiveCard מ-`!opens_card`, חסימת submit, הודעות UI לפי מצב הכרטסת)

---

### 4. פתיחה מחדש של כרטסת — 2026-05-04
**מה נעשה:** הוספתי פונקציה חדשה `reopenCard(cardId, reason, userId, client)` ב-`cardLogic.js` עם אירוע חדש `EVENT.REOPEN = 'reopen'`. הפונקציה: (1) טוענת את הכרטסת ומוודאת שהיא במצב `closed`, (2) מוודאת שהקופה אינה `unusable` (אחרת — שגיאה ברורה), (3) מוודאת שאין כרטסת פעילה אחרת לאותה קופה (גם ה-DB אוכף זאת דרך `uniq_active_card_per_box` — בדיקה מקדימה לשגיאה נקייה), (4) מעדכנת `status='active'` עם `closed_at=NULL, closed_reason=NULL`, (5) מחזירה את הקופה ל-`active` אם היא הייתה `uninstalled/inactive`, ו-(6) יוצרת אירוע `reopen` עם הסיבה האופציונלית. הוספתי endpoint חדש `POST /api/cards/:id/reopen` (admin-only, transactional, ROLLBACK בשגיאה, מיפוי שגיאות ל-409/404). הוספתי `cards.reopen(id, reason)` ל-`endpoints.js`. ב-`CardDetailPage` הוספתי כפתור "🔓 פתיחה מחדש" שמופיע רק כש-`card.status === 'closed'` ופותח `ReopenCardModal` (מודאל חדש, מקביל ל-CloseCardModal — textarea לסיבה אופציונלית, כפתורי ביטול/אישור, מצב טעינה ושגיאות).

**תיקונים נוספים שהתבקשו:**
- **תיוג אירוע סגירה ידנית:** הוספתי `EVENT.CARD_CLOSED = 'card_closed'` ועדכנתי את `POST /api/cards/:id/close` להשתמש בו במקום `EVENT.REMOVAL`. ב-`EventsTab` הוספתי תווית "סגירת כרטסת" (pill אפור). שמרתי את `removal` בנפרד ("הסרה" — נשמר לסגירה דרך משימת removal). הוספתי גם תוויות חסרות עבור `mark_unusable` ("סומנה כלא שמישה", pill אדום) ו-`reopen` ("פתיחה מחדש", pill ירוק).
- **כפתור פתיחה מחדש לא עבד:** המימוש הקודם השתמש ב-`window.prompt + window.confirm` ברצף — UX גרוע ולעיתים נחסם בדפדפנים. הוחלף במודאל ייעודי `ReopenCardModal` (קובץ חדש), שמופעל דרך state בלבד.

**הערה לסכמה:** לא נדרש שינוי schema — `cards.status` כבר תומך ב-`('active','closed')` והאינדקס החלקי `uniq_active_card_per_box` ממשיך לאכוף "כרטסת פעילה אחת לקופה" גם אחרי reopen.

**מספר טסטים:** 46/46 unit tests עוברים (לא נוספו טסטים ייעודיים — `reopenCard` נוגע ב-DB ושייך לחבילת ה-integration שמותנית ב-`RUN_DB_TESTS=true`).

**קבצים ששונו:**
- backend/src/logic/cardLogic.js (EVENT.REOPEN + EVENT.CARD_CLOSED + פונקציה חדשה reopenCard + export)
- backend/src/routes/cards.js (import reopenCard + POST /:id/reopen + close משתמש ב-EVENT.CARD_CLOSED)
- frontend-admin/src/api/endpoints.js (cards.reopen)
- frontend-admin/src/components/ReopenCardModal.jsx (חדש — מודאל לפתיחה מחדש)
- frontend-admin/src/pages/CardDetailPage.jsx (state + handler + כפתור + מודאל)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (תוויות card_closed/mark_unusable/reopen)

---

### 5. איחוד "כרטסת לא פעילה" ו"לא מותקנות" + "לא שמישה" — 2026-05-04
**מה נעשה:** הוספתי סטטוס `unusable` ל-`boxes` (גם בסכמה הראשונית וגם כ-ALTER TABLE אידמפוטנטי בסוף `schema.sql` כדי שמסדים קיימים יתעדכנו). עדכנתי את `PATCH /api/boxes/:id/status`: כשמעבירים ל-`unusable` הוא סוגר אוטומטית את הכרטסת הפעילה (אם קיימת) ויוצר אירוע מסוג חדש `mark_unusable` (נוסף ל-`EVENT` ב-cardLogic). שחזור מ-`unusable` נעשה דרך אותו endpoint עם status חדש (ה-UI שולח `inactive`). ב-`BoxesPage` איחדתי את הטאבים "לא מותקנות" ו"כרטסת לא פעילה" לטאב יחיד "ללא כרטסת פעילה" שמציג את שתי הקבוצות יחד (`status IN ('uninstalled','inactive')`), והוספתי טאב חדש "לא שמישות". בכל שורה בטאב "ללא כרטסת" יש כפתור "סמן כלא שמישה" (עם confirm + prompt לסיבה), ובטאב "לא שמישות" יש כפתור "החזר לשימוש". הוספתי `boxes.setStatus()` ל-`endpoints.js`.

**הערה ל-CLAUDE.md:** התיעוד מציין רק 3 סטטוסים (`uninstalled/active/inactive`) — רצוי לעדכן בעתיד.

**קבצים ששונו:**
- backend/src/db/schema.sql (CHECK חדש + ALTER TABLE אידמפוטנטי)
- backend/src/logic/cardLogic.js (EVENT.MARK_UNUSABLE)
- backend/src/routes/boxes.js (VALID_STATUSES + טיפול ב-unusable ב-PATCH /:id/status)
- frontend-admin/src/api/endpoints.js (boxes.setStatus)
- frontend-admin/src/pages/BoxesPage.jsx (איחוד טאבים + טאב חדש + פעולות סימון/שחזור)

---

### 11. תצוגת כרטסות ראשית — תאריך גביה אחרון + תגיות לדיווח/משימה פתוחים — 2026-05-03
**מה נעשה:** הרחבתי את `GET /api/cards` להחזיר 3 שדות אגרגציה לכל כרטסת: `last_collection_at` (`MAX(envelopes.collected_at)`), `has_open_report` (`EXISTS` reports עם `status='open'`), ו-`has_open_task` (`EXISTS` tasks עם `status IN ('open','in_progress')`). הוספתי לטבלה ב-CardsPage שתי עמודות חדשות — "גביה אחרונה" (תאריך מפורמט `he-IL`, או `—`), ו-"סימונים" שמציגה תגיות מותאמות: `pill yellow` ⚠ דיווח פתוח ו-`pill blue` 📋 משימה פתוחה (עם tooltip). הוספתי את אותם 3 שדות לייצוא ה-CSV.

**קבצים ששונו:**
- backend/src/routes/cards.js (תוספת תתי-שאילתות ל-GET /api/cards)
- frontend-admin/src/pages/CardsPage.jsx (עמודות + תגיות)
- frontend-admin/src/utils/exportToCsv.js (exportCards: 3 שדות חדשים)

---

### 8. באג: השמירה בעריכת פרטי כרטסת החזירה "Not found" — 2026-05-03
**מה נעשה:** ה-frontend שלח `PATCH /api/cards/:id` אבל ה-backend חושף רק `PUT /:id` (עם סמנטיקת PATCH — partial update). כל בקשת PATCH הוחזרה כ-404 עם body `Not found` של Express. תוקן ב-`api.update` של cards מ-`api.patch` ל-`api.put`, בעקבות הקונבנציה של כל שאר ה-endpoints (boxes/users/envelopes/tasks/reports — כולם משתמשים ב-PUT). השדות בטופס עצמם לא היו נעולים — הבעיה הייתה רק ב-HTTP method של הקריאה לשמירה.

**קבצים ששונו:**
- frontend-admin/src/api/endpoints.js (cards.update: api.patch → api.put)

---

### 1. שיוך גובים בכרטסת לפי היררכיית המשתמשים — 2026-05-03
**מה נעשה:** המרתי את שיוך הגובה לחישוב דינמי (compute-on-read) במקום הסתמכות על העמודה `cards.collector_id` (שהייתה מקובעת ב-seed עם ערכים שגויים). הוספתי SQL LATERAL בשם `RESOLVED_COLLECTOR_LATERAL` שעובר על משתמשי `collector` פעילים, מסנן לפי `area_exclusions`, ומחזיר את הגובה עם ההתאמה הכי ספציפית לפי ההיררכיה box(4)>street(3)>neighborhood(2)>city(1). חיברתי אותו ל-`GET /api/cards` (list/by-id/history), `GET /api/alerts/no-collection`, ו-`reportsExport`. הסרתי את הדרופ-דאון של "גובה משויך" מטופס העריכה (כיוון שהשיוך נגזר מהכללים) והסרתי את `collector_id` מ-PUT הנכנס.

**באג שעלה תוך כדי + תוקן:** הקוד תמך רק בפורמט כללים `{ type, value }` (זה של ה-seed), אבל ה-UI שומר בפורמט `{ city: 'X' }` (partial-key, ללא type). כל כלל שערכת בממשק לא הותאם לאף כרטסת. תוקן: הוספתי `normalizeRule()` שמתרגם את שני הפורמטים ל-shape פנימי אחיד, ועדכנתי את כל ה-helpers (matchesRule/buildLocationClause/bestMatchSpecificity/SQL) לתמוך בשניהם.

**מספר טסטים:** 46/46 unit tests עוברים (10 חדשים לפורמט partial-key). הערה: integration tests מול DB לא רצו (דורש `RUN_DB_TESTS=true`+DB חי).

**קבצים ששונו:**
- backend/src/logic/userAssignment.js (normalizeRule + RESOLVED_COLLECTOR_LATERAL + findCollectorForLocation + bestMatchSpecificity, תמיכה בשני פורמטי כללים)
- backend/src/logic/cardLogic.js (openCard auto-resolve)
- backend/src/routes/cards.js (LATERAL בקריאות + הסרת collector_id מ-PUT)
- backend/src/routes/alerts.js (LATERAL במקום JOIN)
- backend/src/routes/reportsExport.js (LATERAL במקום JOIN)
- frontend-admin/src/pages/CardDetailPage.jsx (הסרת דרופ-דאון, תווית "לפי כללי האזורים")
- backend/tests/unit/userAssignment.test.js (16 בדיקות חדשות)

---

## ❓ דורש הבהרה

<!-- משימות שלא ברורות מספיק לביצוע -->

---

## ❌ נכשל

<!-- משימות שלא הצלחתי לבצע, עם הסבר -->
