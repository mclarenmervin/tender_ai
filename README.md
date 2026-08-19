# Tender AI

Tender AI is an AI-assisted tender intelligence platform for teams working with India’s Government e-Marketplace (GeM). It brings tender discovery, eligibility scoring, bid workflow management, buyer research, and competition analysis into one FastAPI + React application.

## About

Tender AI supports two focused workspaces:

- **Seller workspace** — discover relevant tenders, assess eligibility, maintain company and catalogue readiness, manage Bid/RA participation, and track order fulfilment.
- **Buyer intelligence workspace** — create a buyer directory, import that buyer’s public GeM tenders, distinguish open and completed tenders, capture public Bid/RA result data, and analyze winning sellers, L1/L2/L3 positions, recurring competitors, and market concentration.

Public GeM information is treated as evidence: result intelligence records its source and distinguishes public results from data that remains masked or unavailable on GeM.

## Highlights

- Live GeM tender discovery and Advanced Search integration
- Tender scoring with configurable multi-criteria rules and EMD support
- Exact bid end-date/time handling for open versus completed tender status
- Buyer tender portfolio with public Bid/RA result synchronization
- L1/L2/L3, bidder participation, award, repeated-bidder, and dominance analysis
- Seller readiness, catalogue, Bid/RA, and fulfilment workflows
- Role-based accounts, alerts, reports, and scheduled jobs

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

If Railway logs show `Network is unreachable` for `db.<project-ref>.supabase.co`, use the Supabase
**Transaction pooler** connection string instead of the direct connection string. In Supabase, open
`Project Settings -> Database -> Connection string -> Transaction pooler`, copy the URI, URL-encode
the password, and set that value as Railway `DATABASE_URL`. The direct Supabase host may resolve to
IPv6, while the pooler works better from IPv4-only deployment environments.

GeM scraping uses Playwright/Chromium. The included Dockerfile uses the official Playwright Python
image so Chromium dependencies are available on Railway. If scraping reports `ERR_CONNECTION_REFUSED`
for `https://bidplus.gem.gov.in/all-bids`, Chromium is working but GeM is refusing the Railway/cloud
network path. In that case, run the scraper from a machine/network that can access GeM, or use an
approved proxy/static egress solution.

Optional Railway variables for an approved proxy/static egress path:

```env
GEM_PROXY_SERVER=http://host:port
GEM_PROXY_USERNAME=
GEM_PROXY_PASSWORD=
```

Do not use a proxy to bypass GeM access controls, CAPTCHA, OTP, rate limits, or terms. Use an
authorized network path for your company account.

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
