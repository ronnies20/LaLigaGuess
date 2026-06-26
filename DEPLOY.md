# 🚀 מדריך העלאה — LaLiga Predictions
## מ-0 לאתר חי בחצי שעה

---

## שלב 1 — Supabase (בסיס הנתונים)

### 1.1 הרשמה
1. לך ל- **https://supabase.com**
2. לחץ **"Start your project"**
3. הירשם עם חשבון GitHub (מומלץ) או אימייל
4. לחץ **"New Project"**
5. מלא:
   - **Organization**: השאר ברירת מחדל
   - **Name**: `laliga-predictions`
   - **Database Password**: בחר סיסמה חזקה ושמור אותה!
   - **Region**: בחר `Europe (Frankfurt)` — הכי קרוב לישראל
6. לחץ **"Create new project"** — ממתינים ~2 דקות

### 1.2 הגדרת בסיס הנתונים
1. בתפריט השמאלי לחץ **"SQL Editor"** (סמל עט)
2. לחץ **"New query"**
3. פתח את הקובץ `supabase-schema.sql` (מהתיקייה שקיבלת)
4. העתק את כל תוכנו והדבק בחלון ה-SQL Editor
5. לחץ **"Run"** (כפתור ירוק)
6. תראה: `Success. No rows returned` — מצוין!

### 1.3 שמירת מפתחות
1. בתפריט לחץ **"Project Settings"** ← **"API"**
2. שמור אצלך:
   - **Project URL** — נראה כך: `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** — מחרוזת ארוכה שמתחילה ב-`eyJ...`

---

## שלב 2 — הוספת משחקים

1. בתפריט Supabase לחץ **"Table Editor"** ← **"matches"**
2. לחץ **"Insert row"** לכל משחק
3. **חשוב**: השדה `kickoff` הוא תאריך+שעה בפורמט:
   `2026-08-17 21:00:00+03` (שעון ישראל)
4. אפשר גם לערוך את ה-SQL בקובץ ולהסיר את `/*` ו-`*/` מהנתונים ולהריץ

---

## שלב 3 — Vercel (אחסון האתר)

### 3.1 הרשמה
1. לך ל- **https://vercel.com**
2. לחץ **"Sign Up"** ← **"Continue with GitHub"**

### 3.2 העלאת הקוד ל-GitHub
1. לך ל- **https://github.com/new**
2. שם: `laliga-predictions`, בחר **Private** ← **"Create repository"**
3. פתח **Terminal** (Mac: Cmd+Space ← "Terminal")
4. הרץ בתוך תיקיית הפרויקט:
```bash
cd /path/to/laliga-predictions
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/USERNAME/laliga-predictions.git
git push -u origin main
```

### 3.3 Deploy
1. בVercel לחץ **"Add New Project"**
2. בחר את הרפוזיטורי `laliga-predictions`
3. לחץ **"Import"**
4. **חשוב** — לפני Deploy, לחץ **"Environment Variables"** והוסף:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | ה-Project URL מסעיף 1.3 |
   | `VITE_SUPABASE_ANON_KEY` | ה-anon key מסעיף 1.3 |
5. לחץ **"Deploy"**
6. ממתינים ~2 דקות...
7. קיבלת כתובת כמו: `https://laliga-predictions-abc.vercel.app` 🎉

---

## שלב 4 — הגדרות Supabase (חשוב!)

### אפשר הרשמה
1. ב-Supabase ← **"Authentication"** ← **"Providers"**
2. ודא ש-**Email** מופעל
3. תחת **Email** — בטל **"Confirm email"** (כדי שמשתמשים יוכלו להיכנס מיד ללא אימות)
   - אפשר להפעיל חזרה בהמשך לאבטחה טובה יותר

### הוסף URL מותר
1. **"Authentication"** ← **"URL Configuration"**
2. **Site URL**: הכנס את כתובת Vercel שקיבלת
3. **Redirect URLs**: הוסף את אותה כתובת + `/`
4. לחץ **"Save"**

---

## שלב 5 — עדכון תוצאות (אחרי כל משחק)

1. לך ל-Supabase ← **"Table Editor"** ← **"matches"**
2. מצא את המשחק הרלוונטי
3. ערוך את `home_score` ו-`away_score`
4. **הנקודות מחושבות אוטומטית!**

---

## 🏆 סיום!

שתף עם החברים את הכתובת שקיבלת מ-Vercel.
כל אחד נרשם בעצמו, ניחושים ננעלים שעה לפני כל משחק.

### שאלות?
- הפרויקט: תיקיית `laliga-predictions`
- SQL: `supabase-schema.sql`
- משתנים: `.env.example`
