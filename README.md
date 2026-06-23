# Tender AI

Tender AI is a FastAPI + React dashboard for tender discovery, scoring, tracking, and seller-side execution workflows.

The app supports two account roles:
- **Buyer**: tender review, market/buyer intelligence, reports, scoring, scraping, alerts, and workflow tracking.
- **Seller**: seller readiness, catalogue tracking, opportunity matching, Bid/RA workflow, order fulfillment, and seller analytics.

This README is intentionally a project overview and setup guide, not a full product manual.

## Tech Stack

- Python 3.12+
- FastAPI + Uvicorn
- PostgreSQL
- SQLAlchemy
- React served from static files
- APScheduler
- Playwright for GeM scraping

## Setup

### 1. Create a virtual environment

```powershell
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure environment

Copy `.env.example` to `.env` and update the values.

Minimum required:

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/tender_ai
SECRET_KEY=replace_with_a_long_random_secret
```

Optional settings for OpenAI scoring, Telegram, email, alert thresholds, and scraper behavior are documented in `.env.example`.

### 3. Create the database

Create a PostgreSQL database named `tender_ai`, then initialize/update tables:

```powershell
.\venv\Scripts\activate
python -m app.main init-db
```

### 4. Run the app

```powershell
.\run_api.bat
```

Open:

```text
http://127.0.0.1:8000/signup
```

Create either a buyer or seller account during signup.

## Useful Commands

```powershell
python -m app.main init-db
python -m app.main scrape
python -m app.main scheduler
```

Batch helpers:

- `run_api.bat`
- `run_scheduler.bat`
- `setup_windows.bat`

## Railway Deployment

Railway uses `railpack.json` for the start command:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required Railway variables:

```env
DATABASE_URL=postgresql://postgres:<URL_ENCODED_PASSWORD>@db.<SUPABASE_PROJECT_REF>.supabase.co:5432/postgres
SECRET_KEY=<long-random-secret>
```

For Supabase passwords, URL-encode special characters before putting the value in `DATABASE_URL`.
For example, `@` becomes `%40` and `%` becomes `%25`.

## Main Areas

Buyer workspace:

- Tender list, filters, scoring, status tracking
- Pipeline and applied/upcoming views
- Buyer, market, competitor, and report dashboards
- Admin tools for keywords, scoring, GeM alerts, settings, and data deletion

Seller workspace:

- Seller profile and document readiness
- Catalogue management tracker
- Seller opportunity matching
- Bid/RA participation workflow
- Order fulfillment tracker
- Seller-side analytics dashboard

## Notes

- Existing users without a role are migrated to `buyer` by the schema sync.
- The app updates schema columns/indexes during startup via `ensure_schema_updates()`.
- Generated reports and uploads are stored locally in `generated_reports/` and `uploads/`.
