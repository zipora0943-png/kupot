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

### 42. Force-push ל-GitHub אחרי ניקוי היסטוריית `backup.sql` (ידני על ידי המשתמשת)
ההיסטוריה המקומית נוקתה ב-`git filter-branch` כדי להסיר את `backup.sql` (שחשף bcrypt hashes של כל המשתמשים). יש לבצע את ה-push ידנית: `git push --force-with-lease origin main`. **לא לבצע אוטומטית** — המשתמשת מבצעת פעולות הרסניות בעצמה. גיבוי mirror שמור ב-`e:\kupot-project\_kupot-backup-mirror.git` כ-rollback path.

### 43. החלפת סיסמאות דמו אחרי ה-force-push
מאחר ש-bcrypt hashes של כל המשתמשים נחשפו בהיסטוריית git, יש להחליף סיסמאות אחרי שה-force-push יצא: לעדכן `DEMO_PASSWORD` ב-`backend/.env` לערך חדש, ואז להריץ `node backend/scripts/seedUsers.js` שייצור מחדש את ה-hashes. לוודא login עובד עם הסיסמה החדשה.

### 44. מחיקת ה-mirror של ה-backup אחרי אימות שה-force-push עבר
אחרי שיתאמת ב-GitHub שההיסטוריה נוקתה (חיפוש "backup.sql" ב-commits לא מחזיר תוצאות), למחוק את הגיבוי המקומי: `Remove-Item -Recurse -Force e:\kupot-project\_kupot-backup-mirror.git`. עד אז להשאיר כ-rollback path.

### 45. סבב 4 — מעבר ל-HTTPS דרך Cloudflare Tunnel (ממתין לדומיין)
מעבר מהדיפלוי הנוכחי (`vite preview` על פורטים 5000/5001 חשופים HTTP) לארכיטקטורה: nginx → backend, ו-cloudflared מנתב את הדומיין פנימה. השלבים:
1. ליצור `nginx/kupot.conf` (site config עם הגדרת /api → :3000, frontends → static files)
2. ליצור `cloudflared/config.yml.example` עם hostname mapping
3. ב-2 ה-`.env.production` (admin, collector) להגדיר `VITE_API_BASE=/api` (יחסי)
4. להצמיד backend ל-`127.0.0.1` בלבד (לא לקבל חיבורים חיצוניים ישירים)
5. להוריד את `kupot-admin` ו-`kupot-collector` מ-`ecosystem.config.js` (לא צריך `vite preview` יותר — nginx יגיש static)
6. לשכתב את `DEPLOY.md` לפי הזרימה החדשה.

**ממתין:** המשתמשת בודקת רישום דומיין (נכון ל-2026-05-10). לא להתחיל בלי דומיין.


---

## 🔄 בביצוע

_(אין משימה בביצוע)_

---

## ✅ הושלמו

<!-- פורמט:
### [שם המשימה] — YYYY-MM-DD
**מה נעשה:** סיכום קצר
**קבצים ששונו:** רשימה
-->

### 52. גובה — מודאל מאוחד לכל כשל אימות GPS (3 אפשרויות, דיווח inline) — 2026-05-27
**מה נעשה:** עד היום היו 3 מודאלים נפרדים שטיפלו במצבי כשל GPS שונים: `radiusWarning` (מחוץ לרדיוס — textarea חובה + "המשך"), `geoUnavailable` (GPS לא זמין בכרטסת — "המשך" / "ביטול"), `confirmCard` (lookup ידני + GPS נכשל — "אשר" / "דיווח"). השינוי: **מודאל יחיד מאוחד** שנפתח בכל מצב של כשל אימות, עם 3 אפשרויות תמידיות, כשהדיווח נעשה **inline בתוך אותו מודאל** ללא ניווט לעמוד דיווח נפרד.

**מצב A** (ברירת מחדל אחרי כשל אימות):
- כותרת: "לא הצלחנו לאמת את המיקום"
- טקסט מותאם למצב:
  - **out_of_radius**: "המיקום שלך רחוק כ-X מ' מהכתובת הרשומה" (אדום)
  - **unavailable** (GPS נכשל / verify API נכשל / card לא geocoded): "לא הצלחנו לקבל את המיקום מהמכשיר. מומלץ לאפשר הרשאת מיקום." (כחול)
- פרטי הכרטסת מוצגים תמיד (iron_number, כתובת, הערות מיקום) — כך הגובה מאמת ויזואלית גם בלי GPS.
- **3 כפתורים:**
  1. ✓ **אישור והמשך** — לחיצה אחת ללא טקסט. אם יש GPS coords (lat/lng) → נרשם `location_override` עם reason קבוע `"המשך ללא דיווח מיקום שגוי"`. אם אין GPS — מדלגים (אין מה לרשום). ניווט ל-`/scan/:id`.
  2. 📝 **דווח על מיקום שגוי** — **לא מנווט**. עובר למצב B בתוך אותו מודאל.
  3. **ביטול** — `navigate(-1)` (חזרה לעמוד הקודם — רשימת כרטסות / כרטסת ספציפית).

**מצב B** (אחרי לחיצה על "דווח"):
- כותרת: "דיווח על מיקום שגוי"
- Textarea מולא ב-`"כתובת שגויה: "` (prefix), המשתמשת ממשיכה לכתוב.
- **2 כפתורים:**
  1. ✓ **צור דיווח והמשך לסריקה** — קורא ל-`reportsApi.create({card_id, report_type_id:null, description, image_path:null})` ישירות מהמודאל. הצלחה → ניווט ל-`/scan/:id`. כשלון → `reportError` מוצג במודאל, המשתמשת יכולה לנסות שוב.
  2. **ביטול** — חוזר למצב A (לא סוגר את המודאל).
- ולידציה: הכפתור מנוטרל עד שהטקסט ארוך מ-prefix (כלומר הגובה הוסיף משהו אחרי "כתובת שגויה:").

**הזרימה החדשה ב-`runVerification`:** במקום 3 הסתעפויות לפי source — כל כשל פותח את `verifyFailure` state עם `{card, kind, distance?, lat?, lng?}`. ה-`source` ('lookup'/'in-card') הוסר לחלוטין — אותו טיפול בשני המקרים.

**שיקול עיצובי:** הדיווח inline (במקום ניווט ל-`ReportFormPage`) נחוץ כדי לשמור על רצף הזרימה — הגובה כבר ב-mindset של "אני רוצה לגבות עכשיו"; לקיחתו לעמוד אחר שובר רצף. ה-`ReportFormPage` המלא נשאר זמין למקרים שהגובה רוצה לדווח על משהו אחר (כפתור "📝 צור דיווח" באחזור הידני). מודאל הדיווח inline מציע רק תיאור — בלי תמונה ובלי report_type_id; דיווחים מורכבים יותר עוברים דרך העמוד המלא.

**שיקול נוסף:** ה-audit נשמר במלואו — `location_override` עם הקבוע "המשך ללא דיווח מיקום שגוי" (>5 תווים, עובר את ה-`MIN_REASON_LENGTH` בבק-אנד) נכתב רק כשיש GPS coords. דיווח פרואקטיבי נכתב ב-`reports` עם תיאור "כתובת שגויה: ...". ה-admin יבחין בקלות בין שני סוגי האירועים.

**בדיקה ידנית מומלצת (באנדרואיד):**
1. גובה רחוק מהכתובת → "💰 בצע גביה" → רואה מודאל אדום עם 3 כפתורים.
2. "✓ אישור והמשך" → ישר לסריקה. ב-DB: שורה חדשה ב-`location_overrides`.
3. חזרה והפעם "📝 דווח על מיקום שגוי" → אותו מודאל עכשיו עם textarea ו-2 כפתורים → כתיבת טקסט → "✓ צור דיווח והמשך לסריקה" → דיווח נכתב ב-`reports` + ניווט לסריקה.
4. "ביטול" במצב B → חזרה למצב A (3 כפתורים), המודאל לא נסגר.
5. כיבוי הרשאת מיקום → "בצע גביה" → אותו מודאל בכחול ("לא הצלחנו לקבל את המיקום"), אותם 3 כפתורים.
6. "ביטול" במצב A → המודאל נסגר וחוזרים לעמוד הקודם.

**קבצים ששונו (2):**
- `frontend-collector/src/pages/CollectionPage.jsx` — מחיקת 3 ה-states הנפרדים (`confirmCard`, `geoUnavailable`, `radiusWarning`) ו-3 המודאלים הנפרדים; הוספת `verifyFailure` + `reportMode` + `reportText` + `reportError` + `reportSubmitting`; אחוד `runVerification` (מסיר את פרמטר `source`); הוספת `openVerifyFailure`/`closeVerifyFailure`/`submitInlineReport`; ייבוא `reportsApi`.
- `frontend-collector/src/pages/ReportFormPage.jsx` — *לא נדרש שינוי כעת* (השינוי הקודם של `next=scan` בוטל; הדיווח מהמודאל מתבצע ישירות מול ה-API ולא דרך העמוד).

---

### 50. הרשאת גובה לדיווח עצמי על משימה (JSONB permissions) — 2026-05-27
**מה נעשה:** הוספתי הרשאה חדשה ברמת משתמש שמאפשרת לגובה ליצור משימה ולדווח עליה כמבוצעת באותה פעולה — לדוגמה התקנה עצמית של קופה או החלפת מנעול שבוצעה בשטח ללא מעורבות מנהל. DB: עמודה חדשה `users.permissions JSONB NOT NULL DEFAULT '{}'`, נטענת idempotent ב-`schema.sql`. הסכמה גמישה לעתיד; כרגע מטופל מפתח אחד: `can_self_report_tasks: boolean`. Backend: ב-`auth.js` (login + /me) ו-`users.js` (list/create/update + PUBLIC_COLUMNS) הוספתי קריאה/כתיבה של `permissions`. ב-users הוספתי `validatePermissions` שמסנן מפתחות לא ידועים ומאמת טיפוסים (Boolean) — כך שגם אם הקליינט שולח אשפה לא יישבר ה-DB. ב-`POST /api/tasks` שיניתי את ה-gate: admin ממשיך כרגיל; collector מקבל אישור רק אם `permissions.can_self_report_tasks=true`. עבור collector — `assigned_to=created_by=req.user.id` כפוי; משימות `grants_temporary_access` (גביה) חסומות (מקרה שימוש לא הגיוני); ואם הבקשה כללה `self_report:true`, אחרי ה-INSERT מופעל `completeTask` באופן מיידי, וה-endpoint מחזיר את ה-task המלא אחרי לחזרה (כולל היצירה של ה-box+card למשימת התקנה — תלוי בנושא 48). שגיאות מ-completeTask ממופות ל-status codes ברורים עם `task_id` כדי שה-UI יוכל לכוון את המשתמש לתקן ולהריץ /complete ידנית. Frontend admin: ב-`UserModal` הוסף state חדש `canSelfReportTasks`, צ'קבוקס "🔐 הרשאות מיוחדות — יכול לדווח על משימות שביצע בעצמו" שמוצג רק לגובים, ובניית `permissions` payload בשמירה (מתאפסת ל-`{}` בתפקיד שאינו collector). Frontend collector: רכיב חדש `SelfReportTaskModal` שמתאים את הזרימה לגובה — בוחר סוג משימה (פילטר אוטומטי לסוגי "גביה"), אם opens_card מבקש iron_number+סוג קופה+מיקום, אחרת בוחר קופה קיימת; שולח עם `self_report:true`. ב-`TasksAlertsPage` הוספתי `canSelfReport` (תלוי ב-`user.permissions.can_self_report_tasks`) וכפתור "➕ דווח על משימה שביצעתי" שפותח את ה-modal. הערה: משתמשים שכבר מחוברים (token תקף) צריכים להתנתק ולהתחבר מחדש כדי להוריד את ה-permissions לתוך ה-localStorage. כל ה-57 unit tests עוברים.

**קבצים ששונו:**
- backend/src/db/schema.sql (ALTER TABLE users ADD COLUMN permissions JSONB NOT NULL DEFAULT '{}')
- backend/src/routes/auth.js (login + /me מחזירים permissions)
- backend/src/routes/users.js (PUBLIC_COLUMNS + validatePermissions + POST/PUT מקבלים permissions)
- backend/src/routes/tasks.js (POST / — גובה עם can_self_report_tasks; self_report=true → completeTask מיידי)
- frontend-admin/src/components/UserModal.jsx (state canSelfReportTasks + checkbox + payload permissions)
- frontend-collector/src/components/SelfReportTaskModal.jsx (חדש — טופס יצירה+ביצוע משולב לגובה)
- frontend-collector/src/pages/TasksAlertsPage.jsx (canSelfReport + כפתור + מודאל)

---

### 49. יצירת קופה ב-BoxesPage פותחת גם כרטסת (שדות חובה) — 2026-05-27
**מה נעשה:** הפכתי את `POST /api/boxes` לפעולה משולבת — יוצרת קופה ופותחת לה כרטסת ראשונה באותה טרנזקציה. הזרימה החדשה: ה-endpoint מקבל בנוסף ל-`iron_number`/`box_type_id`/`notes` גם את פרטי הכרטסת (`city` כשדה חובה, ו-`neighborhood`/`street`/`building`/`location_notes`/`custom_name`/`installation_type`/`alert_days_personal`/`receipt_required`/`receipt_details` כאופציונליים). הקופה נוצרת עם `status='active'` ישירות, וקריאה ל-`openCard` עם `EVENT.INSTALLATION` באותה client מבטיחה ROLLBACK אטומי במידה ויש כשל. אם `iron_number` כפול (23505) → 409; `box_type_id` לא תקין (23503) → 400. הקריאה מחזירה את ה-box המעודכן עם `card` בתוכו. ב-frontend: `BoxModal` קיבל מצב create מורחב עם בלוק "📇 פרטי הכרטסת" — שדות עיר/שכונה/רחוב/בניין דרך `LocationCombobox`, הערות מיקום, שם מותאם, סוג התקנה, טווח התראה אישי, וצ'קבוקס "דרוש קבלה" עם שדה פרטים תלוי-מצב. מצב edit נשאר ללא שינוי (עורכים שדות כרטסת מ-`CardDetailPage`). הוולידציה: `city` חובה במצב create. שאר הזרימות (`PUT /api/boxes/:id`, `PATCH /:id/status`) לא נגעו ועובדות כרגיל. כל ה-57 unit tests עוברים. הערה: 2 integration tests משתמשות ב-`insertBox` בעבודה ישירה מול ה-DB (לא דרך ה-endpoint) — לא מושפעות.

**קבצים ששונו:**
- backend/src/routes/boxes.js (POST / מורחב: לקבל פרטי כרטסת + להריץ openCard באותה טרנזקציה)
- frontend-admin/src/components/BoxModal.jsx (state חדש + בלוק "פרטי הכרטסת" במצב create + ולידציית עיר)

---

### 48. משימת התקנה ללא מספר קופה — הזנה מאוחרת בעת הביצוע — 2026-05-27
**מה נעשה:** הפכתי את `tasks.box_id` ל-nullable כך שאפשר ליצור משימת התקנה (opens_card) ללא בחירה מראש של קופה — מספר הברזל וסוג הקופה יוזנו בעת לחיצה על "אישור ביצוע", והקופה והכרטסת ייווצרו באותה טרנזקציה. הזרימה: ב-`POST /api/tasks` (admin) מתירים כעת `box_id=null` רק כש-task_type.opens_card=true (משימות שאינן התקנה עדיין מחייבות קופה קיימת + כרטסת פעילה). ב-`completeTask` (cardLogic.js) הוספתי בלוק שמתבצע לפני openCard: אם `task.box_id IS NULL`, נדרשים `iron_number` ו-`box_type_id` ב-body, ה-box נוצר עם `status='active'`, ה-task מתעדכן ל-box_id החדש, ואז הזרימה ממשיכה כרגיל. הוספתי טיפול בשגיאות (409 על iron_number כפול, 400 על box_type_id לא תקין/iron_number חסר). ב-frontend: ב-`TaskModal` מסתירים את שדה הקופה כשנבחר סוג opens_card ומציגים הודעה ("מספר הקופה וסוג הקופה יוזנו בעת אישור הביצוע"). ב-`TaskExecModal` (גם admin וגם collector) מציגים בלוק "🆕 פרטי הקופה החדשה" עם שדות `מספר ברזל` + `סוג קופה` (select מתוך `boxTypes.getAll()`) — שני השדות חובה כשאין `task.box_id`. JOIN-ים ל-`boxes` ב-`fetchTaskWithType` וב-`GET /api/tasks` הומרו ל-`LEFT JOIN` כדי לתמוך ב-tasks ללא קופה. כל ה-57 unit tests עוברים.

**קבצים ששונו:**
- backend/src/db/schema.sql (ALTER TABLE tasks ALTER COLUMN box_id DROP NOT NULL)
- backend/src/routes/tasks.js (LEFT JOIN על boxes; box_id אופציונלי ב-POST; שגיאות חדשות ב-/complete)
- backend/src/logic/cardLogic.js (בלוק יצירת קופה ב-completeTask כש-task.box_id null)
- frontend-admin/src/components/TaskModal.jsx (הסתרת שדה הקופה לעיצוב opens_card + alert info)
- frontend-admin/src/components/TaskExecModal.jsx (בלוק "פרטי הקופה החדשה" + iron_number/box_type_id ב-body)
- frontend-collector/src/components/TaskExecModal.jsx (אותו דבר לגובה)
- frontend-collector/src/pages/TasksAlertsPage.jsx (תווית "קופה חדשה (יוזן בביצוע)" ברשימה)

---

### 51. החלפת מספר קופה בכרטסת — 2026-05-27
**מה נעשה:** הוספתי endpoint `POST /api/cards/:id/swap-box` שמחליף את הקופה הפיזית מאחורי כרטסת פעילה ושומר את כל היסטוריית הכרטסת (מעטפות/אירועים/גביות). הלוגיקה בטרנזקציה: לוודא שהכרטסת פעילה, לאתר את הקופה החדשה לפי `iron_number`, לדחות אם זו אותה קופה או אם יש לקופה החדשה כרטסת פעילה, לעדכן `cards.box_id`, להעביר את הקופה החדשה ל-`active`, את הישנה ל-`unusable` (החלטת מוצר), וליצור event `box_swapped` בכרטסת עם תיאור "החלפת קופה <ישן> → <חדש>" + סיבה אופציונלית. הוספתי קבוע `EVENT.BOX_SWAPPED` ב-`cardLogic.js` ולייבל "החלפת קופה" (pill סגול) ב-`EventsTab`. ב-frontend: `cards.swapBox(id, body)` ב-`endpoints.js`, רכיב חדש `SwapBoxModal.jsx`, וכפתור "🔁 החלף קופה" ב-`CardDetailPage` (admin בלבד, רק על כרטסת פעילה). הטסטים — 57/57 unit עוברים.

**קבצים ששונו:**
- backend/src/logic/cardLogic.js (EVENT.BOX_SWAPPED)
- backend/src/routes/cards.js (POST /:id/swap-box)
- frontend-admin/src/api/endpoints.js (cards.swapBox)
- frontend-admin/src/components/SwapBoxModal.jsx (חדש)
- frontend-admin/src/pages/CardDetailPage.jsx (state + כפתור + מודאל)
- frontend-admin/src/pages/cardTabs/EventsTab.jsx (תווית box_swapped)

---

### 47. עמוד משימות (admin) — מסנן "התקנות (כולל העברה)", מסנן חודש ביצוע, שורת סיכום — 2026-05-14
**מה נעשה:** העשרת עמוד המשימות של ה-admin כך שניתן יהיה לענות על השאלה "כמה התקנות בוצעו בחודש X על ידי גובה X":
1. **מסנן סוג** — נוסף פריט בראש הרשימה: "התקנות (כולל העברה)". בוחר את כל המשימות שסוג שלהן `opens_card = TRUE` (כלומר התקנה + העברת מיקום ביחד).
2. **מסנן חודש ביצוע** — `<input type="month">` חדש. מסנן לפי `executed_at` הנופל בחודש שנבחר; משימות ללא `executed_at` (פתוחות / בטיפול) מוסתרות כשבוחרים חודש.
3. **שורת סיכום בתחתית הטבלה** — `<tfoot>` חדש עם `colSpan={8}`: "סה"כ N משימות · הושלמו · פתוחות · בטיפול · לא בוצעו (רק אם יש) · בוטלו (רק אם יש)". הפירוט מחושב על `filtered` כך שמשתקף ה-state אחרי הסינון, וצבעים תואמים ל-`STATUS_LABELS` (green/yellow/accent/purple/text2).
4. **כפתור איפוס** מאפס גם את החודש.

**הזיהוי של "התקנות"** נעשה דרך `task_types.opens_card`: בנתה Set מ-`types` שמכילה את כל ה-IDs של סוגי משימות עם `opens_card=TRUE` (`התקנה` opens-only, `העברת מיקום` opens+closes). הסינון בודק `installTypeIds.has(t.task_type_id)`.

**קבצים ששונו (1):**
- `frontend-admin/src/pages/TasksPage.jsx` — state חדשים (`month`, `INSTALL_GROUP`), `installTypeIds` (useMemo), הרחבת `filtered` (useMemo) עם בלוקים ל-typeId=group ול-month, `filteredBreakdown` חדש (useMemo), אפשרות חדשה ב-select הסוג, field חדש לחודש, `tfoot` חדש בטבלה, `resetFilters` מאפס גם את החודש.

**הערות עיצוב:**
- בחרתי קבוצה "התקנות (כולל העברה)" ולא לחזק אחד אחד דרך multi-select של ה-select כדי להישאר עקבי עם כל שאר ה-selects בעמוד (single-select) ועם הוויירפריים.
- שורת הסיכום משתמשת ב-`background: var(--bg2, rgba(0,0,0,0.03))` עם fallback כך שתעבוד גם אם המשתנה לא מוגדר בערכת הצבעים.
- חישוב החודש משתמש ב-`getFullYear()` + `getMonth()+1` במקום ISO substring כדי לכבד את אזור הזמן המקומי (שלא להזיז משימה שבוצעה ב-23:00 לחודש הבא).

**בדיקה ידנית מומלצת:**
1. נכנסים כ-admin → עמוד "משימות".
2. בוחרים "סוג: התקנות (כולל העברה)" → רואים רק שורות עם 🔧 התקנה ו-🔄 העברת מיקום.
3. בוחרים חודש (למשל "2026-05") → רואים רק משימות שבוצעו במאי 2026; שורת הסיכום מתעדכנת.
4. בוחרים גם גובה ספציפי → התשובה לשאלה "כמה התקנות עשה X בחודש Y" היא המספר ב-`סה"כ`.
5. "↺ איפוס" מנקה את כל המסננים כולל החודש.

---

### 46. סגירת משימה ע"י דיווח "לא בוצעה" (collector) — 2026-05-13
**מה נעשה:** הוספת זרימה שלמה לסגירת משימה כ"לא בוצעה" ע"י הגובה המשויך, עם סיבה חופשית. הסטטוס החדש `not_executed` נוסף ל-CHECK של `tasks.status`, ועמודה `not_executed_reason TEXT`. אירוע חדש `task_not_executed` נרשם על הכרטסת הקשורה למשימה (best-effort: `task.card_id`, ובהיעדרו — הכרטסת הפעילה של הקופה). **שום פעולה על מחזור חיים של כרטסת/קופה** — גם למשימות `opens_card`/`closes_card` רק האירוע נרשם, ללא פתיחה/סגירה של כרטסת.

**Backend:**
- `backend/src/db/schema.sql` — CHECK חדש לטבלת `tasks` (`not_executed` נוסף), עמודה `not_executed_reason`, migration block בתחתית להפעלה מחדש בטוחה על DB קיים.
- `backend/src/logic/cardLogic.js` — פונקציה `reportTaskNotExecuted(taskId, reason, userId)` בעטיפת transaction (`SELECT … FOR UPDATE`, חוסם state final, UPDATE לסטטוס + reason + executed_at, INSERT event ב-`task_not_executed` רק אם נמצאה כרטסת). EVENT enum הורחב.
- `backend/src/routes/tasks.js` — endpoint `POST /api/tasks/:id/not-executed` מוגן ב-`requireRole('collector')`, בודק שהמשימה משויכת ל-user, ושהסיבה לא ריקה אחרי trim. `VALID_STATUSES` הורחב.
- `backend/tests/integration/cardLogic.test.js` — 5 בדיקות חדשות: opens_card לא פותח כרטסת, closes_card לא סוגר, חסימת state final (done/cancelled/already-reported), דחיית סיבה ריקה, רישום אירוע על הכרטסת הפעילה.

**Frontend-collector:**
- `frontend-collector/src/api/endpoints.js` — `tasks.reportNotExecuted(id, reason)`.
- `frontend-collector/src/components/TaskNotExecutedModal.jsx` — מודאל חדש עם textarea חובה ואישור (`btn danger`).
- `frontend-collector/src/pages/TaskViewPage.jsx` — כפתור משני "❌ לא בוצעה" ליד "אישור ביצוע", הוספת `not_executed` ל-`STATUS_LABEL`, ל-`isFinal`, ולהצגת `not_executed_reason` במסך הסופי. ניווט חזרה ל-tasks-alerts אחרי הצלחה.
- `frontend-collector/src/components/TaskExecDetailsModal.jsx` — כותרת/קופי מותאמים ל-not_executed, הצגת `not_executed_reason` במצב read-only.
- `frontend-collector/src/index.css` — מחלקת `.btn-block.danger` חדשה (אדום).

**Frontend-admin:**
- `frontend-admin/src/api/endpoints.js` — `tasks.reportNotExecuted` (למרות שאינו זמין ל-admin בבק — נשאר עקבי לחשיפת ה-API מהקליינט).
- `frontend-admin/src/pages/TasksPage.jsx` — `not_executed` ב-`STATUS_LABELS` עם pill `purple`, באפשרויות הסינון, ב-`isDone`, ב-tooltip של הסטטוס (`סיבת אי-ביצוע: …`), ובייצוא CSV (גם `cancellation_reason` שהיה חסר).
- `frontend-admin/src/pages/cardTabs/TasksTab.jsx` — אותן התאמות במסך טאב המשימות של כרטסת.
- `frontend-admin/src/components/TaskExecDetailsModal.jsx` — כותרת/קופי + הצגת `not_executed_reason`.

**שיקול עיצובי:**
- הסטטוס `not_executed` נבחר במקום שימוש חוזר ב-`cancelled` כדי לאפשר הפרדה אמיתית בדיווחים: ביטול הוא פעולת admin על משימה שכבר לא רלוונטית; "לא בוצעה" הוא דיווח של הגובה בשטח שלא הצליח, ויש לתת על כך גלוי בייצוא ו-tooltip נפרד.
- אירוע על הכרטסת נרשם רק אם קיימת כרטסת — למשימות `opens_card` שאף פעם לא נפתחה להן כרטסת אין לאן לרשום, וזה בסדר (הדיווח עדיין נשמר על המשימה עצמה).
- כפתור "לא בוצעה" משמש כפעולה הפוכה ל"אישור ביצוע" באותו מסך, כך שזרימת המשתמש זהה: גובה רואה משימה משויכת → לוחץ אחד משני הכפתורים → מודאל קצר → חזרה לרשימה.

**migration לפרודקשן:** הפקודות בסוף `schema.sql` הן idempotent (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`), אז `npm run db:init` יעדכן DB קיים בלי איבוד נתונים.

**בדיקה ידנית נדרשת בפרודקשן (לא הרצתי כאן):**
1. `cd backend && npm run db:init` להחלת ה-migration.
2. כניסה כ-collector → משימה משויכת → "❌ לא בוצעה" → סיבה → אישור → לוודא ש-status בטבלה הוא `not_executed`, יש שורה ב-`events.type=task_not_executed`, והכרטסת/קופה לא השתנו.
3. כניסה כ-admin → לוודא badge "לא בוצעה" סגול + tooltip עם הסיבה, וייצוא CSV מכיל את העמודה.

**קבצים ששונו (13):**
- `backend/src/db/schema.sql`
- `backend/src/logic/cardLogic.js`
- `backend/src/routes/tasks.js`
- `backend/tests/integration/cardLogic.test.js`
- `frontend-collector/src/api/endpoints.js`
- `frontend-collector/src/components/TaskNotExecutedModal.jsx` (חדש)
- `frontend-collector/src/components/TaskExecDetailsModal.jsx`
- `frontend-collector/src/pages/TaskViewPage.jsx`
- `frontend-collector/src/index.css`
- `frontend-admin/src/api/endpoints.js`
- `frontend-admin/src/pages/TasksPage.jsx`
- `frontend-admin/src/pages/cardTabs/TasksTab.jsx`
- `frontend-admin/src/components/TaskExecDetailsModal.jsx`

---

### 41. סכום "הוזן היום" — סינכרון מול הבק — 2026-05-11
**מה נעשה:** בעמוד חדר כסף הסטטיסטיקות "הוזנו היום" ו"סה"כ הוזן היום" חושבו עד עכשיו לפי state מקומי של הדפדפן (`enteredToday` ו-`totalToday` עם `useMemo`). זה גרר שלושה באגים:

1. **רענון הדף איפס לאפס** — `enteredToday` הוא state ב-React, נמחק בכל mount מחדש.
2. **הזנה ממכשיר/דפדפן אחר לא נספרה** — אין סנכרון בין סשנים.
3. **עריכת סכום של מעטפה קיימת לא עדכנה את הסכום** — ב-`handleEnvSaved` הקוד היה `if (prev.some(e => e.id === updated.id)) return prev` כלומר התעלם מעריכה.

הפתרון: source-of-truth יחיד בשרת.

- **Backend — `GET /api/envelopes/today-total`** (`backend/src/routes/envelopes.js`): endpoint חדש מוגן ב-`requireRole('admin', 'cashroom')` שמחזיר `{ total, count }`. השאילתה: `SUM(amount)` + `COUNT(*)` של מעטפות עם `status='entered'` ו-`entered_at` בטווח `[date_trunc('day', NOW()), date_trunc('day', NOW()) + 1 day)`. בחירת `date_trunc` במקום `CURRENT_DATE` כי `entered_at` הוא TIMESTAMP — `date_trunc` ביחד עם `NOW()` עובד מול שני הסוגים (TIMESTAMP / TIMESTAMPTZ). הוצב לפני `/:id` כדי לא להתנגש בנתיב הדינמי. נוסף לפני `by-number` בקובץ.

- **Endpoints client** — נוסף `envelopes.todayTotal()` ב-`frontend-admin/src/api/endpoints.js`.

- **`CashroomAdminPage.jsx`** —
  - הוסר `enteredToday` state ו-`totalToday` ה-`useMemo`.
  - הוסר ה-import של `useMemo` (לא נדרש יותר).
  - נוסף `todayStats` state עם `{ total, count }` ופונקציה `loadTodayStats()` שקוראת ל-`envelopesApi.todayTotal()` ושמה את התוצאה. כשלון רשתי לא דורס את הערך הקודם (best-effort).
  - `loadTodayStats()` נקראת ב-mount ובסוף `handleEnvSaved` (אחרי כל הזנה/עריכה).
  - שני הכרטיסים בסטטיסטיקה משתמשים עכשיו ב-`todayStats.count` ו-`formatMoney(todayStats.total)`.

**שיקול עיצובי:** השרת הוא הסמכות היחידה לסכום היומי. הקליינט מבצע fetch קטן וזול (`SUM/COUNT` מסונן ב-`entered_at`) בכל אינטראקציה משמעותית — לא יקר חישובית אבל מבטיח עקביות בין דפדפנים, רענונים, וגם אם משתמשת אחרת הזינה במכשיר אחר. הפונקציה `isToday` נשארה ב-קובץ כי היא עדיין משמשת לבדיקת ניתנות לעריכה ברשימת "מעטפות אחרונות" (`editable = isToday(e.entered_at)`).

**קבצים ששונו:**
- `backend/src/routes/envelopes.js` — endpoint חדש `/today-total`.
- `frontend-admin/src/api/endpoints.js` — `envelopes.todayTotal`.
- `frontend-admin/src/pages/CashroomAdminPage.jsx` — החלפת state מקומי בקריאה לשרת.

---

### 40. תאריך ביצוע במשימות — טבלה + ייצוא — 2026-05-11
**מה נעשה:** הייצוא לאקסל ב-`TasksPage.jsx` כבר כלל את `executed_at` כעמודה "בוצע" (שורה 210). היה חסר בתצוגת הטבלה עצמה. נוסף:

- **עמודה חדשה "תאריך ביצוע" בטבלה** — אחרי "סטטוס", לפני "משויך". מציגה `executed_at` בפורמט עברי קצר (`toLocaleDateString('he-IL')`). למשימות שעדיין לא בוצעו (`status='open'` או `in_progress`) מוצג `—` באפור.
- **Sort accessor חדש `executed`** — ממיין לפי `Date(executed_at)` עולה/יורד; ערכי `null` ימוינו לסוף (Date-comparison של null נחשב 0 ב-`useSortable`).
- **ה-API כבר מחזיר `executed_at`** — `backend/src/routes/tasks.js:35` משתמש ב-`SELECT t.*`, כך שהשדה זמין כבר ב-payload. אין צורך בשינוי בק-אנד.
- **בייצוא** — ה-CSV ממשיך להציג את אותה עמודה כפי שעשה קודם, אבל עכשיו המשתמש רואה אותה גם בטבלה ולא רק בייצוא.

**קבצים ששונו:**
- `frontend-admin/src/pages/TasksPage.jsx` — הוספת `executed` ב-`sortAccessors`, `<SortableTh sortKey="executed">`, ו-`<td>` שמציג את הערך.

---

### 39. ייצוא לאקסל בעמוד "כרטסות" ובעמוד "קופות" — 2026-05-11
**מה נעשה:** עמוד "כרטסות" כבר היה עם ייצוא לאקסל (`exportCards()` ב-`utils/exportToCsv.js`, כפתור ב-`CardsPage.jsx:199-203`) — מייצא את `filtered` (כלומר מה שמוצג אחרי סינון לפי חיפוש/סטטוס/עיר/גובה/טאב), בקובץ `כרטסות_DD.MM.YYYY.csv` עם BOM ל-UTF-8 (כך עברית מוצגת תקין באקסל).

עמוד "קופות" (BoxesPage) לא היה עם ייצוא. נוסף:

- **`exportBoxes(boxes, tab, ctx, filename)`** ב-`utils/exportToCsv.js` — פונקציה שמייצרת רשימת עמודות ושורות לפי הטאב הפעיל:
  - **no_card** (ללא כרטסת פעילה): מספר קופה, סוג, כרטסת אחרונה, תאריך סגירת כרטסת.
  - **active** (כרטסות פעילות): מספר קופה, סוג, כרטסת פעילה, עיר, שכונה, רחוב, בנין.
  - **unusable** (לא שמישות): מספר קופה, סוג, כרטסת אחרונה, הערות.
- **כפתור "📥 יצוא לאקסל"** נוסף ב-`BoxesPage.jsx` בשורת המסננים, לצד "↺ איפוס". מקבל `filtered` + `activeTab` + מפות עזר (`labels`, `lastClosedByBox`, `activeCardByBox`) ושם קובץ דינמי (`קופות_<טאב>_DD.MM.YYYY`). מנוטרל כשאין נתונים לייצוא.

**שיקול עיצובי:** הסטים של העמודות שונים בין הטאבים כדי שהייצוא יהיה רלוונטי — אין טעם לייצא "עיר/שכונה/רחוב" לטאב של קופות ללא כרטסת. שם הקובץ כולל את שם הטאב כדי להבדיל בקלות בין ייצואים שונים.

**קבצים ששונו:**
- `frontend-admin/src/utils/exportToCsv.js` — הוספת `exportBoxes()`.
- `frontend-admin/src/pages/BoxesPage.jsx` — import של `exportBoxes` + כפתור ייצוא בשורת המסננים.

---

### 35. גובה — סליידר מצומצם והרשאות מוגבלות בתוך הכרטסת — 2026-05-11
**מה נעשה:** המשימה בוצעה בעבודה קודמת אך לא סומנה כהושלמה. אימות בקוד מאשר שכל ארבעת החלקים פעילים:

- **סליידר מצומצם לגובה:** `Sidebar.jsx` כבר מסנן פריטים לפי `roles` בכל item. עבור role=`collector` נשארים רק: כרטסות, משימות, דיווחים, התראות — כי `/boxes`, `/envelopes`, `/dochot`, `/cashroom-admin`, `/users`, `/settings` מסומנים `roles: ['admin']` (או `['admin','cashroom']`).
- **טאב מעטפות נסתר:** ב-`CardDetailPage.jsx` (שורות 42-51) `isCollector` מסנן את `ALL_TABS` ומשמיט `envelopes`. ברירת המחדל ל-`activeTab` גם היא `events` במקום `envelopes` עבור גובה.
- **אין כפתורי סגירת/פתיחת כרטסת:** שורות 223 ו-229 ב-`CardDetailPage.jsx` עוטפות את הכפתורים ב-`!isCollector`.
- **סינון אירועים לפי גובה:** ב-`EventsTab.jsx` (שורות 48-50) רשימת האירועים מסוננת ל-`Number(e.user_id) === Number(user?.id)` כשהמשתמש הוא collector.

**קבצים ששונו (בעבודה קודמת):**
- `frontend-admin/src/components/Sidebar.jsx`
- `frontend-admin/src/pages/CardDetailPage.jsx`
- `frontend-admin/src/pages/cardTabs/EventsTab.jsx`

---

### 38. כרטסות — כרטיס "לא רוקנו" יציג את כמות התראות אי-גביה — 2026-05-07
**מה נעשה:** בעמוד "כרטסות" (`CardsPage.jsx`) כרטיס הסטטיסטיקה "לא רוקנו" השתמש ב-`alertsApi.getAll()` שפונה ל-`GET /api/alerts` — אנדפוינט שלא קיים בבק-אנד (קובץ `routes/alerts.js` חושף רק `/no-collection`). כתוצאה מכך הקריאה נכשלה (`.catch(() => {})` בלע אותה בשקט) והמספר נותר תמיד 0. החלפתי את הקריאה ל-`alertsApi.noCollection()` שמחזיר `{ global_threshold, count, items: [] }`, וכעת `alertCount` נטען מ-`d.count` (עם fallback ל-`d.items.length`). כך הכותרת בכרטסת "לא רוקנו" מציגה כראוי את מספר ההתראות בפועל מאחורי כרטסות שלא רוקנו בזמן שהוגדר ב-`alert_days_global` (או הסף האישי של הכרטסת).

**קבצים ששונו:**
- `frontend-admin/src/pages/CardsPage.jsx` — `alertsApi.getAll()` → `alertsApi.noCollection()`, וקריאת `d.count` במקום `d.length`.

---

### 36. חדר כסף — מסך נעול יחיד + חסימת API לכל יתר המערכת — 2026-05-07
**מה נעשה:** משתמש מסוג "חדר כסף" (מזין) נכנס למערכת ורואה רק את תצוגת חדר הכסף — בלי סליידר, בלי גישה לעמודים אחרים, ובלי גישת API לאף משאב שאינו קשור לחדר הכסף. ההגבלה היא דו-שכבתית: גם UI נקי וגם Backend חוסם.

- **Backend — חסימת ראוטים שאינם של חדר כסף:** הוספתי `router.use(requireRole('admin', 'collector'))` מיד אחרי `router.use(authenticate)` בכל ראוטר שאינו רלוונטי לחדר כסף — `boxes.js`, `cards.js`, `events.js`, `tasks.js`, `reports.js`, `alerts.js`, `settings.js`, `uploads.js`. כל בקשה של משתמש cashroom לראוטים אלה מחזירה כעת 403. ב-`reportsExport.js` שיניתי את `requireRole('admin', 'cashroom')` ל-`requireRole('admin')` — חדר הכסף איבד את גישתו לעמוד הדוחות (`/dochot`). `users.js` ממילא היה `admin`-only. ראוטר ה-envelopes נשאר ללא חסימה כללית כי שם נמצאים בדיוק האנדפוינטים שחדר הכסף צריך — `/pending`, `/entered-recent`, `/by-number/:n`, `PUT /:id`, `PATCH /:id/amount` — וכולם כבר היו מוגנים ב-`requireRole('admin', 'cashroom')` ברמת ה-endpoint. אנדפוינט ה-Login וה-`/auth/me` נשארו פתוחים כדי לאפשר התחברות ושמירת סשן.

- **Frontend — סליידר נעלם:** ב-`Layout.jsx` הוספתי בדיקת `isCashroom = user?.role === 'cashroom'` ועיטוף ה-`<Sidebar />` ב-`{!isCashroom && ...}`. כך משתמש cashroom רואה רק את ה-TopBar (שם משתמש + יציאה) ואת התוכן הראשי, ללא ניווט צדי בכלל.

- **Frontend — נעילת ניווט:** ב-`App.jsx` הוספתי רכיב `CashroomLockGuard` שעוטף את ה-Layout בתוך ה-ProtectedRoute. הרכיב בודק `useLocation()` ואם המשתמש הוא cashroom וה-URL אינו `/cashroom-admin` — מבצע `<Navigate to="/cashroom-admin" replace />`. זה מטפל בכל וקטורי הניווט: הקלדה ידנית של URL, deep-link, רענון של דף, או ניסיון לעקוף את הסליידר. בנוסף, `defaultPathForRole('cashroom')` כבר היה מחזיר `/cashroom-admin` (מההתממשות הקודמת של 36) — כך שגם כניסה מ-`/login` או מהשורש מובילה ישר לתצוגת חדר הכסף.

- **שיקול עיצובי:** ההגנה הדו-שכבתית (UI + Backend) מבטיחה שגם אם משתמש cashroom ישנה משהו ב-DOM/devtools או ינסה לקרוא ידנית ל-API — הוא יקבל 403 מהשרת. ה-CashroomLockGuard מותקן כעטיפה ב-Route element ולא כ-middleware של React Router כדי שהוא יחול גם על URL-ים שאינם בעץ הראוטים שלנו (catch-all `*` הופך ל-`HomeRedirect` שגם הוא מחזיר ל-`/cashroom-admin`).

**קבצים ששונו:**
- `backend/src/routes/boxes.js` (`router.use(requireRole('admin', 'collector'))`)
- `backend/src/routes/cards.js` (אותו דפוס)
- `backend/src/routes/events.js` (אותו דפוס)
- `backend/src/routes/tasks.js` (אותו דפוס)
- `backend/src/routes/reports.js` (אותו דפוס)
- `backend/src/routes/alerts.js` (import של `requireRole` + `router.use(requireRole(...))`)
- `backend/src/routes/settings.js` (אותו דפוס)
- `backend/src/routes/uploads.js` (import של `requireRole` + `router.use(requireRole(...))`)
- `backend/src/routes/reportsExport.js` (`requireRole('admin', 'cashroom')` → `requireRole('admin')`)
- `frontend-admin/src/components/Layout.jsx` (import של `useAuth`; הסתרת ה-Sidebar למשתמש cashroom)
- `frontend-admin/src/App.jsx` (הוספת `CashroomLockGuard` ועטיפת ה-Layout בו; import של `useLocation`)

---

### 37. חדר כסף — רשימת מעטפות אחרונות + הרשאת תיקון ביום ההזנה — 2026-05-07
**מה נעשה:** הוטמע במלואו במהלך עבודה קודמת אך לא סומן כהושלם רשמית. הסטטוס מתעדכן עכשיו בעקבות מיפוי המצב בזמן ביצוע משימה 36.

- **תצוגת "מעטפות אחרונות":** `frontend-admin/src/pages/CashroomAdminPage.jsx` כולל פאנל בתחתית הדף שמציג את 20 המעטפות האחרונות שהוזנו, עם `iron_number`, עיר, גובה, מי הזין, וסכום. הנתונים נמשכים מ-`envelopesApi.getRecentEntered(20)` ומתרעננים אוטומטית בכל הזנה/עריכה (`loadRecent()` נקרא בתוך `handleEnvSaved`).
- **API ייעודי:** `GET /api/envelopes/entered-recent` ב-`backend/src/routes/envelopes.js` — מחזיר עד 100 מעטפות שהוזנו, ממויינות `entered_at DESC NULLS LAST`. מוגן ב-`requireRole('admin', 'cashroom')`. ברירת מחדל 20, פרמטר `?limit=N`.
- **הרשאת תיקון ביום ההזנה בלבד:** `PATCH /api/envelopes/:id/amount` בודק `if (req.user.role === 'cashroom')` שה-`entered_at` הוא today (לפי `getFullYear/getMonth/getDate`). אם לא — 403 עם הודעה "ניתן לתקן מעטפה רק ביום ההזנה שלה". לאדמין אין הגבלה. כל תיקון יוצר אירוע `amount_changed` בכרטסת עם הסכום הישן והחדש לאודיט.

**קבצים שכבר היו מוטמעים (אין שינוי בסיבוב הזה):**
- `backend/src/routes/envelopes.js` — אנדפוינט `/entered-recent` ובלוק ה-same-day-check ב-`PATCH /:id/amount`.
- `frontend-admin/src/pages/CashroomAdminPage.jsx` — state `recent` + `loadRecent()` + פאנל "מעטפות אחרונות" בתחתית הדף.
- `frontend-admin/src/components/CashroomModal.jsx` — מצב `edit` שנפתח על מעטפות שכבר הוזנו (UX-wise חדר הכסף יראה כפתור "ערוך סכום" רק על מעטפות מהיום, אבל גם אם יבקש ידנית, השרת יחזיר 403).
- `frontend-admin/src/api/endpoints.js` — `envelopes.getRecentEntered`.

---

### 34. שיוך קופה — תמיכה בכמה גובים במקביל ("כפילויות") — 2026-05-06
**מה נעשה:** השיוך של קופה לגובה הפך מ-1:1 ל-N:M — כל גובה שכלליו תופסים את הכרטסת (ולא קיים אצלו כלל החרגה תואם) משויך אליה. הסינונים בכל המסכים שמסתמכים על שיוך הותאמו: דורסי מספר קופה, קופות ללא גביה ודוח "פר קופה" מציגים עכשיו רשימת גובים מלאה ("יוסי, חיים") ומאפשרים סינון לפי גובה אחד מתוך הקבוצה.

- **בק-אנד (`backend/src/logic/userAssignment.js`):** הוספתי `RESOLVED_COLLECTORS_LATERAL` (ברבים) — `LEFT JOIN LATERAL` שמאגדת את **כל** הגובים הפעילים שמתאימים לכרטסת. שאילתת ה-`u.role='collector' AND u.active=TRUE AND EXISTS(...assignments) AND NOT EXISTS(...exclusions)` נשארה זהה ל-`RESOLVED_COLLECTOR_LATERAL` המקורית, אבל בלי `LIMIT 1`/`ORDER BY specificity` — במקום זה `array_agg(u.id ORDER BY u.id)` ל-`ids` (`int[]`), `array_agg(u.name ORDER BY u.id)` ל-`names_arr` (`text[]`), ו-`string_agg(u.name, ', ')` ל-`names` (טקסט מצורף בפסיקים לתצוגה). `COALESCE(..., ARRAY[]::int[])` מבטיח מערך ריק במקום NULL כשאין גובים תואמים. ה-LATERAL הקיים בגרסה היחידנית נשמר (לא נמחק) כי הוא חלק מה-API ייתכן וייעשה בו שימוש חיצוני, אבל אף אחד מהקונסיומרים שלנו כבר לא משתמש בו.

- **בק-אנד — קונסיומרים שעודכנו ל-LATERAL החדש:**
  - **`backend/src/routes/alerts.js`** — `GET /no-collection`: החלפתי את `rc.id AS collector_id, rc.name AS collector_name` ב-`rc.ids AS collector_ids, rc.names_arr AS collector_names, rc.names AS collector_name`. כך התראת "קופה רדומה" מצוננת (לפי הבהרת המשתמשת) "אצל **כל** הגובים המשויכים" — לא רק אחד.
  - **`backend/src/routes/cards.js`** — 4 שאילתות (`GET /`, `GET /lookup-by-iron/:iron_number`, `GET /:id`, `GET /:id/history`) הומרו. שיניתי את `applyResolvedCollector` כך שיעטוף את התוצאה: `collector_ids: int[]`, `collector_names: text[]`, `collector_name: text` (מצורף בפסיקים), ו-`collector_id: ids[0] ?? null` נשמר לתאימות לאחור (לקוחות ישנים שמסתמכים על שדה יחיד עדיין יקבלו את הגובה הראשון לפי id). הסינון `?collector_id=X` ב-querystring שונה מ-`AND rc.id = $X` ל-`AND $X = ANY(rc.ids)` — לקוח שמסנן לפי גובה ספציפי יקבל **כל** קופה ששייכת אליו (גם אם היא משוייכת בנוסף לעוד אחד).
  - **`backend/src/routes/reportsExport.js`** — `GET /per-box`: אותו דפוס — `rc.ids AS collector_ids, rc.names_arr AS collector_names, rc.names AS collector_name`. הדוח נשאר עם עמודה אחת "גובה" שמציגה את כל הגובים המצורפים בפסיקים.

- **פרונט-אנד — סינוני "גובה" עברו לעבוד על מערך:**
  - **`AlertsPage.jsx`** — `ncCollectors` (dropdown) נבנה מ-`it.collector_ids[i]`/`it.collector_names[i]` של כל item (במקום הזוג היחידני `it.collector_id/it.collector_name` הישן). הסינון `it.collector_id === ncCollector` הפך ל-`it.collector_ids.some(id => Number(id) === target)`. תצוגת הגובה (עמודת "גובה" וב-CSV) ממשיכה לקרוא את `it.collector_name` שעכשיו זה מחרוזת מצורפת — כך שמופיע "יוסי, חיים" אוטומטית בלי שינוי בקוד התצוגה.
  - **`CardsPage.jsx`** — אותו דפוס: `collectors` נבנה מהמערכים החדשים, `c.collector_id === collector` הפך לבדיקת חברות במערך `c.collector_ids`. ה-`exportCards` ממשיך לקרוא את `c.collector_name` בלי שינוי.
  - **`DochotPage.jsx`** — שתי לשוניות (`SummaryTab` ו-`CompareTab`). ב-`SummaryTab` ה-state `collectorName` נשמר כשם משתנה (היסטורי), אבל הסמנטיקה שלו השתנתה — מחזיק עכשיו את ה-id של הגובה הנבחר (כדי לאפשר סינון נכון). ה-dropdown משתמש ב-`<option key={c.id} value={c.id}>{c.name}</option>` (במקום `value=name`/`label=name`). הסינון `r.collector_name === collectorName` הומר ל-`r.collector_ids.some(id => Number(id) === target)`. ב-`CompareTab` אותו שינוי על `col.collectorName` (גם הוא עכשיו מחזיק id), ו-`exportCompare` (תוויות עמודות) שוף לשמות דרך מיפוי `collectors.find(x => x.id === col.collectorName)` כדי להציג את שם הגובה ב-label של ה-CSV.

- **קונסיומרים שלא נגעתי בהם בכוונה:**
  - `routes/envelopes.js` — שדה `collector_name` שם מגיע מ-`uc.name AS collector_name FROM users uc ON uc.id = e.collected_by` — זה **הגובה שאסף בפועל** את המעטפה (מתועד ב-`envelopes.collected_by`), לא הגובה ש"אמור" להיות משויך. אין משמעות ל"כפילויות" כאן — מי שאסף את המעטפה הוא מי שאסף.
  - `cardLogic.js findCollectorForLocation` ו-`cards.collector_id` (העמודה ב-DB) — נשארו ללא שינוי. `findCollectorForLocation` עדיין מחזיר גובה יחיד (best-specificity-then-id) ב-`openCard`, וזה נשמר ל-`cards.collector_id`. אבל `routes/cards.js` דורס את הערך הזה ב-`applyResolvedCollector` בזמן קריאה, אז הוא לא מתבטא בשום צד-לקוח. השארתי כדי לא לשנות את הסכימה. אם בעתיד תוסר העמודה — אפשר למחוק גם את `findCollectorForLocation`.
  - שיוך משימות אוטומטי — לפי הבהרת המשתמשת, אין כזה היום (המנהל משייך ידנית), אז לא שיניתי דבר ב-`tasks` או ב-`reports`.
  - תצוגת "הקופות שלי" של גובה — `getBoxesForCollector(userId)` כבר עכשיו תומכת מטבעה במולטי-אסיינמנט: היא מחזירה את הקופות שתואמות **לכללי המשתמש המחובר**, אז אם ל-2 גובים יש כללים שתופסים אותה קופה — כל אחד יראה אותה ב-"הקופות שלי" שלו, בנפרד. אין שינוי נדרש.

**מספר טסטים:** 46 unit tests עוברים (`backend/`). Build של frontend-admin עובר נקי (85 modules, 1.17s). הטסטים הקיימים בודקים את ה-helpers הטהורים (`matchesRule`, `buildLocationClause`, `bestMatchSpecificity`) ולא את ה-LATERAL ישירות — שינוי ה-LATERAL לא שובר אותם.

**קבצים ששונו:**
- `backend/src/logic/userAssignment.js` (הוספת `RESOLVED_COLLECTORS_LATERAL` ויצוא שלו; ה-LATERAL היחידני נשאר)
- `backend/src/routes/alerts.js` (import + select + שאילתת ה-`/no-collection`)
- `backend/src/routes/cards.js` (import + `applyResolvedCollector` החדש; 4 SELECT-ים + שינוי הסינון `?collector_id` ל-`= ANY(rc.ids)`)
- `backend/src/routes/reportsExport.js` (import + select של `/per-box`)
- `frontend-admin/src/pages/AlertsPage.jsx` (`ncCollectors` נבנה מהמערכים, סינון `it.collector_ids.some(...)`)
- `frontend-admin/src/pages/CardsPage.jsx` (אותו דפוס — מערכים במקום שדה יחיד)
- `frontend-admin/src/pages/DochotPage.jsx` (שתי לשוניות — `SummaryTab` + `CompareTab`: dropdown ל-`{id, name}`, סינון לפי `collector_ids.some(...)`, ובלוק `exportCompare` ממיר id חזרה לשם דרך `collectors.find()`)

---

### 31b. דוחות — מיון לפי "קופה" נתקע + הוספת עמודת "כרטסת" — 2026-05-06
**מה נעשה:** המשתמשת זיהתה בדוחות (לשונית "סיכום כללי") שמיון לפי "קופה" לא עובד והטבלה "נתקעת" — כלומר אחרי לחיצה על "קופה" גם מיון לפי עמודה אחרת (כמו "שם / מיקום") מפסיק לעבוד. בנוסף ביקשה להציג גם את התווית של הכרטסת ולא רק מספר הקופה.

- **שורש הבעיה:** SQL של `/api/reports-export/per-box` מצרף `cards c JOIN boxes b` ללא סינון על `c.status`, ולכן לקופה עם היסטוריה (כרטסת פעילה + סגורות) חוזרות **כמה שורות עם אותו `iron_number`**. ב-`SummaryTab` ה-JSX השתמש ב-`<tr key={r.iron_number}>` — מפתחות-React כפולים. ברגע שהמיון מסדר מחדש את השורות, ה-reconciler של React לא יודע איזו שורה ל"זהות" ולכן שומר את אותם DOM-nodes במקומם, גם כשהמיון מחזיר סדר חדש. זה גורם גם לכך שמיון לעמודה אחרת לאחר מכן לא משפיע על המסך — DOM-nodes "תקועים" בסדר הקודם. אגב, `localeCompare` בעצמו עבד נכון; הבעיה הייתה אך ורק ברמת ה-rendering.

- **תיקון 1 — מפתח React:** `<tr key={r.card_id ?? r.iron_number}>` — `card_id` הוא ה-PK של `cards` ולכן ייחודי לכל שורה. ה-`?? r.iron_number` הוא fallback הגנתי, אם כי בפועל כל שורה תמיד מכילה `card_id` כי השאילתה היא `FROM cards c`.

- **תיקון 2 — עמודת "כרטסת":** הוספתי עמודה חדשה בין "קופה" לבין "שם / מיקום" שמציגה את התווית הקנונית (`1019A`/`1019B`/...). הוספתי state `cardLabels` שמתאכלס מתוך אותו `cardsApi.getAll()` שכבר נקרא ב-`useEffect` הקיים (פעם אחת בטעינת הקומפוננטה) — מחושב פעם אחת ב-`computeCardLabels(arr)` ונשמר כמפה. החישוב נעשה על **כל** הכרטסות (כולל סגורות) כך שהאות הוא נכון לפי סדר פתיחה היסטורי. התא קליקבילי באותו דפוס כמו עמודת "קופה" — מנווט ל-`/cards/:id`. כשאין `card_id` לשורה (לא קורה בפועל אבל הגנתי) — מציג "—" אפור.

- **שיקול עיצובי:** שקלתי לחלץ את העמודה מתוך `rows` עצמו (כי כל שורה היא card אחד עם `card_id` ידוע), אבל זה היה מחייב להעביר גם `opened_at` מהשרת (`computeCardLabels` נשען עליו לסדר כרונולוגי), ומיקרו-אופטימיזציה כזו מסבכת את הבק-אנד בלי תועלת ברורה. השארתי את החישוב על-בסיס `cardsApi.getAll()` שכבר נטען בכל מקרה.

- **תיקון 3 — מיון לפי "כרטסת":** הוספתי accessor `card: (r) => cardLabels.get(r.card_id) || ''` ל-`summaryAccessors` (שעודכן ל-`useMemo` עם `[cardLabels]` בתור dependency כדי לרענן את המיון אם הלייבלים מתעדכנים). הכותרת החדשה `<SortableTh sortKey="card">` נוספה מימין ל-"קופה". המיון משתמש באותו localeCompare-with-numeric של עמודות אחרות, כך ש-"1019A" → "1019B" → "1019C" יסתדרו טבעית.

- **תיקון 4 — יצוא CSV:** הוספתי לעמודות ה-CSV את `{ key: 'card_id', label: 'כרטסת', format: (v) => v ? (cardLabels.get(v) || #v) : '' }` בין "קופה" ל"שם מותאם", כדי שגם בקובץ ה-Excel המיוצא תופיע התווית.

- **למה הבעיה לא צצה במקומות אחרים:** ב-`AlertsPage`/`TasksPage`/`ReportsPage`/`CardsPage` ה-`<tr key>` כבר היה `card_id` או `id` (ייחודיים), ולכן המיון תפקד שם תקין מהרגע שמשימה 31 הוחלה.

**מספר טסטים:** Build של frontend-admin עובר ללא שגיאות (85 modules — אותם רכיבים, רק שינויי-תוכן ב-DochotPage, 1.32s).

**קבצים ששונו:**
- `frontend-admin/src/pages/DochotPage.jsx` — ב-`SummaryTab`: state `cardLabels` חדש שמתעדכן ב-useEffect הקיים אחרי `cardsApi.getAll()`; הוספת accessor `card` ל-summaryAccessors (וצירוף `cardLabels` ל-deps של `useMemo`); הוספת `<SortableTh sortKey="card">` בכותרת; שינוי `<tr key={r.iron_number}>` ל-`<tr key={r.card_id ?? r.iron_number}>`; הוספת תא חדש קליקבילי שמציג את התווית; הוספת עמודת "כרטסת" ל-`exportSummary()`.

---

### 31. מיון לפי כותרות הטבלה — דוחות / כרטסות / התראות / משימות / דיווחים — 2026-05-06
**מה נעשה:** כותרות הטבלאות בעמודים הראשיים (דוחות, כרטסות, התראות, משימות, דיווחים) הפכו ללחיצות — לחיצה ראשונה ממיינת עולה ▲, שנייה יורד ▼, שלישית מנקה (חוזר לסדר המקורי). אינדיקטור-מיון קטן (▲/▼ בצבע ה-accent כשפעיל, ↕ אפור כשלא) מוצג ליד שם העמודה. ערכים ריקים (`null` / `''`) הולכים תמיד לסוף, ללא קשר לכיוון.

- **רכיב משותף חדש (`utils/sortable.jsx`):**
  - **`useSortable(rows, columnAccessors, initialSort?)`** — hook שמחזיר `{ sorted, sort, toggle }`. ה-`columnAccessors` הוא מפה `{ [colKey]: (row) => sortableValue }` — כל עמוד מגדיר אותה ב-`useMemo` כדי לא לחשב מחדש. המיון נעשה ב-`useMemo` נפרד, כך שאם ה-`sort` לא משתנה אין השפעת ביצועים.
  - **`compareVals(a, b)`** — מקרים מטופלים: ערכים ריקים → לסוף; שני מספרים → השוואת מספרים; שני `Date` → השוואת `getTime()`; אחרת → `localeCompare('he', { numeric: true, sensitivity: 'base' })` שמטפל גם בעברית וגם במספרים בתוך טקסט (למשל "1019B" אחרי "1019A").
  - **`SortableTh`** — רכיב שמרנדר `<th>` רגיל אבל עם `cursor: pointer`, `userSelect: none`, click handler, ואינדיקטור-חץ קטן ליד הכותרת.
  - מנוע ה-toggle: `null → asc → desc → null` (3 לחיצות חוזרות לבסיס).

- **AlertsPage** — שני פאנלים, כל אחד עם useSortable משלו:
  - פאנל 1 (קופות ללא גביה): מיון לפי שם/קופה (custom_name או iron_number), כרטסת (label), עיר, גובה, גביה אחרונה (Date), ימים (number), סף התראה (אישי או גלובלי כ-number).
  - פאנל 2 (דיווחים פתוחים): מיון לפי קופה, סוג, תיאור, ימים פתוח (חישוב מ-`created_at`).
  - עמודת "פעולה" לא מתמיינת — נשארה `<th>` רגיל.

- **TasksPage** — מיון לפי סוג, קופה, כרטסת, סטטוס, משויך, מקור (1 אם דיווח, 0 אם ידני). עמודת "פעולות" לא מתמיינת.

- **ReportsPage** — מיון לפי תאריך (Date), קופה, כרטסת, סוג, תיאור, גובה, סטטוס. עמודת "פעולה" לא מתמיינת.

- **DochotPage** — שתי לשוניות:
  - **SummaryTab**: מיון לפי קופה, שם/מיקום (custom_name או רחוב+בנין), עיר, שכונה, גובה, קבלה (boolean→0/1), סה"כ (number), מעטפות (number), ממוצע (חישוב), גביה אחרונה (Date).
  - **PerBoxTab**: מיון לפי תאריך (Date), מעטפה, סכום (number), גובה, סטטוס.
  - **CompareTab**: לא קיבל מיון — הוא מציג סטטיסטיקות מצטברות בעמודות, לא טבלת שורות.

- **CardsPage** (כרטסות): מיון לפי קופה, כרטסת (label), עיר, שכונה, רחוב, בנין, גובה, גביה אחרונה (Date), סטטוס, סימונים (משוקלל: דיווח פתוח 2 + משימה פתוחה 1). עמודת ה-button של "פתיחה" לא מתמיינת.

- **שיקול עיצובי:** העדפתי לבנות hook משותף ולא לשכפל לוגיקת מיון בכל עמוד. ה-`columnAccessors` מאפשר להגדיר ערך-מיון שונה מערך-תצוגה (למשל בעמודת "כרטסת" שמציגה pill צבעוני אבל ממיינת לפי label-string), וזה הופך את הפתרון נקי ועקבי בכל המסכים. בחרתי לכבד גם את הסינון (filteredItems, filtered) — המיון רץ אחרי הסינון כך שלא ממיינים שורות שלא יוצגו.

- **לא נכלל בסיבוב הזה (לפי בקשת המשתמשת "בראשים, לא בטאבים פנימיים"):** הטאבים הפנימיים של דף הכרטסת `CardDetailPage` (EnvelopesTab, EventsTab, TasksTab, ReportsTab) נשארו ללא מיון. גם `BoxesPage`, `UsersPage`, `EnvelopesPage`, `CashroomAdminPage` לא נגעתי בהם בסיבוב הזה — נשמר ל-future task אם תבקשי.

**מספר טסטים:** Build של frontend-admin עובר ללא שגיאות (85 modules — נוסף `sortable.jsx`, 1.13s).

**קבצים ששונו:**
- `frontend-admin/src/utils/sortable.jsx` (חדש — hook + רכיב SortableTh + compareVals)
- `frontend-admin/src/pages/AlertsPage.jsx` (import, ncAccessors+repAccessors, החלפת `<th>` ב-`<SortableTh>` ב-2 הפאנלים, החלפת `filteredItems.map`/`filteredReports.map` ב-`sortedItems`/`sortedReports`)
- `frontend-admin/src/pages/TasksPage.jsx` (import, sortAccessors, החלפת כותרות ה-table, `filtered.map` → `sorted.map`)
- `frontend-admin/src/pages/ReportsPage.jsx` (זהה ל-TasksPage)
- `frontend-admin/src/pages/DochotPage.jsx` (import; ב-SummaryTab `summaryAccessors` + sortedRows; ב-PerBoxTab `envAccessors` + sortedEnvs; החלפת כותרות 2 הטבלאות)
- `frontend-admin/src/pages/CardsPage.jsx` (import, sortAccessors, החלפת כותרות, `filtered.map` → `sorted.map`)

---

### 33. דוחות — הצגת גביה אחרונה גם אם היא לפני תקופת הדוח — 2026-05-06
**מה נעשה:** ב-endpoint `/api/reports-export/per-box`, השדה `last_collection_date` חושב עד היום בתוך אותה תת-שאילתה ש־`COUNT`/`SUM` סוננו לפי `from`/`to`. התוצאה: לקופה שגביתה האחרונה הייתה לפני תקופת הדוח, השדה חזר `NULL` והיא הוצגה בטבלה עם "—" במקום בתאריך הגביה האמיתי. פיצלתי את האגרגציה ל-2 תת-שאילתות נפרדות שעוברות ב-LEFT JOIN על הכרטסת:
- `envSubquery` — ממשיכה לסנן לפי טווח התאריכים, ומחזירה רק `collection_count` ו-`total_amount` (התקופה צריכה להגביל את הסכומים — זו ההתנהגות המצופה).
- `lastCollectionSubquery` — חדשה, **ללא** סינון לפי תאריך, מחזירה `MAX(collected_at)` לכל `card_id` עם `status = 'entered'`. זוהי "גביה אחרונה אבסולוטית".
התוצאה: השדה `last_collection_date` ש־`/per-box` מחזיר תמיד מציג את הגביה האחרונה האמיתית של הכרטסת, גם כשהיא קודמת לתחום הדוח. הסינון של `from`/`to` עדיין משפיע על הסכום הכולל ועל מספר המעטפות, כפי שצריך — רק תאריך-הגביה-האחרונה משוחרר מההגבלה.

**הערה:** הפרונט (`DochotPage.jsx` ב-`SummaryTab`) כבר היה מוכן — הוא קורא ישירות ל-`r.last_collection_date` ומפרמט אותו עם `formatDate()` (או "—" אם null). לכן לא נדרש שינוי frontend. גם ב-`/api/cards` השדה `last_collection_at` כבר היה מחושב ללא סינון תאריך (`GREATEST(MAX(envelopes.collected_at), MAX(events.created_at))`), כך שכרטסות במסך הכרטסות עצמו לא הושפעו מאי-פעם מהבאג הזה.

**קבצים ששונו:**
- `backend/src/routes/reportsExport.js` (פיצול תת-השאילתה ב-`/per-box` ל-`envSubquery` עם סינון תאריך + `lastCollectionSubquery` ללא סינון; הוספת LEFT JOIN שני; שינוי `e.last_collection_date` ל-`lc.last_collection_date` ב-SELECT הראשי)

### 32. דוח לפי מספר קופה / דוח השוואה — חלונית בחירת כרטסת — 2026-05-06
**מה נעשה:** בדוחות שמסוננים לפי מספר קופה, אם לקופה יש יותר מכרטסת אחת בהיסטוריה — נפתחת חלונית בחירה שמראה את כל הכרטסות (עם תווית כמו `1019A`/`1019B`, מיקום, סטטוס פעילה/סגורה, ותאריכי פתיחה/סגירה) ושואלת על איזו כרטסת להפיק את הדוח.

- **רכיב חדש (`CardChoiceModal.jsx`):** מודאל מותאם שמקבל `ironNumber` + מערך `cards` + `onSelect`/`onClose`. השתמשתי ב-`computeCardLabels()` הקיים (`utils/cardLabel.js`) כדי לתת את התווית הקנונית לפי סדר פתיחה (oldest=A). תצוגה: רשימת כפתורים, מיון לתצוגה newest-first (לראות קודם את האחרונה), עם hover שמשנה רקע ל-`--accent-soft`. סגירה ב-Escape, ב-`✕`, או ב-backdrop click — אותו דפוס כמו שאר המודאלים בפרויקט (`Modal.jsx`/`ReopenCardModal.jsx`).
- **`PerBoxTab` (לשונית "פר קופה"):** ב-`generate()` במקום לבחור אוטומטית `find(status==='active') || list[0]`, אם `list.length > 1` נשמר `pendingChoice = { box, cards }` ומוצג המודאל. אחרי בחירה — רץ `runReport(box, card, allCards)` שגם מחשב את התווית `cardLabel` (כדי להציג בכותרת הפאנל "קופה N · כרטסת B"). כשהכרטסת הנבחרת סגורה — מוצג pill קטן "סגורה" ליד התווית. עדכנתי גם את הטקסט "אין כרטסת פעילה" → "אין כרטסת" כי עכשיו הכרטסת הנבחרת יכולה להיות סגורה.
- **`CompareTab` (לשונית "השוואה"):** הוספתי שני שדות חדשים ל-`defaultCol()`: `cardId` ו-`cardLabel`. `updateColumn()` מאפס אותם כשמשנים את `ironNumber` (כך שלא נתקעים על בחירה ישנה אחרי החלפת מספר קופה). `generateForColumn()`: אם `col.ironNumber` מוגדר ו-`col.cardId` עדיין null — קודם קורא ל-`boxesApi.getAll({ search })` למצוא את הקופה, אחר כך `cardsApi.getAll({ box_id })`, ואם יש >1 כרטסות שומר `pendingChoice = { columnId, ironNumber, cards }` ומציג את אותו `CardChoiceModal`. אחרי בחירה הסשן ממשיך עם `fetchCompareData()` שמסנן ב-`r.card_id === cardId` במקום ב-`r.iron_number`. הוספתי תצוגה קטנה מתחת ל-input "קופה ספציפית" שמראה "כרטסת נבחרה: 1019B" עם כפתור "החלף" שמאפס את הבחירה (טריק קטן: קריאה ל-`updateColumn(id, 'ironNumber', col.ironNumber)` — אותו ערך, אבל ה-watcher ב-`updateColumn` מאפס `cardId`/`cardLabel` כי `key === 'ironNumber'`).
- **שיקול עיצובי:** בחרתי לא להציג את המודאל רק על בסיס ה-rows שמחזיר `per-box` (גם אחרי משימה 30 הם כוללים `card_id`), כי במקרה ש-period filter מצמצם את ה-rows ל-0 לקופה ההיסטורית, היינו מפספסים אותה. במקום זה הבחירה נעשית מתוך מקור האמת — `cardsApi.getAll({ box_id })` — שמחזיר את **כל** הכרטסות של הקופה, גם אם אין להן מעטפות בכלל.

**מספר טסטים:** Build של frontend-admin עובר ללא שגיאות (84 modules — נוסף קובץ `CardChoiceModal.jsx`, 1.21s).

**קבצים ששונו:**
- `frontend-admin/src/components/CardChoiceModal.jsx` (חדש)
- `frontend-admin/src/pages/DochotPage.jsx` (import של המודאל; ב-`PerBoxTab` נוספו state `cardLabel`+`pendingChoice`, פיצול ל-`generate()`/`runReport()`, handlers `handleCardChosen`/`handleCardChoiceCancel`, תצוגת תווית בכותרת הפאנל, ורנדור המודאל; ב-`CompareTab` נוספו שדות `cardId`/`cardLabel` ל-`defaultCol()`, state `pendingChoice`, איפוס בחירה ב-`updateColumn` כשמשנים `ironNumber`, פיצול ל-`generateForColumn()`/`fetchCompareData()`, handlers `handleColumnCardChosen`/`handleColumnCardCancel`, תצוגת "כרטסת נבחרה" + כפתור "החלף", ורנדור המודאל)

---

### 30. דוחות — לחיצה על מספר קופה פותחת את הכרטסת — 2026-05-06
**מה נעשה:** במסכי הדוחות, מספר הקופה בטבלה הפך לקליקבילי — לחיצה עליו פותחת את הכרטסת הפעילה של אותה קופה (`/cards/:id`).

- **בק-אנד (`reportsExport.js`):** הוספתי לשאילתת `GET /per-box` את העמודות `c.id AS card_id` ו-`b.id AS box_id` ב-`SELECT`, כדי שה-frontend יוכל לנווט ישירות לכרטסת בלי קריאה נוספת לשרת. אין שינוי בעמודות שמיוצאות ל-CSV (משתמש סופי).
- **פרונט (`DochotPage.jsx`):**
  - הוספתי `import { useNavigate } from 'react-router-dom'` ובכל אחד מ-`SummaryTab` ו-`PerBoxTab` קראתי `const navigate = useNavigate()`.
  - **לשונית "סיכום כללי"** — בעמודת "קופה" של הטבלה, אם יש `card_id` בשורה (יהיה תמיד עכשיו אחרי השינוי בבק-אנד) המספר נעטף ב-`<strong className="clickable">` עם `style={{ color: 'var(--accent)', cursor: 'pointer' }}` ו-`onClick={() => navigate('/cards/' + r.card_id)}` ו-`title="פתיחת הכרטסת"`. זה אותו דפוס בדיוק כמו ב-`AlertsPage.jsx` (שורות 289-293) וב-`BoxesPage.jsx` (שורות 285-291) — עקביות חזותית עם שאר המערכת.
  - **לשונית "פר קופה"** — מספר הקופה בכותרת הפאנל ("קופה N") הפך גם הוא קליקבילי (כשיש `cardInfo`) — מנווט ל-`/cards/${cardInfo.id}`. הוספתי גם state אם אין כרטסת פעילה: המספר מוצג רגיל בלי לינק.
  - **לשונית "השוואה"** — לא דרשה שינוי, היא מציגה רק סטטיסטיקות מצטברות (סה"כ, ממוצע, מעטפות) ולא רשימת קופות פרטנית.

**קבצים ששונו:**
- `backend/src/routes/reportsExport.js` (שורות 99-101 — הוספת `c.id AS card_id` ו-`b.id AS box_id` ל-SELECT)
- `frontend-admin/src/pages/DochotPage.jsx` (שורה 2 — import, שורה 57 — `useNavigate` ב-SummaryTab, שורה 264-275 — תא קליקבילי, שורה 306 — `useNavigate` ב-PerBoxTab, שורות 397-407 — מספר קופה קליקבילי בכותרת)

---

### 29. טאב התראות — סינון + ייצוא לאקסל — 2026-05-06
**מה נעשה:** המשתמשת זיהתה שהמשימה כבר הושלמה בפועל (כנראה בסשן קודם) למרות שהייתה מסומנת בביצוע. אימות בקוד הראה שכל הפיצ'רים קיימים ב-`AlertsPage.jsx`:
- **פאנל 1 (קופות ללא גביה)** — שורת סינון עם חיפוש חופשי (מספר קופה / שם מותאם / עיר / גובה), select לעיר, select לגובה, select לסף התראה (אישי/גלובלי/הכל), וכפתור `↺ איפוס`. כל הסינונים מתבצעים ב-`useMemo` (`filteredItems`) על המצב המקומי, בלי קריאות שרת נוספות. ה-dropdown-ים נבנים דינמית מהפריטים הקיימים (`ncCities`, `ncCollectors`).
- **פאנל 2 (דיווחים פתוחים)** — שורת סינון עם חיפוש (מספר קופה / סוג / תיאור / מדווח) + select לסוג דיווח + איפוס. סינון ב-`filteredReports` על אותו עיקרון.
- **שורת סיכום** מעל כל טבלה: `סה"כ X מתוך Y` (Y מוצג רק כשיש סינון פעיל).
- **ייצוא לאקסל** לכל פאנל בנפרד דרך `exportCsv()` הקיים (`utils/exportCsv`) עם `csvFilename()` שמייצר שם קובץ עם תאריך. הכפתור disabled כשהרשימה המסוננת ריקה. עמודות פאנל 1: קופה, שם מותאם, כרטסת (עם label), עיר, גובה, גביה אחרונה (כולל מקרה "מעולם לא — נפתח X"), ימים, סף התראה (אישי/גלובלי). עמודות פאנל 2: קופה, סוג, תיאור, מדווח, תאריך פתיחה, ימים פתוח.
- **מצב empty** — הודעת "לא נמצאו ... התואמות את הסינון" כשהסינון מצמצם לאפס פריטים אבל הרשימה המקורית לא ריקה.

**קבצים ששונו:** ללא שינוי בסשן הזה — הקוד כבר היה במקום (`frontend-admin/src/pages/AlertsPage.jsx`, שורות 45-53 state, 95-116 dropdowns, 119-150 filtering, 187-249 פאנל 1 UI + ייצוא, 344-387 פאנל 2 UI + ייצוא). רק עדכון `TASKS.md`.

---

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
