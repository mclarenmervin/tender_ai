# Tender AI

Tender AI is a FastAPI application that helps you discover and track tenders with:
- user signup/login
- automated scraping jobs
- keyword and optional OpenAI-based scoring
- tender tracking workflow
- email/Telegram notifications
- scheduled auto-scrape and daily digest jobs

## Tech Stack
- Python 3.12
- FastAPI + Uvicorn
- PostgreSQL
- SQLAlchemy
- APScheduler
- Playwright (Chromium) for scraping

## 1) Local Setup (Windows)

### Prerequisites
- Python 3.12+
- PostgreSQL running locally or remotely
- Git (for pushing to GitHub)

### Install Dependencies
```powershell
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
playwright install chromium
```

### Configure Environment
1. Copy `.env.example` to `.env`
2. Update values in `.env`

Minimum required values:
```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/tender_ai
SECRET_KEY=replace_with_a_long_random_secret
```

### Create Database and Initialize Schema
```sql
CREATE DATABASE tender_ai;
```

```powershell
.\venv\Scripts\activate
python -m app.main init-db
```

### Run App
```powershell
.\run_api.bat
```

Open: `http://127.0.0.1:8000/signup`  
Create your first account, then use the dashboard.

## 2) Useful Commands

```powershell
.\venv\Scripts\activate
python -m app.main init-db      # create/update tables
python -m app.main scrape       # one scrape run
python -m app.main scheduler    # background scheduler
```

Or use batch helpers:
- `run_api.bat`
- `run_scheduler.bat`
- `setup_windows.bat`

## 3) Environment Variables

### Required
- `DATABASE_URL`
- `SECRET_KEY`

### Optional (Scoring)
- `USE_OPENAI_SCORING` (`true`/`false`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o-mini`)

### Optional (Alerts)
- `HIGH_PRIORITY_SCORE` (default `70`)
- `DEADLINE_ALERT_DAYS` (default `10`)
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_USE_TLS` (`true`/`false`)

### Optional (Scraper behavior)
- `SCRAPE_PDF_VALUES` (`true`/`false`)
- `MANUAL_SCRAPE_USER_ID`
- `MANUAL_SCRAPE_TRIGGER`

## 4) Connect to GitHub and Push Code

Repository: `https://github.com/mclarenmervin/tender-ai`

If `git` is not installed, install it first from:
- https://git-scm.com/download/win

Then run in project root:

```powershell
git init
git add .
git commit -m "Initial commit: Tender AI app"
git branch -M main
git remote add origin https://github.com/mclarenmervin/tender-ai.git
git push -u origin main
```

If this folder is already a git repo, use:
```powershell
git remote remove origin
git remote add origin https://github.com/mclarenmervin/tender-ai.git
git push -u origin main
```
