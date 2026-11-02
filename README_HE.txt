EMS • פורטל מפרעות נפרד לנור / גנאיים / פאדי

מה מתקינים:
1) הרץ ב-Supabase SQL Editor את 01_payments_portal_migration.sql
2) צור Edge Function בשם payments-api והדבק את payments-api.ts
3) צור Edge Function בשם seed-payment-users והדבק את seed-payment-users.ts
4) הוסף Secret בשם PAYMENTS_SEED_SECRET לערך סודי שרק אתה יודע.
5) פרוס את שתי ה-Edge Functions.
6) העתק payments-auth.js לתיקיית /js באתר.
7) העתק payments-login.html ו-payments-portal.html לשורש האתר.
8) קבע PIN לכל אחד באמצעות קריאה חד-פעמית ל-seed-payment-users:
   body JSON:
   {
     "seed_secret":"הסוד שהגדרת",
     "nur_pin":"PIN של נור",
     "gnaim_pin":"PIN של גנאיים",
     "fadi_pin":"PIN של פאדי"
   }

התנהגות חודש שכר:
- יום 1 עד 10 בחודש: "החודש הנוכחי" בפורטל הוא חודש השכר הקודם.
  לדוגמה 02/09/2026 => חודש שכר נוכחי 08/2026.
- אחרי יום 10: חודש השכר הנוכחי הוא החודש הקלנדרי הנוכחי.
- אם המפרעה משויכת לחודש שאינו החודש הקלנדרי של היום, payment_date נשמר ביום האחרון של חודש השכר.
- given_date נשמר כתאריך האמיתי שבו הכסף ניתן.
- reason נשמר לדוגמה:
  מפרעה • ניתנה בפועל 02/09/2026 • שיוך לשכר 08/2026

אבטחה:
- הלקוח לא שולח payer בכלל.
- השרת קובע מי המשלם מתוך ה-JWT של המשתמש המחובר.
- גנאיים יכול ליצור רק gnaim_amount, נור רק nur_amount, ופאדי רק fadi_amount.
- הפורטל לא נותן גישה ל-API הכללי של EMS.
