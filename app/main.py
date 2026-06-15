import json
import os
import re
import subprocess
import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta
from html import escape
import csv
import io
import requests
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI,Depends,HTTPException,Request,Form
from fastapi.responses import FileResponse,RedirectResponse,Response
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database.db_connection import Base,engine,get_db
from app.database.models import User,Tender,TenderTracking,ScrapingLog,ScrapeKeyword,AppSetting,ScoringCriterion,NotificationLog,TenderDocument,ScrapeRun,ScrapeJob,KeywordPerformance,NotificationPreference,MarketingLead,CompanyProfile,TenderEligibility,BidDecision,SellerProfile,SellerDocument,SellerCatalogueItem,SellerBidParticipation,SellerOrderFulfillment
from app.auth import hash_password,verify_password,create_access_token,get_current_user
from app.ai_engine.eligibility_extractor import extract_eligibility
from app.ai_engine.bid_decision import bid_decision_for_tender
from app.alerts.daily_digest import send_daily_digest
from app.scraper.gem_job import run_gem_job
from app.ai_engine.keyword_engine import DEFAULT_CRITERIA, KEYWORD_PROFILES, expand_keyword
from app.ai_engine.scorer import score_unscored_tenders,rescore_all_tenders
from app.scheduler.scheduler import start_scheduler
from app.tracking.status_tracker import update_tender_statuses
load_dotenv(); app=FastAPI(title='Tender AI Agent MVP',version='1.0.0')
BASE_DIR=Path(__file__).resolve().parent.parent
STATIC_DIR=Path(__file__).parent/'dashboard'/'static'
STATIC_DIR.mkdir(exist_ok=True)
app.mount('/static',StaticFiles(directory=str(STATIC_DIR)),name='static')
REPORT_DIR=BASE_DIR/'generated_reports'
REPORT_DIR.mkdir(exist_ok=True)
INDIAN_STATES=[
    'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir',
    'Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
    'Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal'
]

def react_shell():
    return FileResponse(
        STATIC_DIR/'react'/'index.html',
        headers={'Cache-Control':'no-store'},
    )

def ensure_schema_updates():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for ddl in [
            "ALTER TABLE tenders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE scraping_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE scrape_keywords ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE scrape_keywords ADD COLUMN IF NOT EXISTS profile VARCHAR(100) DEFAULT 'Custom'",
            "ALTER TABLE scrape_keywords ADD COLUMN IF NOT EXISTS synonyms TEXT",
            "ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS match_type VARCHAR(50) DEFAULT 'positive'",
            "ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS profile VARCHAR(100) DEFAULT 'Custom'",
            "ALTER TABLE tender_tracking ADD COLUMN IF NOT EXISTS source_status VARCHAR(100)",
            "ALTER TABLE tender_tracking ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE tender_tracking ADD COLUMN IF NOT EXISTS source_available BOOLEAN DEFAULT FALSE",
            "UPDATE users SET role='buyer' WHERE role IS NULL OR role='' OR role='user'",
            "UPDATE tenders SET user_id=(SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users)",
            "UPDATE scraping_logs SET user_id=(SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users)",
            "UPDATE scrape_keywords SET user_id=(SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users)",
            "UPDATE app_settings SET user_id=(SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users)",
            "UPDATE scoring_criteria SET user_id=(SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users)",
            "ALTER TABLE tenders DROP CONSTRAINT IF EXISTS uq_source_tender_id",
            "ALTER TABLE scrape_keywords DROP CONSTRAINT IF EXISTS scrape_keywords_keyword_key",
            "ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key",
            "ALTER TABLE scoring_criteria DROP CONSTRAINT IF EXISTS scoring_criteria_keyword_key",
            "DROP INDEX IF EXISTS ix_scrape_keywords_keyword",
            "DROP INDEX IF EXISTS ix_app_settings_key",
            "DROP INDEX IF EXISTS ix_scoring_criteria_keyword",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_source_tender_id ON tenders(user_id,source,tender_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_scrape_keyword ON scrape_keywords(user_id,keyword)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_app_setting ON app_settings(user_id,key)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_scoring_keyword ON scoring_criteria(user_id,keyword)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notification_channel ON notification_preferences(user_id,channel)",
            "CREATE TABLE IF NOT EXISTS telegram_subscribers (id SERIAL PRIMARY KEY, chat_id VARCHAR(100) UNIQUE NOT NULL, username VARCHAR(255), first_name VARCHAR(255), chat_type VARCHAR(50), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT now())",
            "CREATE INDEX IF NOT EXISTS ix_marketing_leads_email ON marketing_leads(email)",
            "CREATE INDEX IF NOT EXISTS ix_marketing_leads_lead_type ON marketing_leads(lead_type)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_company_profiles_user_id ON company_profiles(user_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_eligibility_tender_id ON tender_eligibility(tender_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_decisions_tender_id ON bid_decisions(tender_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_profiles_user_id ON seller_profiles(user_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_seller_document ON seller_documents(user_id,doc_key)",
            "CREATE INDEX IF NOT EXISTS ix_seller_catalogue_items_user_id ON seller_catalogue_items(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_seller_bid_participations_user_id ON seller_bid_participations(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_seller_bid_participations_tender_id ON seller_bid_participations(tender_id)",
            "CREATE INDEX IF NOT EXISTS ix_seller_order_fulfillments_user_id ON seller_order_fulfillments(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_seller_order_fulfillments_tender_id ON seller_order_fulfillments(tender_id)",
        ]:
            conn.exec_driver_sql(ddl)

@app.on_event("startup")
def startup_schema_sync():
    ensure_schema_updates()

@app.exception_handler(HTTPException)
def http_exception_handler(request:Request,exc:HTTPException):
    accept=request.headers.get('accept','')
    requested_with=request.headers.get('x-requested-with','')
    if exc.status_code==401 and 'text/html' in accept and requested_with!='fetch':
        return RedirectResponse('/login',status_code=303)
    return Response(
        json.dumps({'detail':exc.detail}),
        status_code=exc.status_code,
        media_type='application/json',
    )
@app.get('/')
def root(): return react_shell()

@app.get('/features')
def features_page(request:Request): return react_shell()

@app.get('/pricing')
def pricing_page(request:Request): return react_shell()

@app.get('/how-it-works')
def how_it_works_page(request:Request): return react_shell()

@app.get('/about')
def about_page(request:Request): return react_shell()

@app.get('/contact')
def contact_page(request:Request): return react_shell()
@app.get('/signup')
def signup_page(request:Request): return react_shell()
@app.post('/signup')
def signup(request:Request,name:str=Form(...),email:str=Form(...),password:str=Form(...),role:str=Form('buyer'),db:Session=Depends(get_db)):
    if db.query(User).filter(User.email==email).first(): return RedirectResponse('/signup?error=email_exists',303)
    role=(role or 'buyer').strip().lower()
    role=role if role in {'buyer','seller'} else 'buyer'
    user=User(name=name,email=email,password_hash=hash_password(password),role=role)
    db.add(user); db.commit(); token=create_access_token({'sub':email})
    res=RedirectResponse('/dashboard/seller' if role=='seller' else '/dashboard/buyer',303); res.set_cookie('access_token',token,httponly=True,samesite='lax'); return res
@app.get('/login')
def login_page(request:Request): return react_shell()
@app.post('/login')
def login(request:Request,email:str=Form(...),password:str=Form(...),db:Session=Depends(get_db)):
    user=db.query(User).filter(User.email==email).first()
    if not user or not verify_password(password,user.password_hash): return RedirectResponse('/login?error=invalid',303)
    token=create_access_token({'sub':user.email}); res=RedirectResponse('/dashboard/seller' if user.role=='seller' else '/dashboard/buyer',303); res.set_cookie('access_token',token,httponly=True,samesite='lax'); return res
@app.get('/logout')
def logout(): res=RedirectResponse('/login'); res.delete_cookie('access_token'); return res

@app.post('/api/signup')
async def api_signup(request:Request,db:Session=Depends(get_db)):
    payload=await request.json()
    name=(payload.get('name') or '').strip()
    email=(payload.get('email') or '').strip().lower()
    password=payload.get('password') or ''
    role=(payload.get('role') or 'buyer').strip().lower()
    role=role if role in {'buyer','seller'} else 'buyer'
    if not name or not email or not password:
        raise HTTPException(400,'Name, email, and password are required')
    if db.query(User).filter(User.email==email).first():
        raise HTTPException(400,'Email already registered')
    user=User(name=name,email=email,password_hash=hash_password(password),role=role)
    db.add(user)
    db.commit()
    token=create_access_token({'sub':email})
    res=Response(json.dumps({'ok':True,'role':role,'dashboard_path':'/dashboard/seller' if role=='seller' else '/dashboard/buyer'}),media_type='application/json')
    res.set_cookie('access_token',token,httponly=True,samesite='lax')
    return res

@app.post('/api/login')
async def api_login(request:Request,db:Session=Depends(get_db)):
    payload=await request.json()
    email=(payload.get('email') or '').strip().lower()
    password=payload.get('password') or ''
    user=db.query(User).filter(User.email==email).first()
    if not user or not verify_password(password,user.password_hash):
        raise HTTPException(401,'Invalid email or password')
    token=create_access_token({'sub':user.email})
    role=user.role if user.role in {'buyer','seller'} else 'buyer'
    res=Response(json.dumps({'ok':True,'role':role,'dashboard_path':'/dashboard/seller' if role=='seller' else '/dashboard/buyer'}),media_type='application/json')
    res.set_cookie('access_token',token,httponly=True,samesite='lax')
    return res

@app.post('/api/logout')
def api_logout():
    res=Response(json.dumps({'ok':True}),media_type='application/json')
    res.delete_cookie('access_token')
    return res

@app.post('/api/public/leads')
async def api_public_lead(request:Request,db:Session=Depends(get_db)):
    payload=await request.json()
    email=(payload.get('email') or '').strip().lower()
    name=(payload.get('name') or '').strip()
    lead_type=(payload.get('lead_type') or 'demo').strip().lower()
    if not email or '@' not in email:
        raise HTTPException(400,'Valid email is required')
    if lead_type not in {'demo','contact','newsletter','pricing'}:
        lead_type='demo'
    lead=MarketingLead(
        lead_type=lead_type,
        name=name[:150] if name else None,
        email=email[:255],
        company=(payload.get('company') or '').strip()[:255] or None,
        phone=(payload.get('phone') or '').strip()[:50] or None,
        plan=(payload.get('plan') or '').strip()[:100] or None,
        message=(payload.get('message') or '').strip()[:5000] or None,
        source_page=(payload.get('source_page') or request.headers.get('referer') or '').strip()[:255] or None,
    )
    db.add(lead)
    db.commit()
    return {'ok':True,'message':'Thanks. We saved your request and will follow up.'}
def user_tenders(db:Session,user:User):
    return db.query(Tender).filter(Tender.user_id==user.id)

def user_tracking(db:Session,user:User):
    return db.query(TenderTracking).join(Tender).filter(Tender.user_id==user.id)

def dashboard_context(request:Request,db:Session,user:User,active:str,title:str,tenders=None,extra=None):
    soon=date.today()+timedelta(days=10)
    tender_query=user_tenders(db,user)
    context={
        'request':request,
        'user':user,
        'active':active,
        'page_title':title,
        'tenders':tenders if tenders is not None else [],
        'total':tender_query.count(),
        'high_priority':tender_query.filter(Tender.relevance_score>=70).count(),
        'medium_score':tender_query.filter(Tender.relevance_score>=40,Tender.relevance_score<70).count(),
        'unscored':tender_query.filter(Tender.relevance_score.is_(None)).count(),
        'applied_count':tender_query.filter(Tender.status=='applied').count(),
        'upcoming_count':tender_query.filter(Tender.deadline>=date.today(),Tender.deadline<=soon).count(),
        'high_priority_score':float(os.getenv('HIGH_PRIORITY_SCORE','70')),
    }
    if extra:
        context.update(extra)
    return context

def get_notification_preference(db,user_id,channel,default=True):
    item=db.query(NotificationPreference).filter(NotificationPreference.user_id==user_id,NotificationPreference.channel==channel).first()
    if not item:
        item=NotificationPreference(user_id=user_id,channel=channel,enabled=default)
        db.add(item)
        db.commit()
        db.refresh(item)
    return item

def iso(value):
    return value.isoformat() if value else None

def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError,ValueError):
        return None

def split_filter(value):
    if not value:
        return []
    return [item.strip() for item in str(value).split(',') if item.strip()]

def tender_to_dict(tender):
    eligibility=getattr(tender,'eligibility',None)
    bid_decision=getattr(tender,'bid_decision',None)
    return {
        'id':tender.id,
        'user_id':tender.user_id,
        'source':tender.source,
        'tender_id':tender.tender_id,
        'title':tender.title,
        'department':tender.department,
        'state':tender.state,
        'estimated_value':tender.estimated_value or 0,
        'deadline':iso(tender.deadline),
        'url':tender.url,
        'description':tender.description,
        'category':tender.category,
        'relevance_score':tender.relevance_score,
        'ai_recommendation':tender.ai_recommendation,
        'ai_reason':tender.ai_reason,
        'status':tender.status,
        'created_at':iso(tender.created_at),
        'updated_at':iso(tender.updated_at),
        'eligibility':eligibility_to_dict(eligibility) if eligibility else None,
        'bid_decision':bid_decision_to_dict(bid_decision) if bid_decision else None,
    }

def bid_decision_to_dict(item):
    if not item:
        return None
    def loads(value):
        try:
            decoded=json.loads(value or '[]')
            return decoded if isinstance(decoded,list) else [str(decoded)]
        except Exception:
            return [value] if value else []
    return {
        'id':item.id,
        'tender_id':item.tender_id,
        'recommendation':item.recommendation or 'review',
        'decision_score':item.decision_score or 0,
        'reasons':loads(item.reasons),
        'blockers':loads(item.blockers),
        'next_steps':loads(item.next_steps),
        'confidence':item.confidence or 0,
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
    }

def eligibility_to_dict(item):
    if not item:
        return None
    try:
        risks=json.loads(item.risk_flags or '[]')
    except Exception:
        risks=[item.risk_flags] if item.risk_flags else []
    return {
        'id':item.id,
        'tender_id':item.tender_id,
        'emd':item.emd or '',
        'turnover_requirement':item.turnover_requirement or '',
        'experience_requirement':item.experience_requirement or '',
        'documents_required':item.documents_required or '',
        'certifications_required':item.certifications_required or '',
        'submission_deadline':item.submission_deadline or '',
        'payment_terms':item.payment_terms or '',
        'technical_specs':item.technical_specs or '',
        'risk_flags':risks,
        'summary':item.summary or '',
        'extracted_from':item.extracted_from or '',
        'confidence':item.confidence or 0,
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
    }

def tracking_to_dict(item):
    tender=item.tender
    return {
        'id':item.id,
        'tender_id':item.tender_id,
        'submission_status':item.submission_status,
        'documents_ready':item.documents_ready,
        'applied':item.applied,
        'evaluation_status':item.evaluation_status,
        'remarks':item.remarks,
        'source_status':item.source_status,
        'source_available':item.source_available,
        'last_checked_at':iso(item.last_checked_at),
        'updated_at':iso(item.updated_at),
        'tender':tender_to_dict(tender) if tender else None,
    }

def keyword_to_dict(item):
    return {
        'id':item.id,
        'keyword':item.keyword,
        'profile':item.profile or 'Custom',
        'synonyms':expand_keyword('', synonyms=item.synonyms),
        'is_active':item.is_active,
        'created_at':iso(item.created_at),
    }

def scoring_to_dict(item):
    return {
        'id':item.id,
        'keyword':item.keyword,
        'weight':item.weight,
        'match_type':item.match_type or 'positive',
        'profile':item.profile or 'Custom',
        'is_active':item.is_active,
        'created_at':iso(item.created_at),
    }

def company_profile_to_dict(item):
    if not item:
        return {
            'company_name':'',
            'products':'',
            'services':'',
            'industries':'',
            'target_departments':'',
            'target_states':'',
            'certifications':'',
            'experience_keywords':'',
            'negative_keywords':'',
            'min_tender_value':'',
            'max_tender_value':'',
            'is_active':True,
        }
    return {
        'id':item.id,
        'company_name':item.company_name or '',
        'products':item.products or '',
        'services':item.services or '',
        'industries':item.industries or '',
        'target_departments':item.target_departments or '',
        'target_states':item.target_states or '',
        'certifications':item.certifications or '',
        'experience_keywords':item.experience_keywords or '',
        'negative_keywords':item.negative_keywords or '',
        'min_tender_value':item.min_tender_value or '',
        'max_tender_value':item.max_tender_value or '',
        'is_active':item.is_active,
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
    }

SELLER_DOCUMENT_DEFAULTS=[
    ('pan','PAN card','identity'),
    ('aadhaar','Aadhaar linked with mobile','identity'),
    ('gstin','GST certificate or exemption proof','tax'),
    ('udyam','Udyam/MSME certificate','eligibility'),
    ('bank','Cancelled cheque / bank proof','finance'),
    ('address','Business address proof','profile'),
    ('tds','TDS certificate / declaration','tax'),
    ('caution_money','Caution money payment proof','compliance'),
    ('vendor_assessment','Vendor assessment report','compliance'),
    ('startup_india','Startup India certificate','eligibility'),
    ('odop','ODOP eligibility document','eligibility'),
]
SELLER_DOCUMENT_LABELS={key:label for key,label,category in SELLER_DOCUMENT_DEFAULTS}

def seller_profile_to_dict(item):
    if not item:
        return {
            'business_name':'',
            'gem_seller_id':'',
            'pan':'',
            'aadhaar_linked':False,
            'gstin':'',
            'udyam_number':'',
            'startup_india_number':'',
            'odop_state':'',
            'odop_product':'',
            'bank_verified':False,
            'address_verified':False,
            'secondary_user_created':False,
            'vendor_assessment_status':'not_started',
            'caution_money_status':'pending',
            'tds_certificate_status':'missing',
            'notes':'',
        }
    return {
        'id':item.id,
        'business_name':item.business_name or '',
        'gem_seller_id':item.gem_seller_id or '',
        'pan':item.pan or '',
        'aadhaar_linked':bool(item.aadhaar_linked),
        'gstin':item.gstin or '',
        'udyam_number':item.udyam_number or '',
        'startup_india_number':item.startup_india_number or '',
        'odop_state':item.odop_state or '',
        'odop_product':item.odop_product or '',
        'bank_verified':bool(item.bank_verified),
        'address_verified':bool(item.address_verified),
        'secondary_user_created':bool(item.secondary_user_created),
        'vendor_assessment_status':item.vendor_assessment_status or 'not_started',
        'caution_money_status':item.caution_money_status or 'pending',
        'tds_certificate_status':item.tds_certificate_status or 'missing',
        'notes':item.notes or '',
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
    }

def seller_document_to_dict(item):
    return {
        'id':item.id,
        'doc_key':item.doc_key,
        'label':item.label or SELLER_DOCUMENT_LABELS.get(item.doc_key,item.doc_key),
        'status':item.status or 'missing',
        'expiry_date':iso(item.expiry_date),
        'notes':item.notes or '',
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
    }

def ensure_seller_documents(db,user_id):
    existing={item.doc_key:item for item in db.query(SellerDocument).filter(SellerDocument.user_id==user_id).all()}
    changed=False
    for key,label,category in SELLER_DOCUMENT_DEFAULTS:
        if key not in existing:
            item=SellerDocument(user_id=user_id,doc_key=key,label=label,status='missing')
            db.add(item)
            existing[key]=item
            changed=True
        elif existing[key].label!=label:
            existing[key].label=label
            changed=True
    if changed:
        db.commit()
    return [existing[key] for key,label,category in SELLER_DOCUMENT_DEFAULTS]

def seller_readiness_summary(profile,documents):
    profile_data=seller_profile_to_dict(profile)
    checks=[
        ('Business name',bool(profile_data['business_name'])),
        ('GeM seller ID',bool(profile_data['gem_seller_id'])),
        ('PAN',bool(profile_data['pan'])),
        ('Aadhaar linked',bool(profile_data['aadhaar_linked'])),
        ('GST or Udyam',bool(profile_data['gstin'] or profile_data['udyam_number'])),
        ('Bank verified',bool(profile_data['bank_verified'])),
        ('Address verified',bool(profile_data['address_verified'])),
        ('Secondary user',bool(profile_data['secondary_user_created'])),
        ('Vendor assessment',profile_data['vendor_assessment_status'] in {'ready','submitted','approved'}),
        ('Caution money',profile_data['caution_money_status'] in {'paid','not_applicable'}),
        ('TDS certificate',profile_data['tds_certificate_status'] in {'available','not_applicable'}),
    ]
    ready_docs=[doc for doc in documents if (doc.status or '') in {'ready','submitted','approved','not_applicable'}]
    expired_docs=[doc for doc in documents if (doc.status or '')=='expired']
    missing_docs=[doc for doc in documents if (doc.status or 'missing') in {'missing','rejected'}]
    doc_score=(len(ready_docs)/len(documents))*35 if documents else 0
    profile_score=(sum(1 for label,ok in checks if ok)/len(checks))*65 if checks else 0
    health_score=round(min(100,profile_score+doc_score))
    if health_score>=80:
        level='ready'
    elif health_score>=55:
        level='needs_review'
    else:
        level='incomplete'
    return {
        'health_score':health_score,
        'level':level,
        'completed_checks':sum(1 for label,ok in checks if ok),
        'total_checks':len(checks),
        'ready_documents':len(ready_docs),
        'total_documents':len(documents),
        'missing_documents':[seller_document_to_dict(doc) for doc in missing_docs],
        'expired_documents':[seller_document_to_dict(doc) for doc in expired_docs],
        'profile_gaps':[label for label,ok in checks if not ok],
    }

CATALOGUE_STATUS_OPTIONS=['draft','submitted','active','rejected','notified','expired','paused']
CATALOGUE_DOC_STATUS_OPTIONS=['not_started','missing','ready','submitted','approved','rejected','not_required']
CATALOGUE_STOCK_OPTIONS=['unknown','in_stock','low_stock','out_of_stock']
CATALOGUE_REPAIR_OPTIONS=['none','needs_repair','in_progress','resubmitted','resolved']

def catalogue_item_to_dict(item):
    return {
        'id':item.id,
        'item_type':item.item_type or 'product',
        'name':item.name or '',
        'category':item.category or '',
        'gem_category':item.gem_category or '',
        'brand':item.brand or '',
        'model':item.model or '',
        'sku':item.sku or '',
        'oem_status':item.oem_status or 'not_required',
        'reseller_status':item.reseller_status or 'not_required',
        'brand_approval_status':item.brand_approval_status or 'not_started',
        'image_status':item.image_status or 'missing',
        'mrp_document_status':item.mrp_document_status or 'missing',
        'specs_status':item.specs_status or 'missing',
        'catalogue_status':item.catalogue_status or 'draft',
        'stock_status':item.stock_status or 'unknown',
        'stock_qty':item.stock_qty or 0,
        'offering_expiry':iso(item.offering_expiry),
        'repair_status':item.repair_status or 'none',
        'clone_pair_source':item.clone_pair_source or '',
        'notes':item.notes or '',
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
        'readiness':catalogue_item_readiness(item),
    }

def catalogue_item_readiness(item):
    gaps=[]
    checks=[
        ('Name',bool(item.name)),
        ('GeM category',bool(item.gem_category or item.category)),
        ('Brand/model',bool(item.brand or item.model or item.item_type=='service')),
        ('Brand approval',item.brand_approval_status in {'approved','not_required'}),
        ('Image checklist',item.image_status in {'ready','approved','not_required'}),
        ('MRP support',item.mrp_document_status in {'ready','approved','not_required'}),
        ('Specs/service details',item.specs_status in {'ready','approved','not_required'}),
        ('OEM/reseller clearance',item.oem_status in {'approved','not_required'} and item.reseller_status in {'approved','not_required'}),
        ('Stock',item.item_type=='service' or item.stock_status in {'in_stock','low_stock'}),
    ]
    for label,ok in checks:
        if not ok:
            gaps.append(label)
    if item.catalogue_status in {'rejected','notified'} and item.repair_status not in {'in_progress','resubmitted','resolved'}:
        gaps.append('Repair workflow')
    if item.offering_expiry and item.offering_expiry<date.today():
        gaps.append('Offering expired')
    score=round((sum(1 for label,ok in checks if ok)/len(checks))*100)
    if item.catalogue_status=='active' and score>=80:
        level='ready'
    elif score>=60:
        level='needs_review'
    else:
        level='incomplete'
    return {'score':score,'level':level,'gaps':gaps}

def catalogue_summary(items):
    counts=Counter(item.catalogue_status or 'draft' for item in items)
    ready=sum(1 for item in items if catalogue_item_readiness(item)['level']=='ready')
    expiring=sum(1 for item in items if item.offering_expiry and date.today()<=item.offering_expiry<=date.today()+timedelta(days=30))
    expired=sum(1 for item in items if item.offering_expiry and item.offering_expiry<date.today())
    stock_alerts=sum(1 for item in items if item.stock_status in {'low_stock','out_of_stock'} or (item.stock_qty is not None and item.stock_qty<=0 and item.item_type!='service'))
    repair=sum(1 for item in items if item.catalogue_status in {'rejected','notified'} or item.repair_status in {'needs_repair','in_progress'})
    return {
        'total':len(items),
        'active':counts.get('active',0),
        'draft':counts.get('draft',0),
        'submitted':counts.get('submitted',0),
        'rejected':counts.get('rejected',0),
        'notified':counts.get('notified',0),
        'ready':ready,
        'expiring':expiring,
        'expired':expired,
        'stock_alerts':stock_alerts,
        'repair':repair,
    }

BID_WORKFLOW_OPTIONS=['product_bid','service_bid','ra','boq','push_button','custom_catalogue','rate_contract','global_tender']
BID_STATUS_OPTIONS=['planning','in_review','ready','submitted','ra_scheduled','negotiation','awarded','lost','cancelled','no_bid']
BID_STEP_OPTIONS=['not_required','not_checked','not_started','in_progress','ready','submitted','approved','rejected','waived']
BID_SIMPLE_OPTIONS=['none','needed','submitted','answered','closed']

def bid_participation_readiness(item):
    checks=[
        ('Eligibility',item.eligibility_status in {'ready','approved','waived'}),
        ('Documents',item.document_status in {'ready','submitted','approved','waived'}),
        ('Price',item.price_status in {'ready','submitted','approved'}),
        ('BOQ',item.boq_status in {'not_required','ready','submitted','approved'}),
        ('EMD',not item.emd_required or item.emd_status in {'ready','submitted','approved','waived'}),
        ('PBG',not item.pbg_required or item.pbg_status in {'ready','submitted','approved','waived'}),
        ('Custom catalogue',item.custom_catalogue_status in {'not_required','ready','submitted','approved'}),
        ('Rate contract',item.rate_contract_status in {'not_required','ready','submitted','approved'}),
        ('Global tender',item.global_tender_status in {'not_required','ready','submitted','approved'}),
        ('Push button',item.push_button_status in {'not_required','ready','submitted','approved'}),
    ]
    gaps=[label for label,ok in checks if not ok]
    score=round((sum(1 for label,ok in checks if ok)/len(checks))*100)
    if item.participation_status in {'submitted','awarded'} and score>=75:
        level='submitted'
    elif score>=75:
        level='ready'
    elif score>=45:
        level='needs_work'
    else:
        level='incomplete'
    if item.due_date and item.due_date<date.today() and item.participation_status not in {'submitted','awarded','lost','cancelled','no_bid'}:
        gaps.append('Deadline passed')
        level='incomplete'
    return {'score':score,'level':level,'gaps':gaps}

def bid_participation_to_dict(item):
    tender=item.tender if hasattr(item,'tender') else None
    catalogue=item.catalogue_item if hasattr(item,'catalogue_item') else None
    return {
        'id':item.id,
        'tender_id':item.tender_id,
        'workflow_type':item.workflow_type or 'product_bid',
        'participation_status':item.participation_status or 'planning',
        'bid_mode':item.bid_mode or 'standard',
        'catalogue_item_id':item.catalogue_item_id,
        'catalogue_item_name':catalogue.name if catalogue else '',
        'boq_status':item.boq_status or 'not_required',
        'emd_required':bool(item.emd_required),
        'emd_amount':item.emd_amount or '',
        'emd_status':item.emd_status or 'not_required',
        'pbg_required':bool(item.pbg_required),
        'pbg_status':item.pbg_status or 'not_required',
        'clarification_status':item.clarification_status or 'none',
        'representation_status':item.representation_status or 'none',
        'eligibility_status':item.eligibility_status or 'not_checked',
        'document_status':item.document_status or 'not_started',
        'price_status':item.price_status or 'not_started',
        'ra_status':item.ra_status or 'not_applicable',
        'l1_negotiation_status':item.l1_negotiation_status or 'not_applicable',
        'custom_catalogue_status':item.custom_catalogue_status or 'not_required',
        'rate_contract_status':item.rate_contract_status or 'not_required',
        'global_tender_status':item.global_tender_status or 'not_required',
        'push_button_status':item.push_button_status or 'not_required',
        'next_action':item.next_action or '',
        'due_date':iso(item.due_date),
        'submitted_at':iso(item.submitted_at),
        'notes':item.notes or '',
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
        'tender':tender_to_dict(tender) if tender else None,
        'readiness':bid_participation_readiness(item),
    }

def bid_participation_summary(items):
    counts=Counter(item.participation_status or 'planning' for item in items)
    due_soon=sum(1 for item in items if item.due_date and date.today()<=item.due_date<=date.today()+timedelta(days=7))
    overdue=sum(1 for item in items if item.due_date and item.due_date<date.today() and item.participation_status not in {'submitted','awarded','lost','cancelled','no_bid'})
    ready=sum(1 for item in items if bid_participation_readiness(item)['level'] in {'ready','submitted'})
    return {
        'total':len(items),
        'planning':counts.get('planning',0),
        'ready':ready,
        'submitted':counts.get('submitted',0),
        'ra_scheduled':counts.get('ra_scheduled',0),
        'awarded':counts.get('awarded',0),
        'due_soon':due_soon,
        'overdue':overdue,
    }

ORDER_TYPE_OPTIONS=['product','service','mixed']
ORDER_STATUS_OPTIONS=['received','accepted','in_fulfillment','delivered','completed','cancelled','disputed']
ORDER_STEP_OPTIONS=['not_required','not_started','in_progress','ready','submitted','approved','rejected','completed']
ORDER_PAYMENT_OPTIONS=['pending','in_process','paid','delayed','disputed']
ORDER_INCIDENT_OPTIONS=['none','raised','in_progress','resolved','escalated']
ORDER_TREDS_OPTIONS=['not_required','eligible','submitted','approved','financed','rejected']

def order_fulfillment_readiness(item):
    checks=[
        ('Delivery',item.delivery_status in {'ready','submitted','approved','completed'}),
        ('Invoice',item.invoice_status in {'ready','submitted','approved','completed'}),
        ('Supplementary invoice',item.supplementary_invoice_status in {'not_required','ready','submitted','approved','completed'}),
        ('Service billing',item.service_billing_status in {'not_required','ready','submitted','approved','completed'}),
        ('DP extension',item.dp_extension_status in {'not_required','ready','submitted','approved','completed'}),
        ('L1 negotiation',item.l1_negotiation_status in {'not_applicable','accepted','closed'}),
        ('Incident',item.incident_status in {'none','resolved'}),
        ('TReDS',item.treds_status in {'not_required','approved','financed'}),
    ]
    gaps=[label for label,ok in checks if not ok]
    score=round((sum(1 for label,ok in checks if ok)/len(checks))*100)
    overdue_delivery=item.delivery_due_date and item.delivery_due_date<date.today() and item.delivery_status not in {'approved','completed'}
    overdue_payment=item.payment_due_date and item.payment_due_date<date.today() and item.payment_status!='paid'
    if overdue_delivery:
        gaps.append('Delivery overdue')
    if overdue_payment:
        gaps.append('Payment overdue')
    if item.order_status in {'completed'} and item.payment_status=='paid':
        level='complete'
    elif score>=75 and not overdue_delivery:
        level='on_track'
    elif score>=45:
        level='needs_attention'
    else:
        level='blocked'
    if overdue_delivery or overdue_payment or item.incident_status in {'raised','escalated'}:
        level='needs_attention'
    return {'score':score,'level':level,'gaps':gaps}

def order_fulfillment_to_dict(item):
    tender=item.tender if hasattr(item,'tender') else None
    bid=item.bid_participation if hasattr(item,'bid_participation') else None
    return {
        'id':item.id,
        'tender_id':item.tender_id,
        'bid_participation_id':item.bid_participation_id,
        'order_number':item.order_number or '',
        'order_type':item.order_type or 'product',
        'order_status':item.order_status or 'received',
        'buyer_name':item.buyer_name or '',
        'order_value':item.order_value or '',
        'delivery_status':item.delivery_status or 'not_started',
        'delivery_due_date':iso(item.delivery_due_date),
        'dp_extension_status':item.dp_extension_status or 'not_required',
        'invoice_status':item.invoice_status or 'not_started',
        'invoice_number':item.invoice_number or '',
        'invoice_amount':item.invoice_amount or '',
        'supplementary_invoice_status':item.supplementary_invoice_status or 'not_required',
        'service_billing_status':item.service_billing_status or 'not_required',
        'payment_status':item.payment_status or 'pending',
        'payment_due_date':iso(item.payment_due_date),
        'l1_negotiation_status':item.l1_negotiation_status or 'not_applicable',
        'incident_status':item.incident_status or 'none',
        'treds_status':item.treds_status or 'not_required',
        'next_action':item.next_action or '',
        'notes':item.notes or '',
        'created_at':iso(item.created_at),
        'updated_at':iso(item.updated_at),
        'tender':tender_to_dict(tender) if tender else None,
        'bid_workflow':bid_participation_to_dict(bid) if bid else None,
        'readiness':order_fulfillment_readiness(item),
    }

def order_fulfillment_summary(items):
    counts=Counter(item.order_status or 'received' for item in items)
    due_delivery=sum(1 for item in items if item.delivery_due_date and date.today()<=item.delivery_due_date<=date.today()+timedelta(days=7) and item.delivery_status not in {'approved','completed'})
    overdue_delivery=sum(1 for item in items if item.delivery_due_date and item.delivery_due_date<date.today() and item.delivery_status not in {'approved','completed'})
    overdue_payment=sum(1 for item in items if item.payment_due_date and item.payment_due_date<date.today() and item.payment_status!='paid')
    incidents=sum(1 for item in items if item.incident_status in {'raised','in_progress','escalated'})
    return {
        'total':len(items),
        'received':counts.get('received',0),
        'in_fulfillment':counts.get('in_fulfillment',0),
        'delivered':counts.get('delivered',0),
        'completed':counts.get('completed',0),
        'due_delivery':due_delivery,
        'overdue_delivery':overdue_delivery,
        'overdue_payment':overdue_payment,
        'incidents':incidents,
    }

def opportunity_terms(*values):
    text=' '.join(str(value or '') for value in values).lower()
    words=re.findall(r'[a-z0-9][a-z0-9+-]{2,}',text)
    stop={'and','the','for','with','from','gem','bid','tender','supply','procurement','service','services','product','products'}
    return [word for word in words if word not in stop]

def catalogue_match_for_tender(tender,catalogue_items):
    tender_text=' '.join([
        tender.title or '',
        tender.category or '',
        tender.department or '',
        tender.description or '',
    ]).lower()
    best=None
    matches=[]
    for item in catalogue_items:
        terms=opportunity_terms(item.name,item.category,item.gem_category,item.brand,item.model,item.sku)
        unique_terms=sorted(set(terms))
        matched=[term for term in unique_terms if term in tender_text]
        phrase_bonus=0
        for phrase in [item.name,item.gem_category,item.category]:
            phrase=(phrase or '').strip().lower()
            if phrase and len(phrase)>3 and phrase in tender_text:
                phrase_bonus+=18
        raw=(len(matched)*12)+phrase_bonus
        score=min(100,raw)
        readiness=catalogue_item_readiness(item)
        row={
            'item':catalogue_item_to_dict(item),
            'match_score':score,
            'matched_terms':matched[:8],
            'readiness':readiness,
        }
        matches.append(row)
        if not best or (score,readiness.get('score',0))>(best['match_score'],best['readiness'].get('score',0)):
            best=row
    matches=sorted(matches,key=lambda row:(row['match_score'],row['readiness'].get('score',0)),reverse=True)
    return best,matches[:3]

def seller_opportunity_summary(items):
    return {
        'total':len(items),
        'bid':sum(1 for item in items if item['recommendation']=='bid'),
        'review':sum(1 for item in items if item['recommendation']=='review'),
        'no_bid':sum(1 for item in items if item['recommendation']=='no_bid'),
        'high_match':sum(1 for item in items if item['match_score']>=70),
        'catalogue_ready':sum(1 for item in items if item['catalogue_readiness_score']>=75),
        'missing_catalogue':sum(1 for item in items if not item.get('matched_catalogue')),
        'already_in_workflow':sum(1 for item in items if item.get('bid_workflow')),
    }

def seller_opportunity_for_tender(tender,catalogue_items,readiness_summary,bid_by_tender):
    best,top_matches=catalogue_match_for_tender(tender,catalogue_items)
    tender_score=float(tender.relevance_score or 0)
    match_score=best['match_score'] if best else 0
    catalogue_score=best['readiness']['score'] if best else 0
    seller_score=readiness_summary.get('health_score',0)
    score=round((tender_score*.38)+(match_score*.30)+(catalogue_score*.17)+(seller_score*.15))
    reasons=[]
    blockers=[]
    if tender_score>=70:
        reasons.append('Tender score is already high priority')
    elif tender_score>=40:
        reasons.append('Tender has a moderate business fit')
    if best and match_score:
        reasons.append(f"Catalogue match: {best['item']['name']}")
    if catalogue_score>=75:
        reasons.append('Matched catalogue item is mostly ready')
    if seller_score>=75:
        reasons.append('Seller profile and documents are mostly ready')
    if not best or match_score<20:
        blockers.append('No strong catalogue match')
        score-=12
    if best and best['readiness'].get('gaps'):
        blockers.extend(best['readiness']['gaps'][:4])
    if readiness_summary.get('profile_gaps'):
        blockers.extend(readiness_summary['profile_gaps'][:3])
    missing_docs=readiness_summary.get('missing_documents') or []
    if missing_docs:
        blockers.extend([doc.get('label','Missing document') for doc in missing_docs[:3]])
    if tender.deadline and tender.deadline<date.today():
        blockers.append('Tender deadline passed')
        score-=25
    elif tender.deadline and tender.deadline<=date.today()+timedelta(days=7):
        reasons.append('Deadline is within 7 days')
        score-=5
    decision=getattr(tender,'bid_decision',None)
    if decision and decision.recommendation=='no_bid':
        blockers.append('Existing bid decision says no bid')
        score-=15
    elif decision and decision.recommendation=='bid':
        reasons.append('Existing bid decision recommends bid')
        score+=8
    bid_workflow=bid_by_tender.get(tender.id)
    if bid_workflow:
        reasons.append(f"Bid workflow exists: {(bid_workflow.participation_status or 'planning').replace('_',' ')}")
    score=max(0,min(100,score))
    severe={'Tender deadline passed','Existing bid decision says no bid'}
    if score>=75 and not severe.intersection(blockers):
        recommendation='bid'
    elif score>=45:
        recommendation='review'
    else:
        recommendation='no_bid'
    return {
        'tender':tender_to_dict(tender),
        'opportunity_score':score,
        'recommendation':recommendation,
        'match_score':match_score,
        'catalogue_readiness_score':catalogue_score,
        'seller_readiness_score':seller_score,
        'matched_catalogue':best['item'] if best else None,
        'top_matches':top_matches,
        'reasons':reasons[:6] or ['Needs more catalogue or tender scoring data'],
        'blockers':list(dict.fromkeys(blockers))[:8],
        'bid_workflow':bid_participation_to_dict(bid_workflow) if bid_workflow else None,
    }

def chart_from_counter(counter,limit=10):
    pairs=counter.most_common(limit)
    return {'labels':[label for label,count in pairs],'values':[count for label,count in pairs]}

def build_seller_analytics(db,user):
    profile=db.query(SellerProfile).filter(SellerProfile.user_id==user.id).first()
    documents=ensure_seller_documents(db,user.id)
    readiness=seller_readiness_summary(profile,documents)
    catalogue=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).all()
    bids=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).all()
    orders=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id).all()
    bid_by_tender={item.tender_id:item for item in bids if item.tender_id}
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(250).all()
    opportunities=[
        seller_opportunity_for_tender(tender,catalogue,readiness,bid_by_tender)
        for tender in tenders
    ]
    opportunities=sorted(opportunities,key=lambda item:(item['opportunity_score'],item['match_score']),reverse=True)
    catalogue_ready=[catalogue_item_readiness(item) for item in catalogue]
    bid_ready=[bid_participation_readiness(item) for item in bids]
    order_ready=[order_fulfillment_readiness(item) for item in orders]
    recommendations=[]
    if readiness.get('health_score',0)<70:
        recommendations.append({'title':'Complete seller readiness','text':f"{len(readiness.get('profile_gaps',[]))} profile gaps and {len(readiness.get('missing_documents',[]))} missing documents are reducing opportunity scores."})
    if catalogue and catalogue_summary(catalogue).get('ready',0)<len(catalogue):
        recommendations.append({'title':'Improve catalogue readiness','text':'Active catalogue items with complete images, MRP/specs, stock, and approvals will rank higher in opportunity matching.'})
    if opportunities and seller_opportunity_summary(opportunities).get('bid',0):
        recommendations.append({'title':'Convert bid-ready opportunities','text':'Create Bid/RA workflows for top bid recommendations before deadline pressure increases.'})
    due_bids=bid_participation_summary(bids).get('due_soon',0)
    if due_bids:
        recommendations.append({'title':'Act on bid due dates','text':f'{due_bids} Bid/RA workflows are due within 7 days.'})
    order_alerts=order_fulfillment_summary(orders).get('incidents',0)+order_fulfillment_summary(orders).get('overdue_delivery',0)+order_fulfillment_summary(orders).get('overdue_payment',0)
    if order_alerts:
        recommendations.append({'title':'Resolve fulfillment alerts','text':f'{order_alerts} order fulfillment alerts need attention across delivery, incidents, or payments.'})
    if not recommendations:
        recommendations.append({'title':'Keep seller data fresh','text':'Add catalogue items and keep Bid/RA and order status updated to unlock richer analytics.'})
    return {
        'summary':{
            'seller_health':readiness.get('health_score',0),
            'catalogue_total':len(catalogue),
            'catalogue_ready':sum(1 for item in catalogue_ready if item.get('level')=='ready'),
            'opportunities':len(opportunities),
            'bid_recommended':sum(1 for item in opportunities if item.get('recommendation')=='bid'),
            'bid_workflows':len(bids),
            'submitted_bids':sum(1 for item in bids if item.participation_status in {'submitted','awarded'}),
            'orders':len(orders),
            'order_alerts':order_alerts,
        },
        'charts':{
            'catalogueStatus':chart_from_counter(Counter(item.catalogue_status or 'draft' for item in catalogue)),
            'catalogueReadiness':chart_from_counter(Counter(item.get('level','incomplete') for item in catalogue_ready)),
            'opportunityRecommendations':chart_from_counter(Counter(item.get('recommendation','review') for item in opportunities)),
            'bidStatus':chart_from_counter(Counter(item.participation_status or 'planning' for item in bids)),
            'bidReadiness':chart_from_counter(Counter(item.get('level','incomplete') for item in bid_ready)),
            'orderStatus':chart_from_counter(Counter(item.order_status or 'received' for item in orders)),
            'orderPayments':chart_from_counter(Counter(item.payment_status or 'pending' for item in orders)),
            'orderHealth':chart_from_counter(Counter(item.get('level','blocked') for item in order_ready)),
        },
        'readiness':readiness,
        'catalogue':catalogue_summary(catalogue),
        'opportunities':seller_opportunity_summary(opportunities),
        'bids':bid_participation_summary(bids),
        'orders':order_fulfillment_summary(orders),
        'top_opportunities':opportunities[:8],
        'recommendations':recommendations,
    }

def parse_optional_int(value):
    if value in (None,''):
        return None
    try:
        parsed=int(str(value).replace(',','').strip())
        return parsed if parsed >= 0 else None
    except ValueError:
        return None

def json_list_text(value):
    try:
        decoded=json.loads(value or '[]')
        if isinstance(decoded,list):
            return '; '.join(str(item) for item in decoded)
        return str(decoded)
    except Exception:
        return value or ''

def log_to_dict(item):
    return {
        'id':item.id,
        'user_id':item.user_id,
        'source':item.source,
        'status':item.status,
        'message':item.message,
        'created_at':iso(item.created_at),
    }

def performance_to_dict(item):
    return {
        'id':item.id,
        'keyword':item.keyword,
        'fetched_count':item.fetched_count,
        'inserted_count':item.inserted_count,
        'duplicate_count':item.duplicate_count,
        'high_priority_count':item.high_priority_count,
        'average_score':item.average_score,
        'created_at':iso(item.created_at),
    }

def dashboard_summary(db,user):
    soon=date.today()+timedelta(days=10)
    tender_query=user_tenders(db,user)
    return {
        'total':tender_query.count(),
        'high_priority':tender_query.filter(Tender.relevance_score>=70).count(),
        'medium_score':tender_query.filter(Tender.relevance_score>=40,Tender.relevance_score<70).count(),
        'unscored':tender_query.filter(Tender.relevance_score.is_(None)).count(),
        'applied_count':tender_query.filter(Tender.status=='applied').count(),
        'upcoming_count':tender_query.filter(Tender.deadline>=date.today(),Tender.deadline<=soon).count(),
        'high_priority_score':float(os.getenv('HIGH_PRIORITY_SCORE','70')),
    }

@app.get('/dashboard')
def dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/buyer')
def buyer_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller')
def seller_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/readiness')
def seller_readiness_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/catalogue')
def seller_catalogue_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/bids')
def seller_bids_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/orders')
def seller_orders_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/opportunities')
def seller_opportunities_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/seller/analytics')
def seller_analytics_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/tenders')
def tenders_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/react/dashboard')
def react_dashboard(request:Request,user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/profile')
def profile_page(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/company-profile')
def company_profile_page(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.post('/dashboard/profile')
def update_profile(
    request:Request,
    name:str=Form(...),
    email:str=Form(...),
    telegram_enabled:str=Form('false'),
    email_enabled:str=Form('false'),
    db:Session=Depends(get_db),
    user:User=Depends(get_current_user),
):
    cleaned_email=email.strip().lower()
    existing=db.query(User).filter(User.email==cleaned_email,User.id!=user.id).first()
    if existing:
        return RedirectResponse('/dashboard/profile?error=email_exists',303)

    user.name=name.strip()
    user.email=cleaned_email
    get_notification_preference(db,user.id,'telegram').enabled=(telegram_enabled=='true')
    get_notification_preference(db,user.id,'email').enabled=(email_enabled=='true')
    db.commit()
    token=create_access_token({'sub':user.email})
    res=RedirectResponse('/dashboard/profile',303)
    res.set_cookie('access_token',token,httponly=True,samesite='lax')
    return res

@app.post('/dashboard/profile/password')
def update_profile_password(
    request:Request,
    current_password:str=Form(...),
    new_password:str=Form(...),
    confirm_password:str=Form(...),
    db:Session=Depends(get_db),
    user:User=Depends(get_current_user),
):
    if not verify_password(current_password,user.password_hash):
        return RedirectResponse('/dashboard/profile?error=current_password',303)
    elif len(new_password) < 6:
        return RedirectResponse('/dashboard/profile?error=password_length',303)
    elif new_password != confirm_password:
        return RedirectResponse('/dashboard/profile?error=password_match',303)
    else:
        user.password_hash=hash_password(new_password)
        db.commit()
    return RedirectResponse('/dashboard/profile?message=password_updated',303)

@app.post('/api/profile')
async def api_update_profile(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    name=(payload.get('name') or '').strip()
    cleaned_email=(payload.get('email') or '').strip().lower()
    if not name or not cleaned_email:
        raise HTTPException(400,'Name and email are required')
    existing=db.query(User).filter(User.email==cleaned_email,User.id!=user.id).first()
    if existing:
        raise HTTPException(400,'Email already belongs to another user.')
    user.name=name
    user.email=cleaned_email
    get_notification_preference(db,user.id,'telegram').enabled=bool(payload.get('telegram_enabled'))
    get_notification_preference(db,user.id,'email').enabled=bool(payload.get('email_enabled'))
    db.commit()
    token=create_access_token({'sub':user.email})
    res=Response(json.dumps({'ok':True}),media_type='application/json')
    res.set_cookie('access_token',token,httponly=True,samesite='lax')
    return res

@app.post('/api/profile/password')
async def api_update_profile_password(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    current_password=payload.get('current_password') or ''
    new_password=payload.get('new_password') or ''
    confirm_password=payload.get('confirm_password') or ''
    if not verify_password(current_password,user.password_hash):
        raise HTTPException(400,'Current password is incorrect.')
    if len(new_password) < 6:
        raise HTTPException(400,'New password must be at least 6 characters.')
    if new_password != confirm_password:
        raise HTTPException(400,'New passwords do not match.')
    user.password_hash=hash_password(new_password)
    db.commit()
    return {'ok':True}

@app.get('/dashboard/high-priority')
def high_priority_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/upcoming-deadlines')
def upcoming_deadlines_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/applied')
def applied_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/tracking')
def tracking_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/pipeline')
def pipeline_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

def top_counts(values,limit=10):
    counts=Counter(value or 'Unknown' for value in values)
    return counts.most_common(limit)

def chart_from_pairs(pairs):
    return {'labels':[label for label,count in pairs],'values':[count for label,count in pairs]}

def deadline_bucket(deadline):
    if not deadline:
        return 'No deadline'
    days=(deadline-date.today()).days
    if days < 0:
        return 'Expired'
    if days <= 7:
        return '0-7 days'
    if days <= 15:
        return '8-15 days'
    if days <= 30:
        return '16-30 days'
    return '30+ days'

def value_bucket(value):
    value=value or 0
    if value <= 0:
        return 'Not available'
    if value < 100000:
        return '< 1 lakh'
    if value < 1000000:
        return '1-10 lakh'
    if value < 10000000:
        return '10 lakh-1 crore'
    return '1 crore+'

def build_analysis_data(db,user):
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    tender_ids=[t.id for t in tenders]
    documents=[]
    if tender_ids:
        documents=db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).all()

    score_pairs=[
        ('High 70+',sum(1 for t in tenders if t.relevance_score is not None and t.relevance_score>=70)),
        ('Medium 40-69',sum(1 for t in tenders if t.relevance_score is not None and 40<=t.relevance_score<70)),
        ('Low <40',sum(1 for t in tenders if t.relevance_score is not None and t.relevance_score<40)),
        ('Unscored',sum(1 for t in tenders if t.relevance_score is None)),
    ]
    status_pairs=top_counts([t.status for t in tenders],8)
    state_pairs=top_counts([t.state for t in tenders],10)
    department_pairs=top_counts([t.department for t in tenders],10)
    category_pairs=top_counts([t.category for t in tenders],10)
    deadline_pairs=top_counts([deadline_bucket(t.deadline) for t in tenders],6)
    value_pairs=top_counts([value_bucket(t.estimated_value) for t in tenders],5)
    document_pairs=top_counts([d.status for d in documents],6)
    source_pairs=top_counts([t.source for t in tenders],8)

    analysis_terms=[
        'iot','sensor','automation','scada','monitoring','telemetry','smart irrigation',
        'smart city','network','software','hardware','maintenance','installation','amc',
        'water','power','medical','defence','security','cloud','data'
    ]
    corpus=' '.join(
        f"{t.title or ''} {t.department or ''} {t.category or ''} {t.description or ''}"
        for t in tenders
    ).lower()
    pdf_corpus=' '.join((d.extracted_text or '') for d in documents).lower()
    keyword_pairs=[
        (term.title(),corpus.count(term)+pdf_corpus.count(term))
        for term in analysis_terms
        if corpus.count(term)+pdf_corpus.count(term)>0
    ]
    keyword_pairs=sorted(keyword_pairs,key=lambda item:item[1],reverse=True)[:12]

    expiring_soon=sorted(
        [t for t in tenders if t.deadline and date.today() <= t.deadline <= date.today()+timedelta(days=10)],
        key=lambda t:t.deadline,
    )[:10]
    high_value=sorted(
        [t for t in tenders if t.estimated_value],
        key=lambda t:t.estimated_value or 0,
        reverse=True,
    )[:10]

    pdf_linked=len(documents)
    pdf_extracted=sum(1 for d in documents if d.extracted_text)
    pdf_missing=max(0,len(tenders)-pdf_linked)

    return {
        'charts':{
            'score':chart_from_pairs(score_pairs),
            'status':chart_from_pairs(status_pairs),
            'state':chart_from_pairs(state_pairs),
            'department':chart_from_pairs(department_pairs),
            'category':chart_from_pairs(category_pairs),
            'deadline':chart_from_pairs(deadline_pairs),
            'value':chart_from_pairs(value_pairs),
            'documents':chart_from_pairs(document_pairs),
            'source':chart_from_pairs(source_pairs),
            'keywords':chart_from_pairs(keyword_pairs),
            'pdfCoverage':{
                'labels':['Linked PDFs','Extracted Text','Missing PDF Links'],
                'values':[pdf_linked,pdf_extracted,pdf_missing],
            },
        },
        'summary':{
            'total':len(tenders),
            'documents':pdf_linked,
            'pdf_extracted':pdf_extracted,
            'avg_score':round(sum(t.relevance_score or 0 for t in tenders)/len(tenders),1) if tenders else 0,
            'total_value':sum(t.estimated_value or 0 for t in tenders),
            'expiring_soon':len([t for t in tenders if t.deadline and date.today() <= t.deadline <= date.today()+timedelta(days=10)]),
        },
        'tables':{
            'expiringSoon':[{'title':t.title,'deadline':str(t.deadline),'score':t.relevance_score,'department':t.department} for t in expiring_soon],
            'highValue':[{'title':t.title,'value':t.estimated_value,'deadline':str(t.deadline or ''),'department':t.department} for t in high_value],
        },
    }

def build_buyer_intelligence(db,user):
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    tender_ids=[t.id for t in tenders]
    documents_by_tender={}
    eligibility_ids=set()
    decisions_by_tender={}
    if tender_ids:
        for doc in db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).all():
            documents_by_tender.setdefault(doc.tender_id,[]).append(doc)
        eligibility_ids={
            item.tender_id
            for item in db.query(TenderEligibility.tender_id).filter(TenderEligibility.tender_id.in_(tender_ids)).all()
        }
        decisions_by_tender={
            item.tender_id:item
            for item in db.query(BidDecision).filter(BidDecision.tender_id.in_(tender_ids)).all()
        }

    buyer_map={}
    today=date.today()
    soon=today+timedelta(days=10)
    for tender in tenders:
        buyer=(tender.department or 'Unknown Buyer').strip() or 'Unknown Buyer'
        row=buyer_map.setdefault(buyer,{
            'name':buyer,
            'tender_count':0,
            'high_priority_count':0,
            'applied_count':0,
            'won_count':0,
            'lost_count':0,
            'upcoming_count':0,
            'deadline_risk':0,
            'total_value':0,
            'score_total':0,
            'score_count':0,
            'last_seen':None,
            'states':Counter(),
            'categories':Counter(),
            'statuses':Counter(),
            'documents':0,
            'eligibility_extracted':0,
            'bid_decisions':Counter(),
            'recent_tenders':[],
        })
        row['tender_count']+=1
        score=tender.relevance_score or 0
        if tender.relevance_score is not None:
            row['score_total']+=score
            row['score_count']+=1
        if score>=70:
            row['high_priority_count']+=1
        if tender.status=='applied':
            row['applied_count']+=1
        if tender.status=='won':
            row['won_count']+=1
        if tender.status=='lost':
            row['lost_count']+=1
        if tender.deadline and today<=tender.deadline<=soon:
            row['upcoming_count']+=1
            row['deadline_risk']+=1
        row['total_value']+=tender.estimated_value or 0
        if tender.created_at and (not row['last_seen'] or tender.created_at>row['last_seen']):
            row['last_seen']=tender.created_at
        if tender.state:
            row['states'][tender.state]+=1
        if tender.category:
            row['categories'][tender.category]+=1
        if tender.status:
            row['statuses'][tender.status]+=1
        row['documents']+=len(documents_by_tender.get(tender.id,[]))
        if tender.id in eligibility_ids:
            row['eligibility_extracted']+=1
        decision=decisions_by_tender.get(tender.id)
        if decision:
            row['bid_decisions'][decision.recommendation or 'review']+=1
        if len(row['recent_tenders'])<5:
            row['recent_tenders'].append({
                'id':tender.id,
                'title':tender.title,
                'deadline':iso(tender.deadline),
                'score':tender.relevance_score or 0,
                'status':tender.status or 'new',
                'value':tender.estimated_value or 0,
            })

    buyers=[]
    for row in buyer_map.values():
        count=row['tender_count'] or 1
        row['avg_score']=round(row['score_total']/row['score_count'],1) if row['score_count'] else 0
        row['avg_value']=round(row['total_value']/count,1)
        row['last_seen']=iso(row['last_seen'])
        row['states']=[{'label':label,'count':count} for label,count in row['states'].most_common(5)]
        row['categories']=[{'label':label,'count':count} for label,count in row['categories'].most_common(5)]
        row['statuses']=[{'label':label,'count':count} for label,count in row['statuses'].most_common(5)]
        row['bid_decisions']={
            'bid':row['bid_decisions'].get('bid',0),
            'review':row['bid_decisions'].get('review',0),
            'no_bid':row['bid_decisions'].get('no_bid',0),
        }
        row.pop('score_total',None)
        row.pop('score_count',None)
        buyers.append(row)

    buyers=sorted(
        buyers,
        key=lambda item:(item['high_priority_count'],item['tender_count'],item['total_value'],item['avg_score']),
        reverse=True,
    )
    top_buyer=buyers[0]['name'] if buyers else ''
    return {
        'summary':{
            'total_buyers':len(buyers),
            'repeat_buyers':sum(1 for item in buyers if item['tender_count']>1),
            'high_priority_buyers':sum(1 for item in buyers if item['high_priority_count']>0),
            'total_value':sum(item['total_value'] for item in buyers),
            'top_buyer':top_buyer,
        },
        'charts':{
            'volume':chart_from_pairs([(item['name'],item['tender_count']) for item in buyers[:10]]),
            'value':chart_from_pairs([(item['name'],item['total_value']) for item in sorted(buyers,key=lambda x:x['total_value'],reverse=True)[:10]]),
            'score':chart_from_pairs([(item['name'],item['avg_score']) for item in sorted(buyers,key=lambda x:x['avg_score'],reverse=True)[:10]]),
            'deadlineRisk':chart_from_pairs([(item['name'],item['deadline_risk']) for item in sorted(buyers,key=lambda x:x['deadline_risk'],reverse=True)[:10] if item['deadline_risk']]),
        },
        'buyers':buyers,
    }

def clean_competitor_name(value):
    if not value:
        return ''
    cleaned=re.sub(r'\s+',' ',value).strip(' .,:;-()[]{}')
    cleaned=re.sub(r'\b(?:and|or|the|for|with|against|under|through|dated|vide)\b.*$','',cleaned,flags=re.I).strip(' .,:;-')
    if len(cleaned)<4 or len(cleaned)>90:
        return ''
    if cleaned.lower() in {'system','systems','supplier','vendor','contractor','bidder','buyer','seller','item','items','supply','service','services'}:
        return ''
    if re.search(r'\b(?:department|ministry|government|office|bid|tender|gem|item|quantity|address)\b',cleaned,re.I):
        return ''
    return cleaned

def extract_award_signals(text):
    if not text:
        return []
    snippets=[]
    normalized=re.sub(r'\s+',' ',text)[:50000]
    patterns=[
        r'(?:awarded\s+to|awardee|successful\s+bidder|selected\s+bidder|l1\s+bidder|lowest\s+bidder|supplier|vendor|contractor)\s*(?:is|:|-|to)?\s*([A-Z][A-Za-z0-9&.,()/ -]{3,90})',
        r'([A-Z][A-Za-z0-9&.,()/ -]{3,90})\s+(?:has\s+been\s+)?(?:awarded|declared\s+L1|selected\s+as\s+L1)',
        r'(?:M/s\.?|Ms\.?)\s+([A-Z][A-Za-z0-9&.,()/ -]{3,90})',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern,normalized,flags=re.I):
            name=clean_competitor_name(match.group(1))
            if not name:
                continue
            start=max(0,match.start()-90)
            end=min(len(normalized),match.end()+140)
            snippets.append({'name':name,'snippet':normalized[start:end].strip()})
            if len(snippets)>=40:
                return snippets
    return snippets

def build_competitor_intelligence(db,user):
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    tender_ids=[t.id for t in tenders]
    docs_by_tender={}
    if tender_ids:
        for doc in db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).all():
            docs_by_tender.setdefault(doc.tender_id,[]).append(doc)
    competitor_map={}
    award_watch=[]
    award_keywords=['awarded','awardee','successful bidder','selected bidder','l1 bidder','lowest bidder','contractor','supplier','vendor']
    for tender in tenders:
        doc_text=' '.join((doc.extracted_text or '') for doc in docs_by_tender.get(tender.id,[]))
        text=f"{tender.title or ''} {tender.department or ''} {tender.description or ''} {doc_text}"
        text_lower=text.lower()
        has_award_signal=any(term in text_lower for term in award_keywords) or (tender.status in {'won','lost'})
        signals=extract_award_signals(text)
        if has_award_signal or signals:
            award_watch.append({
                'id':tender.id,
                'title':tender.title,
                'department':tender.department or 'Unknown Buyer',
                'state':tender.state or '',
                'status':tender.status or 'new',
                'deadline':iso(tender.deadline),
                'value':tender.estimated_value or 0,
                'score':tender.relevance_score or 0,
                'signals':[item['name'] for item in signals[:4]],
                'snippet':signals[0]['snippet'] if signals else (tender.ai_reason or tender.description or '')[:260],
            })
        for signal in signals:
            key=signal['name'].lower()
            row=competitor_map.setdefault(key,{
                'name':signal['name'],
                'signal_count':0,
                'buyers':Counter(),
                'states':Counter(),
                'categories':Counter(),
                'total_value':0,
                'last_seen':None,
                'examples':[],
            })
            row['signal_count']+=1
            if tender.department:
                row['buyers'][tender.department]+=1
            if tender.state:
                row['states'][tender.state]+=1
            if tender.category:
                row['categories'][tender.category]+=1
            row['total_value']+=tender.estimated_value or 0
            if tender.created_at and (not row['last_seen'] or tender.created_at>row['last_seen']):
                row['last_seen']=tender.created_at
            if len(row['examples'])<4:
                row['examples'].append({
                    'tender_id':tender.id,
                    'title':tender.title,
                    'buyer':tender.department or 'Unknown Buyer',
                    'snippet':signal['snippet'],
                })
    competitors=[]
    for row in competitor_map.values():
        row['buyers']=[{'label':label,'count':count} for label,count in row['buyers'].most_common(5)]
        row['states']=[{'label':label,'count':count} for label,count in row['states'].most_common(5)]
        row['categories']=[{'label':label,'count':count} for label,count in row['categories'].most_common(5)]
        row['last_seen']=iso(row['last_seen'])
        competitors.append(row)
    competitors=sorted(competitors,key=lambda item:(item['signal_count'],item['total_value']),reverse=True)
    status_pairs=top_counts([t.status for t in tenders if t.status in {'won','lost','applied'}],5)
    award_watch=sorted(award_watch,key=lambda item:(len(item['signals']),item['score'],item['value']),reverse=True)[:20]
    return {
        'summary':{
            'competitors_detected':len(competitors),
            'award_signal_tenders':len(award_watch),
            'won':sum(1 for t in tenders if t.status=='won'),
            'lost':sum(1 for t in tenders if t.status=='lost'),
            'competitive_buyers':len({item['department'] for item in award_watch if item.get('department')}),
        },
        'charts':{
            'competitors':chart_from_pairs([(item['name'],item['signal_count']) for item in competitors[:10]]),
            'value':chart_from_pairs([(item['name'],item['total_value']) for item in sorted(competitors,key=lambda x:x['total_value'],reverse=True)[:10]]),
            'buyers':chart_from_pairs(top_counts([item['department'] for item in award_watch],10)),
            'outcomes':chart_from_pairs(status_pairs),
        },
        'competitors':competitors[:25],
        'award_watch':award_watch,
    }

def month_label(value):
    if not value:
        return 'Unknown'
    return value.strftime('%b %Y')

def build_market_intelligence(db,user):
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    tender_ids=[t.id for t in tenders]
    documents=[]
    if tender_ids:
        documents=db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).all()
    total=len(tenders)
    high_priority=[t for t in tenders if (t.relevance_score or 0)>=70]
    expiring=[t for t in tenders if t.deadline and date.today()<=t.deadline<=date.today()+timedelta(days=10)]
    values=[t.estimated_value or 0 for t in tenders]
    active_values=[value for value in values if value>0]
    category_value=Counter()
    state_value=Counter()
    buyer_value=Counter()
    opportunity_index=[]
    for tender in tenders:
        value=tender.estimated_value or 0
        if tender.category:
            category_value[tender.category]+=value
        if tender.state:
            state_value[tender.state]+=value
        if tender.department:
            buyer_value[tender.department]+=value
        days_left=(tender.deadline-date.today()).days if tender.deadline else 45
        urgency=30 if 0<=days_left<=7 else 20 if 8<=days_left<=15 else 10 if 16<=days_left<=30 else 0
        value_boost=20 if value>=10000000 else 14 if value>=1000000 else 8 if value>=100000 else 0
        score=tender.relevance_score or 0
        market_score=min(100,round((score*.55)+urgency+value_boost,1))
        opportunity_index.append({
            'id':tender.id,
            'title':tender.title,
            'department':tender.department or 'Unknown Buyer',
            'state':tender.state or '',
            'category':tender.category or 'Unknown',
            'deadline':iso(tender.deadline),
            'value':value,
            'score':score,
            'market_score':market_score,
            'status':tender.status or 'new',
        })
    opportunity_index=sorted(opportunity_index,key=lambda item:(item['market_score'],item['value']),reverse=True)[:12]
    keyword_performance=db.query(KeywordPerformance).filter(KeywordPerformance.user_id==user.id).order_by(KeywordPerformance.created_at.desc()).limit(100).all()
    keyword_pairs=Counter()
    for item in keyword_performance:
        keyword_pairs[item.keyword]+=item.inserted_count or item.fetched_count or 0
    if not keyword_pairs:
        corpus=' '.join(f"{t.title or ''} {t.category or ''} {t.description or ''}" for t in tenders).lower()
        for term in ['iot','sensor','automation','software','hardware','medical','defence','water','network','cloud','security','maintenance']:
            count=corpus.count(term)
            if count:
                keyword_pairs[term.title()]=count
    recommendations=[]
    if high_priority:
        top_category=top_counts([t.category for t in high_priority],1)[0][0]
        recommendations.append({'title':'Double down on high-fit categories','text':f'{len(high_priority)} high-priority tenders are available. Strongest current category signal: {top_category}.'})
    if expiring:
        recommendations.append({'title':'Act on deadline pressure','text':f'{len(expiring)} tenders close within 10 days. Move them through pipeline review first.'})
    if active_values:
        recommendations.append({'title':'Value focus','text':f'Known tender value totals {format_inr(sum(active_values))}. Use value and score sorting to prioritize the biggest realistic bids.'})
    if documents:
        extracted=sum(1 for doc in documents if doc.extracted_text)
        if extracted < len(documents):
            recommendations.append({'title':'Improve PDF intelligence','text':f'{len(documents)-extracted} linked PDFs do not have extracted text yet. Extract them to improve eligibility, competitor, and market signals.'})
    if not recommendations:
        recommendations.append({'title':'Collect more market data','text':'Scrape more tenders or extract PDFs to unlock stronger market trend signals.'})
    return {
        'summary':{
            'total_tenders':total,
            'high_priority':len(high_priority),
            'known_market_value':sum(active_values),
            'avg_value':round(sum(active_values)/len(active_values),1) if active_values else 0,
            'avg_score':round(sum(t.relevance_score or 0 for t in tenders)/total,1) if total else 0,
            'expiring_soon':len(expiring),
            'pdf_coverage':round((len(documents)/total)*100,1) if total else 0,
        },
        'charts':{
            'monthlyVolume':chart_from_pairs(top_counts([month_label(t.created_at) for t in tenders],12)[::-1]),
            'categoryVolume':chart_from_pairs(top_counts([t.category for t in tenders],10)),
            'categoryValue':chart_from_pairs(category_value.most_common(10)),
            'stateVolume':chart_from_pairs(top_counts([t.state for t in tenders],10)),
            'stateValue':chart_from_pairs(state_value.most_common(10)),
            'buyerValue':chart_from_pairs(buyer_value.most_common(10)),
            'scoreMix':chart_from_pairs([
                ('High 70+',len(high_priority)),
                ('Medium 40-69',sum(1 for t in tenders if 40<=(t.relevance_score or 0)<70)),
                ('Low <40',sum(1 for t in tenders if (t.relevance_score or 0)<40)),
            ]),
            'deadline':chart_from_pairs(top_counts([deadline_bucket(t.deadline) for t in tenders],6)),
            'keywords':chart_from_pairs(keyword_pairs.most_common(10)),
        },
        'opportunities':opportunity_index,
        'recommendations':recommendations,
        'leaders':{
            'top_category':top_counts([t.category for t in tenders],1)[0][0] if tenders else '',
            'top_state':top_counts([t.state for t in tenders],1)[0][0] if tenders else '',
            'top_buyer':top_counts([t.department for t in tenders],1)[0][0] if tenders else '',
            'top_keyword':keyword_pairs.most_common(1)[0][0] if keyword_pairs else '',
        },
    }

def report_period_window(period):
    today=date.today()
    if period=='monthly':
        start=today-timedelta(days=30)
        label='Monthly'
    else:
        start=today-timedelta(days=7)
        label='Weekly'
    return label,start,today

def build_executive_report(db,user,period='weekly'):
    period='monthly' if period=='monthly' else 'weekly'
    label,start,end=report_period_window(period)
    all_tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    tenders=[
        tender for tender in all_tenders
        if not tender.created_at or tender.created_at.date()>=start
    ]
    tender_ids=[t.id for t in tenders]
    documents=[]
    decisions={}
    eligibility_count=0
    if tender_ids:
        documents=db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).all()
        decisions={item.tender_id:item for item in db.query(BidDecision).filter(BidDecision.tender_id.in_(tender_ids)).all()}
        eligibility_count=db.query(TenderEligibility).filter(TenderEligibility.tender_id.in_(tender_ids)).count()
    high_priority=[t for t in tenders if (t.relevance_score or 0)>=70]
    expiring=[t for t in tenders if t.deadline and date.today()<=t.deadline<=date.today()+timedelta(days=10)]
    values=[t.estimated_value or 0 for t in tenders if (t.estimated_value or 0)>0]
    bid_count=sum(1 for item in decisions.values() if item.recommendation=='bid')
    review_count=sum(1 for item in decisions.values() if item.recommendation=='review')
    no_bid_count=sum(1 for item in decisions.values() if item.recommendation=='no_bid')
    top_opportunities=sorted(
        tenders,
        key=lambda t:((t.relevance_score or 0),t.estimated_value or 0),
        reverse=True,
    )[:10]
    top_value=sorted(
        [t for t in tenders if t.estimated_value],
        key=lambda t:t.estimated_value or 0,
        reverse=True,
    )[:10]
    key_findings=[]
    if high_priority:
        key_findings.append(f"{len(high_priority)} high-priority opportunities found in the {label.lower()} window.")
    if expiring:
        key_findings.append(f"{len(expiring)} tenders close within 10 days and need immediate review.")
    if bid_count:
        key_findings.append(f"{bid_count} tenders have a bid recommendation.")
    if values:
        key_findings.append(f"Known market value in this window is {format_inr(sum(values))}.")
    if not key_findings:
        key_findings.append("No major movement detected in this reporting window yet.")
    actions=[]
    if expiring:
        actions.append({'title':'Deadline action','text':'Review expiring tenders first and move them through the pipeline.'})
    if high_priority:
        actions.append({'title':'Opportunity action','text':'Assign owners to high-priority tenders and generate bid/no-bid recommendations.'})
    if documents and eligibility_count < len(documents):
        actions.append({'title':'Document action','text':'Extract eligibility from remaining PDFs to reduce bid review risk.'})
    if not actions:
        actions.append({'title':'Data action','text':'Run a scrape and generate eligibility/bid recommendations to enrich the next executive report.'})
    return {
        'period':period,
        'period_label':label,
        'date_range':{'start':start.isoformat(),'end':end.isoformat()},
        'summary':{
            'total_tenders':len(tenders),
            'high_priority':len(high_priority),
            'known_value':sum(values),
            'avg_score':round(sum(t.relevance_score or 0 for t in tenders)/len(tenders),1) if tenders else 0,
            'expiring_soon':len(expiring),
            'documents':len(documents),
            'eligibility_extracted':eligibility_count,
            'bid_recommended':bid_count,
        },
        'charts':{
            'status':chart_from_pairs(top_counts([t.status for t in tenders],8)),
            'score':chart_from_pairs([
                ('High 70+',len(high_priority)),
                ('Medium 40-69',sum(1 for t in tenders if 40<=(t.relevance_score or 0)<70)),
                ('Low <40',sum(1 for t in tenders if (t.relevance_score or 0)<40)),
            ]),
            'buyers':chart_from_pairs(top_counts([t.department for t in tenders],8)),
            'states':chart_from_pairs(top_counts([t.state for t in tenders],8)),
            'categories':chart_from_pairs(top_counts([t.category for t in tenders],8)),
            'decisions':chart_from_pairs([('Bid',bid_count),('Review',review_count),('No Bid',no_bid_count)]),
        },
        'top_opportunities':[
            {
                'id':t.id,
                'title':t.title,
                'department':t.department or '',
                'state':t.state or '',
                'deadline':iso(t.deadline),
                'value':t.estimated_value or 0,
                'score':t.relevance_score or 0,
                'status':t.status or 'new',
                'decision':decisions.get(t.id).recommendation if decisions.get(t.id) else '',
            }
            for t in top_opportunities
        ],
        'top_value':[
            {
                'id':t.id,
                'title':t.title,
                'department':t.department or '',
                'deadline':iso(t.deadline),
                'value':t.estimated_value or 0,
                'score':t.relevance_score or 0,
            }
            for t in top_value
        ],
        'key_findings':key_findings,
        'actions':actions,
    }

def build_executive_report_rows(report):
    rows=[]
    for key,value in report['summary'].items():
        rows.append({'Section':'Summary','Metric':key.replace('_',' ').title(),'Value':value})
    for finding in report.get('key_findings',[]):
        rows.append({'Section':'Key Findings','Metric':'Finding','Value':finding})
    for action in report.get('actions',[]):
        rows.append({'Section':'Recommended Actions','Metric':action.get('title',''),'Value':action.get('text','')})
    for name,chart in report.get('charts',{}).items():
        for label,value in zip(chart.get('labels',[]),chart.get('values',[])):
            rows.append({'Section':name.replace('_',' ').title(),'Metric':label,'Value':value})
    for item in report.get('top_opportunities',[]):
        rows.append({
            'Section':'Top Opportunities',
            'Metric':item.get('title',''),
            'Value':f"{item.get('department','')} | Score: {item.get('score',0)} | Value: {format_inr(item.get('value',0))} | Deadline: {item.get('deadline','')} | Status: {item.get('status','')}",
        })
    for item in report.get('top_value',[]):
        rows.append({
            'Section':'Highest Value',
            'Metric':item.get('title',''),
            'Value':f"{item.get('department','')} | Value: {format_inr(item.get('value',0))} | Score: {item.get('score',0)} | Deadline: {item.get('deadline','')}",
        })
    return rows

def build_executive_html_report(report,user):
    rows=build_executive_report_rows(report)
    sections={}
    for row in rows:
        sections.setdefault(row['Section'],[]).append(row)
    summary=report['summary']
    cards=[
        ('Tenders',summary.get('total_tenders',0)),
        ('High Priority',summary.get('high_priority',0)),
        ('Known Value',format_inr(summary.get('known_value',0))),
        ('Avg Score',summary.get('avg_score',0)),
        ('Expiring Soon',summary.get('expiring_soon',0)),
        ('Bid Recommended',summary.get('bid_recommended',0)),
    ]
    card_html=''.join(f'<div class="tile"><span>{escape(label)}</span><strong>{escape(str(value))}</strong></div>' for label,value in cards)
    body=[]
    for section,items in sections.items():
        table_rows=''.join(f'<tr><td>{escape(str(item["Metric"]))}</td><td>{escape(str(item["Value"]))}</td></tr>' for item in items)
        body.append(f'<section><h2>{escape(section)}</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>{table_rows}</tbody></table></section>')
    return f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{escape(report['period_label'])} Executive Tender Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 28px; color: #0f172a; background: #f8fafc; }}
.hero {{ background: #111827; color: white; padding: 24px; border-radius: 8px; margin-bottom: 18px; }}
.hero h1 {{ margin: 0 0 8px; font-size: 24px; }}
.hero p {{ margin: 0; color: #cbd5e1; }}
.summary {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 18px; }}
.tile, section {{ background: white; border: 1px solid #dbe3ef; border-radius: 8px; padding: 14px; margin-bottom: 14px; }}
.tile span {{ display: block; color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; }}
.tile strong {{ font-size: 20px; }}
h2 {{ font-size: 17px; margin: 0 0 10px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
th, td {{ border: 1px solid #dbe3ef; padding: 8px; vertical-align: top; text-align: left; }}
th {{ background: #f1f5f9; }}
@media print {{ body {{ background: white; }} section, .tile {{ break-inside: avoid; }} }}
</style>
</head>
<body>
<div class="hero"><h1>{escape(report['period_label'])} Executive Tender Report</h1><p>Generated for {escape(user.name or user.email)} | {escape(report['date_range']['start'])} to {escape(report['date_range']['end'])}</p></div>
<div class="summary">{card_html}</div>
{''.join(body)}
</body>
</html>'''

def build_analysis_export_rows(analysis_data):
    rows=[]
    summary_labels={
        'total':'Total Tenders',
        'documents':'PDF Links',
        'pdf_extracted':'PDF Text Extracted',
        'avg_score':'Average AI Score',
        'total_value':'Total Estimated Value',
        'expiring_soon':'Expiring Soon',
    }
    for key,label in summary_labels.items():
        rows.append({'Section':'Summary','Metric':label,'Value':analysis_data['summary'].get(key,0)})

    chart_labels={
        'score':'AI Score Distribution',
        'status':'Status Breakdown',
        'state':'State Wise Tenders',
        'department':'Top Departments',
        'category':'Category Mix',
        'deadline':'Deadline Risk',
        'value':'Estimated Value Bands',
        'documents':'Document Status',
        'source':'Source Coverage',
        'keywords':'Keyword Signals',
        'pdfCoverage':'PDF Document Coverage',
    }
    for chart_key,title in chart_labels.items():
        chart=analysis_data['charts'].get(chart_key,{'labels':[],'values':[]})
        for label,value in zip(chart.get('labels',[]),chart.get('values',[])):
            rows.append({'Section':title,'Metric':label,'Value':value})

    for item in analysis_data['tables'].get('expiringSoon',[]):
        rows.append({
            'Section':'Upcoming Deadline Watch',
            'Metric':item.get('title',''),
            'Value':f"{item.get('department','')} | Deadline: {item.get('deadline','')} | Score: {item.get('score','')}",
        })
    for item in analysis_data['tables'].get('highValue',[]):
        rows.append({
            'Section':'Highest Value Tenders',
            'Metric':item.get('title',''),
            'Value':f"{item.get('department','')} | Value: {item.get('value',0)} | Deadline: {item.get('deadline','')}",
        })
    return rows

def format_inr(value):
    try:
        return f"Rs. {int(value):,}"
    except (TypeError,ValueError):
        return 'Rs. 0'

def build_analysis_html_report(analysis_data,user):
    summary=analysis_data['summary']
    rows=build_analysis_export_rows(analysis_data)
    sections={}
    for row in rows:
        sections.setdefault(row['Section'],[]).append(row)
    summary_cards=[
        ('Total Tenders',summary.get('total',0)),
        ('Average Score',summary.get('avg_score',0)),
        ('Total Value',format_inr(summary.get('total_value',0))),
        ('Expiring Soon',summary.get('expiring_soon',0)),
        ('PDF Links',summary.get('documents',0)),
        ('PDF Text Extracted',summary.get('pdf_extracted',0)),
    ]
    cards=''.join(
        f'<div class="tile"><span>{escape(str(label))}</span><strong>{escape(str(value))}</strong></div>'
        for label,value in summary_cards
    )
    report_sections=[]
    for section,items in sections.items():
        if section=='Summary':
            continue
        body=''.join(
            f'<tr><td>{escape(str(item["Metric"]))}</td><td>{escape(str(item["Value"]))}</td></tr>'
            for item in items
        )
        report_sections.append(f'''
            <section>
                <h2>{escape(section)}</h2>
                <table>
                    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                    <tbody>{body}</tbody>
                </table>
            </section>
        ''')
    return f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Tender Analytics Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 28px; color: #0f172a; background: #f8fafc; }}
.hero {{ background: #0f172a; color: #fff; padding: 24px; border-radius: 8px; margin-bottom: 18px; }}
.hero h1 {{ margin: 0 0 8px; font-size: 24px; }}
.hero p {{ margin: 0; color: #cbd5e1; }}
.summary {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }}
.tile {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }}
.tile span {{ display: block; color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; }}
.tile strong {{ font-size: 20px; }}
section {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 14px; }}
h2 {{ font-size: 17px; margin: 0 0 10px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
th, td {{ border: 1px solid #dbe3ef; padding: 8px; vertical-align: top; text-align: left; }}
th {{ background: #f1f5f9; }}
@media print {{ body {{ background: #fff; }} .hero, section, .tile {{ break-inside: avoid; }} }}
</style>
</head>
<body>
<div class="hero">
    <h1>Tender Analytics Report</h1>
    <p>Generated for {escape(user.name or user.email)} on {date.today()}</p>
</div>
<div class="summary">{cards}</div>
{''.join(report_sections)}
</body>
</html>'''

@app.get('/dashboard/analysis')
def analysis_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/buyers')
def buyer_intelligence_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/competitors')
def competitor_intelligence_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/market')
def market_intelligence_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/reports')
def executive_reports_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/exports/analysis/{fmt}')
def export_analysis(fmt:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if fmt not in {'report','csv'}:
        raise HTTPException(404,'Unsupported export format')
    analysis_data=build_analysis_data(db,user)
    if fmt=='csv':
        content=build_csv(build_analysis_export_rows(analysis_data))
        return Response(
            content,
            media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition':'attachment; filename="tender_analytics_report.csv"'},
        )
    content=build_analysis_html_report(analysis_data,user)
    return Response(
        content,
        media_type='text/html; charset=utf-8',
        headers={'Content-Disposition':'attachment; filename="tender_analytics_report.html"'},
    )

@app.get('/exports/executive/{period}/{fmt}')
def export_executive_report(period:str,fmt:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if period not in {'weekly','monthly'} or fmt not in {'report','csv'}:
        raise HTTPException(404,'Unsupported executive report export')
    report=build_executive_report(db,user,period)
    filename=f"executive_{period}_tender_report"
    if fmt=='csv':
        content=build_csv(build_executive_report_rows(report))
        return Response(
            content,
            media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition':f'attachment; filename="{filename}.csv"'},
        )
    content=build_executive_html_report(report,user)
    return Response(
        content,
        media_type='text/html; charset=utf-8',
        headers={'Content-Disposition':f'attachment; filename="{filename}.html"'},
    )

@app.post('/tracking/update-now')
def update_tracking_now(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    result=update_tender_statuses(db,user.id)
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return result
    return RedirectResponse('/dashboard/tracking',303)

@app.get('/dashboard/admin')
def admin_dashboard(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/admin/keywords')
def admin_keywords(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/admin/scoring')
def admin_scoring(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/admin/settings')
def admin_settings(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/admin/gem-alerts')
def admin_gem_alerts(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/dashboard/admin/delete')
def admin_delete(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return react_shell()

@app.get('/api/me')
def api_me(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    telegram_pref=get_notification_preference(db,user.id,'telegram')
    email_pref=get_notification_preference(db,user.id,'email')
    return {
        'id':user.id,
        'name':user.name,
        'email':user.email,
        'role':user.role if user.role in {'buyer','seller'} else 'buyer',
        'dashboard_path':'/dashboard/seller' if user.role=='seller' else '/dashboard/buyer',
        'is_active':user.is_active,
        'created_at':iso(user.created_at),
        'notifications':{
            'telegram':telegram_pref.enabled,
            'email':email_pref.enabled,
        },
    }

@app.get('/api/dashboard/summary')
def api_dashboard_summary(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return dashboard_summary(db,user)

@app.get('/api/tenders')
def api_tenders(
    view:str='all',
    limit:int=100,
    q:str='',
    score:str='all',
    status:str='',
    department:str='',
    state:str='',
    category:str='',
    source:str='',
    min_value:str='',
    max_value:str='',
    deadline_from:str='',
    deadline_to:str='',
    deadline_bucket:str='',
    eligibility:str='',
    bid_decision:str='',
    sort:str='newest',
    db:Session=Depends(get_db),
    user:User=Depends(get_current_user),
):
    limit=max(1,min(500,limit))
    query=user_tenders(db,user)
    if view=='high':
        query=query.filter(Tender.relevance_score>=70)
    elif view=='upcoming':
        soon=date.today()+timedelta(days=10)
        query=query.filter(Tender.deadline>=date.today(),Tender.deadline<=soon).order_by(Tender.deadline.asc())
    elif view=='applied':
        query=query.filter(Tender.status=='applied')
    needle=(q or '').strip()
    if needle:
        like=f'%{needle}%'
        query=query.filter(or_(
            Tender.title.ilike(like),
            Tender.tender_id.ilike(like),
            Tender.department.ilike(like),
            Tender.description.ilike(like),
            Tender.state.ilike(like),
            Tender.category.ilike(like),
        ))
    if score=='high':
        query=query.filter(Tender.relevance_score>=70)
    elif score=='medium':
        query=query.filter(Tender.relevance_score>=40,Tender.relevance_score<70)
    elif score=='low':
        query=query.filter(Tender.relevance_score<40)
    elif score=='unscored':
        query=query.filter(Tender.relevance_score.is_(None))
    for column,raw in [
        (Tender.status,status),
        (Tender.department,department),
        (Tender.state,state),
        (Tender.category,category),
        (Tender.source,source),
    ]:
        values=split_filter(raw)
        if values:
            query=query.filter(column.in_(values))
    try:
        if min_value not in {'',None}:
            query=query.filter(Tender.estimated_value>=float(min_value))
        if max_value not in {'',None}:
            query=query.filter(Tender.estimated_value<=float(max_value))
    except ValueError:
        raise HTTPException(400,'Value filters must be numbers')
    start=parse_date(deadline_from)
    end=parse_date(deadline_to)
    if start:
        query=query.filter(Tender.deadline>=start)
    if end:
        query=query.filter(Tender.deadline<=end)
    today=date.today()
    if deadline_bucket=='expired':
        query=query.filter(Tender.deadline<today)
    elif deadline_bucket=='next7':
        query=query.filter(Tender.deadline>=today,Tender.deadline<=today+timedelta(days=7))
    elif deadline_bucket=='next15':
        query=query.filter(Tender.deadline>=today,Tender.deadline<=today+timedelta(days=15))
    elif deadline_bucket=='next30':
        query=query.filter(Tender.deadline>=today,Tender.deadline<=today+timedelta(days=30))
    elif deadline_bucket=='no_deadline':
        query=query.filter(Tender.deadline.is_(None))
    if eligibility in {'extracted','missing'}:
        eligibility_ids=[row.tender_id for row in db.query(TenderEligibility.tender_id).join(Tender,TenderEligibility.tender_id==Tender.id).filter(Tender.user_id==user.id).all()]
        query=query.filter(Tender.id.in_(eligibility_ids) if eligibility=='extracted' else ~Tender.id.in_(eligibility_ids))
    if bid_decision in {'bid','review','no_bid','missing'}:
        decision_query=db.query(BidDecision.tender_id).join(Tender,BidDecision.tender_id==Tender.id).filter(Tender.user_id==user.id)
        if bid_decision!='missing':
            decision_query=decision_query.filter(BidDecision.recommendation==bid_decision)
        decision_ids=[row.tender_id for row in decision_query.all()]
        query=query.filter(Tender.id.in_(decision_ids) if bid_decision!='missing' else ~Tender.id.in_(decision_ids))
    total=query.count()
    if sort=='deadline':
        query=query.order_by(Tender.deadline.asc().nullslast())
    elif sort=='value':
        query=query.order_by(Tender.estimated_value.desc().nullslast())
    elif sort=='score':
        query=query.order_by(Tender.relevance_score.desc().nullslast())
    else:
        query=query.order_by(Tender.created_at.desc())
    return {'items':[tender_to_dict(item) for item in query.limit(limit).all()],'count':total,'limit':limit}

@app.get('/api/tender-filter-options')
def api_tender_filter_options(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tenders=user_tenders(db,user).all()
    def values(field):
        return sorted({(getattr(t,field) or '').strip() for t in tenders if (getattr(t,field) or '').strip()})
    return {
        'departments':values('department'),
        'states':values('state'),
        'categories':values('category'),
        'sources':values('source'),
        'statuses':values('status') or ['new','reviewing','applied','won','lost','ignored'],
        'total':len(tenders),
    }

@app.get('/api/tenders/{tender_id}')
def api_tender_detail(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    documents=db.query(TenderDocument).filter(TenderDocument.tender_id==tender.id).all()
    data=tender_to_dict(tender)
    data['documents']=[
        {
            'id':doc.id,
            'document_type':doc.document_type,
            'url':doc.url,
            'file_path':doc.file_path,
            'status':doc.status,
            'created_at':iso(doc.created_at),
            'updated_at':iso(doc.updated_at),
        }
        for doc in documents
    ]
    return data

@app.get('/api/tracking')
def api_tracking(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    items=user_tracking(db,user).order_by(TenderTracking.updated_at.desc()).limit(500).all()
    return {'items':[tracking_to_dict(item) for item in items]}

@app.get('/api/analysis')
def api_analysis(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_analysis_data(db,user)

@app.get('/api/buyers')
def api_buyers(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_buyer_intelligence(db,user)

@app.get('/api/competitors')
def api_competitors(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_competitor_intelligence(db,user)

@app.get('/api/market')
def api_market(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_market_intelligence(db,user)

@app.get('/api/reports/executive')
def api_executive_report(period:str='weekly',db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_executive_report(db,user,period)

@app.get('/api/admin/logs')
def api_admin_logs(limit:int=25,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    limit=max(1,min(100,limit))
    logs=db.query(ScrapingLog).filter(ScrapingLog.user_id==user.id).order_by(ScrapingLog.created_at.desc()).limit(limit).all()
    return {'items':[log_to_dict(item) for item in logs]}

@app.get('/api/admin/keywords')
def api_admin_keywords(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    keywords=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id).order_by(ScrapeKeyword.keyword.asc()).all()
    performance=db.query(KeywordPerformance).filter(KeywordPerformance.user_id==user.id).order_by(KeywordPerformance.created_at.desc()).limit(30).all()
    return {
        'items':[keyword_to_dict(item) for item in keywords],
        'profiles':list(KEYWORD_PROFILES.keys()),
        'performance':[performance_to_dict(item) for item in performance],
    }

@app.get('/api/admin/scoring')
def api_admin_scoring(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    criteria=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id).order_by(ScoringCriterion.keyword.asc()).all()
    return {'items':[scoring_to_dict(item) for item in criteria],'profiles':list(KEYWORD_PROFILES.keys())}

@app.get('/api/company-profile')
def api_company_profile(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    profile=db.query(CompanyProfile).filter(CompanyProfile.user_id==user.id).first()
    return {
        'profile':company_profile_to_dict(profile),
        'matching_rules':[
            {'field':'Products','impact':'+18 per match'},
            {'field':'Services','impact':'+16 per match'},
            {'field':'Industries','impact':'+12 per match'},
            {'field':'Target departments','impact':'+12 per match'},
            {'field':'Target states','impact':'+10 per match'},
            {'field':'Certifications','impact':'+8 per match'},
            {'field':'Experience keywords','impact':'+10 per match'},
            {'field':'Negative keywords','impact':'-22 per match'},
            {'field':'Tender value range','impact':'+8 in range, penalty outside range'},
        ],
    }

@app.post('/api/company-profile')
async def api_save_company_profile(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    profile=db.query(CompanyProfile).filter(CompanyProfile.user_id==user.id).first()
    if not profile:
        profile=CompanyProfile(user_id=user.id)
        db.add(profile)
    profile.company_name=(payload.get('company_name') or '').strip()[:255] or None
    for field in ['products','services','industries','target_departments','target_states','certifications','experience_keywords','negative_keywords']:
        setattr(profile,field,(payload.get(field) or '').strip())
    profile.min_tender_value=parse_optional_int(payload.get('min_tender_value'))
    profile.max_tender_value=parse_optional_int(payload.get('max_tender_value'))
    profile.is_active=bool(payload.get('is_active',True))
    db.commit()
    db.refresh(profile)
    return {'ok':True,'profile':company_profile_to_dict(profile)}

@app.get('/api/seller/readiness')
def api_seller_readiness(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    profile=db.query(SellerProfile).filter(SellerProfile.user_id==user.id).first()
    documents=ensure_seller_documents(db,user.id)
    return {
        'profile':seller_profile_to_dict(profile),
        'documents':[seller_document_to_dict(item) for item in documents],
        'summary':seller_readiness_summary(profile,documents),
        'status_options':{
            'document':['missing','ready','submitted','approved','rejected','expired','not_applicable'],
            'vendor_assessment':['not_started','ready','submitted','approved','rejected','not_required'],
            'caution_money':['pending','paid','refundable','not_applicable'],
            'tds_certificate':['missing','available','expired','not_applicable'],
        },
    }

@app.post('/api/seller/readiness')
async def api_save_seller_readiness(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    profile=db.query(SellerProfile).filter(SellerProfile.user_id==user.id).first()
    if not profile:
        profile=SellerProfile(user_id=user.id)
        db.add(profile)
    profile.business_name=(payload.get('business_name') or '').strip()[:255] or None
    profile.gem_seller_id=(payload.get('gem_seller_id') or '').strip()[:100] or None
    profile.pan=(payload.get('pan') or '').strip().upper()[:20] or None
    profile.aadhaar_linked=bool(payload.get('aadhaar_linked'))
    profile.gstin=(payload.get('gstin') or '').strip().upper()[:30] or None
    profile.udyam_number=(payload.get('udyam_number') or '').strip()[:100] or None
    profile.startup_india_number=(payload.get('startup_india_number') or '').strip()[:100] or None
    profile.odop_state=(payload.get('odop_state') or '').strip()[:100] or None
    profile.odop_product=(payload.get('odop_product') or '').strip()[:255] or None
    profile.bank_verified=bool(payload.get('bank_verified'))
    profile.address_verified=bool(payload.get('address_verified'))
    profile.secondary_user_created=bool(payload.get('secondary_user_created'))
    vendor_status=(payload.get('vendor_assessment_status') or 'not_started').strip()
    profile.vendor_assessment_status=vendor_status if vendor_status in {'not_started','ready','submitted','approved','rejected','not_required'} else 'not_started'
    caution_status=(payload.get('caution_money_status') or 'pending').strip()
    profile.caution_money_status=caution_status if caution_status in {'pending','paid','refundable','not_applicable'} else 'pending'
    tds_status=(payload.get('tds_certificate_status') or 'missing').strip()
    profile.tds_certificate_status=tds_status if tds_status in {'missing','available','expired','not_applicable'} else 'missing'
    profile.notes=(payload.get('notes') or '').strip()[:5000] or None
    db.commit()
    db.refresh(profile)
    documents=ensure_seller_documents(db,user.id)
    return {'ok':True,'profile':seller_profile_to_dict(profile),'summary':seller_readiness_summary(profile,documents)}

@app.post('/api/seller/readiness/documents/{doc_key}')
async def api_save_seller_document(doc_key:str,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    allowed={key for key,label,category in SELLER_DOCUMENT_DEFAULTS}
    if doc_key not in allowed:
        raise HTTPException(404,'Seller document not found')
    documents=ensure_seller_documents(db,user.id)
    item=next((doc for doc in documents if doc.doc_key==doc_key),None)
    if not item:
        raise HTTPException(404,'Seller document not found')
    status=(payload.get('status') or 'missing').strip()
    item.status=status if status in {'missing','ready','submitted','approved','rejected','expired','not_applicable'} else 'missing'
    item.expiry_date=parse_date(payload.get('expiry_date'))
    item.notes=(payload.get('notes') or '').strip()[:2000] or None
    db.commit()
    db.refresh(item)
    documents=ensure_seller_documents(db,user.id)
    profile=db.query(SellerProfile).filter(SellerProfile.user_id==user.id).first()
    return {'ok':True,'document':seller_document_to_dict(item),'summary':seller_readiness_summary(profile,documents)}

@app.get('/api/seller/catalogue')
def api_seller_catalogue(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    items=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).order_by(SellerCatalogueItem.updated_at.desc()).all()
    return {
        'items':[catalogue_item_to_dict(item) for item in items],
        'summary':catalogue_summary(items),
        'status_options':{
            'item_type':['product','service'],
            'catalogue':CATALOGUE_STATUS_OPTIONS,
            'document':CATALOGUE_DOC_STATUS_OPTIONS,
            'stock':CATALOGUE_STOCK_OPTIONS,
            'repair':CATALOGUE_REPAIR_OPTIONS,
        },
    }

@app.post('/api/seller/catalogue')
async def api_create_catalogue_item(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    name=(payload.get('name') or '').strip()
    if not name:
        raise HTTPException(400,'Catalogue item name is required')
    item=SellerCatalogueItem(user_id=user.id,name=name[:255])
    db.add(item)
    apply_catalogue_payload(item,payload)
    db.commit()
    db.refresh(item)
    items=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).all()
    return {'ok':True,'item':catalogue_item_to_dict(item),'summary':catalogue_summary(items)}

@app.post('/api/seller/catalogue/{item_id}')
async def api_update_catalogue_item(item_id:int,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id,SellerCatalogueItem.id==item_id).first()
    if not item:
        raise HTTPException(404,'Catalogue item not found')
    payload=await request.json()
    apply_catalogue_payload(item,payload)
    db.commit()
    db.refresh(item)
    items=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).all()
    return {'ok':True,'item':catalogue_item_to_dict(item),'summary':catalogue_summary(items)}

@app.delete('/api/seller/catalogue/{item_id}')
def api_delete_catalogue_item(item_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id,SellerCatalogueItem.id==item_id).first()
    if not item:
        raise HTTPException(404,'Catalogue item not found')
    db.delete(item)
    db.commit()
    items=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).all()
    return {'ok':True,'deleted':item_id,'summary':catalogue_summary(items)}

@app.get('/api/seller/opportunities')
def api_seller_opportunities(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    profile=db.query(SellerProfile).filter(SellerProfile.user_id==user.id).first()
    documents=ensure_seller_documents(db,user.id)
    readiness=seller_readiness_summary(profile,documents)
    catalogue=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).order_by(SellerCatalogueItem.updated_at.desc()).all()
    bids=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).all()
    bid_by_tender={item.tender_id:item for item in bids if item.tender_id}
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(250).all()
    items=[
        seller_opportunity_for_tender(tender,catalogue,readiness,bid_by_tender)
        for tender in tenders
    ]
    items=sorted(items,key=lambda item:(item['opportunity_score'],item['match_score'],item['tender'].get('estimated_value') or 0),reverse=True)
    return {
        'items':items,
        'summary':seller_opportunity_summary(items),
        'seller_readiness':readiness,
        'catalogue_summary':catalogue_summary(catalogue),
        'catalogue_count':len(catalogue),
    }

@app.post('/api/seller/opportunities/{tender_id}/create-bid')
async def api_create_bid_from_opportunity(tender_id:int,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    existing=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id,SellerBidParticipation.tender_id==tender.id).first()
    if existing:
        return {'ok':True,'item':bid_participation_to_dict(existing),'created':False}
    payload=await request.json()
    catalogue_id=parse_optional_int(payload.get('catalogue_item_id'))
    catalogue_item=None
    if catalogue_id:
        catalogue_item=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id,SellerCatalogueItem.id==catalogue_id).first()
        if not catalogue_item:
            raise HTTPException(404,'Catalogue item not found')
    item=SellerBidParticipation(
        user_id=user.id,
        tender_id=tender.id,
        catalogue_item_id=catalogue_id,
        workflow_type='service_bid' if catalogue_item and catalogue_item.item_type=='service' else 'product_bid',
        participation_status='planning',
        due_date=tender.deadline,
        next_action='Review eligibility and prepare bid documents',
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {'ok':True,'item':bid_participation_to_dict(item),'created':True}

@app.get('/api/seller/analytics')
def api_seller_analytics(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return build_seller_analytics(db,user)

def apply_catalogue_payload(item,payload):
    item.item_type=(payload.get('item_type') or item.item_type or 'product').strip() if (payload.get('item_type') or item.item_type or 'product') in {'product','service'} else 'product'
    for field,limit in [
        ('name',255),('category',255),('gem_category',255),('brand',255),('model',255),('sku',100),('clone_pair_source',255)
    ]:
        if field in payload:
            setattr(item,field,(payload.get(field) or '').strip()[:limit] or None)
    for field,allowed,default in [
        ('oem_status',CATALOGUE_DOC_STATUS_OPTIONS,'not_required'),
        ('reseller_status',CATALOGUE_DOC_STATUS_OPTIONS,'not_required'),
        ('brand_approval_status',CATALOGUE_DOC_STATUS_OPTIONS,'not_started'),
        ('image_status',CATALOGUE_DOC_STATUS_OPTIONS,'missing'),
        ('mrp_document_status',CATALOGUE_DOC_STATUS_OPTIONS,'missing'),
        ('specs_status',CATALOGUE_DOC_STATUS_OPTIONS,'missing'),
        ('catalogue_status',CATALOGUE_STATUS_OPTIONS,'draft'),
        ('stock_status',CATALOGUE_STOCK_OPTIONS,'unknown'),
        ('repair_status',CATALOGUE_REPAIR_OPTIONS,'none'),
    ]:
        if field in payload:
            value=(payload.get(field) or default).strip()
            setattr(item,field,value if value in allowed else default)
    if 'stock_qty' in payload:
        item.stock_qty=parse_optional_int(payload.get('stock_qty')) or 0
    if 'offering_expiry' in payload:
        item.offering_expiry=parse_date(payload.get('offering_expiry'))
    if 'notes' in payload:
        item.notes=(payload.get('notes') or '').strip()[:5000] or None

@app.get('/api/seller/bids')
def api_seller_bids(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    items=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).order_by(SellerBidParticipation.updated_at.desc()).all()
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(200).all()
    catalogue=db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id).order_by(SellerCatalogueItem.name.asc()).all()
    return {
        'items':[bid_participation_to_dict(item) for item in items],
        'summary':bid_participation_summary(items),
        'tenders':[{'id':t.id,'title':t.title,'tender_id':t.tender_id,'deadline':iso(t.deadline),'score':t.relevance_score or 0} for t in tenders],
        'catalogue':[{'id':item.id,'name':item.name,'item_type':item.item_type,'status':item.catalogue_status} for item in catalogue],
        'status_options':{
            'workflow':BID_WORKFLOW_OPTIONS,
            'participation':BID_STATUS_OPTIONS,
            'step':BID_STEP_OPTIONS,
            'simple':BID_SIMPLE_OPTIONS,
            'ra':['not_applicable','pending','scheduled','participated','completed','lost','won'],
            'l1':['not_applicable','pending','in_progress','accepted','rejected','closed'],
        },
    }

@app.post('/api/seller/bids')
async def api_create_seller_bid(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    tender_id=parse_optional_int(payload.get('tender_id'))
    if tender_id and not user_tenders(db,user).filter(Tender.id==tender_id).first():
        raise HTTPException(404,'Tender not found')
    item=SellerBidParticipation(user_id=user.id,tender_id=tender_id)
    db.add(item)
    apply_bid_payload(item,payload,user,db)
    db.commit()
    db.refresh(item)
    items=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).all()
    return {'ok':True,'item':bid_participation_to_dict(item),'summary':bid_participation_summary(items)}

@app.post('/api/seller/bids/{item_id}')
async def api_update_seller_bid(item_id:int,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id,SellerBidParticipation.id==item_id).first()
    if not item:
        raise HTTPException(404,'Bid participation not found')
    payload=await request.json()
    apply_bid_payload(item,payload,user,db)
    db.commit()
    db.refresh(item)
    items=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).all()
    return {'ok':True,'item':bid_participation_to_dict(item),'summary':bid_participation_summary(items)}

@app.delete('/api/seller/bids/{item_id}')
def api_delete_seller_bid(item_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id,SellerBidParticipation.id==item_id).first()
    if not item:
        raise HTTPException(404,'Bid participation not found')
    db.delete(item)
    db.commit()
    items=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).all()
    return {'ok':True,'deleted':item_id,'summary':bid_participation_summary(items)}

def apply_bid_payload(item,payload,user,db):
    if 'tender_id' in payload:
        tender_id=parse_optional_int(payload.get('tender_id'))
        if tender_id and not user_tenders(db,user).filter(Tender.id==tender_id).first():
            raise HTTPException(404,'Tender not found')
        item.tender_id=tender_id
    if 'catalogue_item_id' in payload:
        catalogue_id=parse_optional_int(payload.get('catalogue_item_id'))
        if catalogue_id and not db.query(SellerCatalogueItem).filter(SellerCatalogueItem.user_id==user.id,SellerCatalogueItem.id==catalogue_id).first():
            raise HTTPException(404,'Catalogue item not found')
        item.catalogue_item_id=catalogue_id
    for field,allowed,default in [
        ('workflow_type',BID_WORKFLOW_OPTIONS,'product_bid'),
        ('participation_status',BID_STATUS_OPTIONS,'planning'),
        ('eligibility_status',BID_STEP_OPTIONS,'not_checked'),
        ('document_status',BID_STEP_OPTIONS,'not_started'),
        ('price_status',BID_STEP_OPTIONS,'not_started'),
        ('boq_status',BID_STEP_OPTIONS,'not_required'),
        ('emd_status',BID_STEP_OPTIONS,'not_required'),
        ('pbg_status',BID_STEP_OPTIONS,'not_required'),
        ('custom_catalogue_status',BID_STEP_OPTIONS,'not_required'),
        ('rate_contract_status',BID_STEP_OPTIONS,'not_required'),
        ('global_tender_status',BID_STEP_OPTIONS,'not_required'),
        ('push_button_status',BID_STEP_OPTIONS,'not_required'),
        ('clarification_status',BID_SIMPLE_OPTIONS,'none'),
        ('representation_status',BID_SIMPLE_OPTIONS,'none'),
    ]:
        if field in payload:
            value=(payload.get(field) or default).strip()
            setattr(item,field,value if value in allowed else default)
    if 'ra_status' in payload:
        value=(payload.get('ra_status') or 'not_applicable').strip()
        item.ra_status=value if value in {'not_applicable','pending','scheduled','participated','completed','lost','won'} else 'not_applicable'
    if 'l1_negotiation_status' in payload:
        value=(payload.get('l1_negotiation_status') or 'not_applicable').strip()
        item.l1_negotiation_status=value if value in {'not_applicable','pending','in_progress','accepted','rejected','closed'} else 'not_applicable'
    if 'bid_mode' in payload:
        item.bid_mode=(payload.get('bid_mode') or 'standard').strip()[:50] or 'standard'
    item.emd_required=bool(payload.get('emd_required')) if 'emd_required' in payload else item.emd_required
    item.pbg_required=bool(payload.get('pbg_required')) if 'pbg_required' in payload else item.pbg_required
    if 'emd_amount' in payload:
        item.emd_amount=parse_optional_int(payload.get('emd_amount'))
    if 'next_action' in payload:
        item.next_action=(payload.get('next_action') or '').strip()[:255] or None
    if 'due_date' in payload:
        item.due_date=parse_date(payload.get('due_date'))
    if 'submitted_at' in payload:
        raw=(payload.get('submitted_at') or '').strip()
        try:
            item.submitted_at=datetime.fromisoformat(raw) if raw else None
        except ValueError:
            item.submitted_at=None
    if 'notes' in payload:
        item.notes=(payload.get('notes') or '').strip()[:5000] or None

@app.get('/api/seller/orders')
def api_seller_orders(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    items=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id).order_by(SellerOrderFulfillment.updated_at.desc()).all()
    bids=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id).order_by(SellerBidParticipation.updated_at.desc()).all()
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(200).all()
    return {
        'items':[order_fulfillment_to_dict(item) for item in items],
        'summary':order_fulfillment_summary(items),
        'bids':[{'id':item.id,'label':(item.tender.title if item.tender else item.workflow_type),'status':item.participation_status,'tender_id':item.tender_id} for item in bids],
        'tenders':[{'id':t.id,'title':t.title,'tender_id':t.tender_id,'deadline':iso(t.deadline),'score':t.relevance_score or 0} for t in tenders],
        'status_options':{
            'order_type':ORDER_TYPE_OPTIONS,
            'order':ORDER_STATUS_OPTIONS,
            'step':ORDER_STEP_OPTIONS,
            'payment':ORDER_PAYMENT_OPTIONS,
            'incident':ORDER_INCIDENT_OPTIONS,
            'treds':ORDER_TREDS_OPTIONS,
            'l1':['not_applicable','pending','in_progress','accepted','rejected','closed'],
        },
    }

@app.post('/api/seller/orders')
async def api_create_seller_order(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    item=SellerOrderFulfillment(user_id=user.id)
    db.add(item)
    apply_order_payload(item,payload,user,db)
    db.commit()
    db.refresh(item)
    items=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id).all()
    return {'ok':True,'item':order_fulfillment_to_dict(item),'summary':order_fulfillment_summary(items)}

@app.post('/api/seller/orders/{item_id}')
async def api_update_seller_order(item_id:int,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id,SellerOrderFulfillment.id==item_id).first()
    if not item:
        raise HTTPException(404,'Order fulfillment item not found')
    payload=await request.json()
    apply_order_payload(item,payload,user,db)
    db.commit()
    db.refresh(item)
    items=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id).all()
    return {'ok':True,'item':order_fulfillment_to_dict(item),'summary':order_fulfillment_summary(items)}

@app.delete('/api/seller/orders/{item_id}')
def api_delete_seller_order(item_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id,SellerOrderFulfillment.id==item_id).first()
    if not item:
        raise HTTPException(404,'Order fulfillment item not found')
    db.delete(item)
    db.commit()
    items=db.query(SellerOrderFulfillment).filter(SellerOrderFulfillment.user_id==user.id).all()
    return {'ok':True,'deleted':item_id,'summary':order_fulfillment_summary(items)}

def apply_order_payload(item,payload,user,db):
    if 'tender_id' in payload:
        tender_id=parse_optional_int(payload.get('tender_id'))
        if tender_id and not user_tenders(db,user).filter(Tender.id==tender_id).first():
            raise HTTPException(404,'Tender not found')
        item.tender_id=tender_id
    if 'bid_participation_id' in payload:
        bid_id=parse_optional_int(payload.get('bid_participation_id'))
        bid=None
        if bid_id:
            bid=db.query(SellerBidParticipation).filter(SellerBidParticipation.user_id==user.id,SellerBidParticipation.id==bid_id).first()
            if not bid:
                raise HTTPException(404,'Bid workflow not found')
        item.bid_participation_id=bid_id
        if bid and not item.tender_id:
            item.tender_id=bid.tender_id
    for field,allowed,default in [
        ('order_type',ORDER_TYPE_OPTIONS,'product'),
        ('order_status',ORDER_STATUS_OPTIONS,'received'),
        ('delivery_status',ORDER_STEP_OPTIONS,'not_started'),
        ('dp_extension_status',ORDER_STEP_OPTIONS,'not_required'),
        ('invoice_status',ORDER_STEP_OPTIONS,'not_started'),
        ('supplementary_invoice_status',ORDER_STEP_OPTIONS,'not_required'),
        ('service_billing_status',ORDER_STEP_OPTIONS,'not_required'),
        ('payment_status',ORDER_PAYMENT_OPTIONS,'pending'),
        ('l1_negotiation_status',['not_applicable','pending','in_progress','accepted','rejected','closed'],'not_applicable'),
        ('incident_status',ORDER_INCIDENT_OPTIONS,'none'),
        ('treds_status',ORDER_TREDS_OPTIONS,'not_required'),
    ]:
        if field in payload:
            value=(payload.get(field) or default).strip()
            setattr(item,field,value if value in allowed else default)
    for field,limit in [('order_number',100),('buyer_name',255),('invoice_number',100),('next_action',255)]:
        if field in payload:
            setattr(item,field,(payload.get(field) or '').strip()[:limit] or None)
    for field in ['order_value','invoice_amount']:
        if field in payload:
            setattr(item,field,parse_optional_int(payload.get(field)))
    for field in ['delivery_due_date','payment_due_date']:
        if field in payload:
            setattr(item,field,parse_date(payload.get(field)))
    if 'notes' in payload:
        item.notes=(payload.get('notes') or '').strip()[:5000] or None

@app.get('/api/admin/settings')
def api_admin_settings(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    scrape_states=get_json_setting(db,user.id,'scrape_states',[])
    legacy_state=get_setting(db,user.id,'scrape_state','')
    if legacy_state and legacy_state not in scrape_states:
        scrape_states.append(legacy_state)
    return {
        'only_high_priority':get_setting(db,user.id,'only_high_priority_scrape','false')=='true',
        'scrape_states':scrape_states,
        'scrape_city':get_setting(db,user.id,'scrape_city',''),
        'indian_states':INDIAN_STATES,
        'auto_scrape_enabled':get_setting(db,user.id,'auto_scrape_enabled','false')=='true',
        'auto_scrape_mode':get_setting(db,user.id,'auto_scrape_mode','interval'),
        'auto_scrape_interval_hours':get_setting(db,user.id,'auto_scrape_interval_hours','6'),
        'auto_scrape_time':get_setting(db,user.id,'auto_scrape_time','09:00'),
        'auto_scrape_last_run':get_setting(db,user.id,'auto_scrape_last_run',''),
        'daily_digest_enabled':get_setting(db,user.id,'daily_digest_enabled','false')=='true',
        'daily_digest_time':get_setting(db,user.id,'daily_digest_time','09:00'),
        'daily_digest_min_score':get_setting(db,user.id,'daily_digest_min_score','70'),
        'daily_digest_last_run':get_setting(db,user.id,'daily_digest_last_run',''),
    }

@app.get('/api/admin/delete-summary')
def api_delete_summary(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender_ids=[row.id for row in user_tenders(db,user).all()]
    return {
        'tenders':len(tender_ids),
        'documents':db.query(TenderDocument).filter(TenderDocument.tender_id.in_(tender_ids)).count() if tender_ids else 0,
        'tracking':db.query(TenderTracking).filter(TenderTracking.tender_id.in_(tender_ids)).count() if tender_ids else 0,
        'notifications':db.query(NotificationLog).filter(NotificationLog.tender_id.in_(tender_ids)).count() if tender_ids else 0,
        'keyword_performance':db.query(KeywordPerformance).filter(KeywordPerformance.user_id==user.id).count(),
        'scrape_logs':db.query(ScrapingLog).filter(ScrapingLog.user_id==user.id).count(),
        'scrape_runs':db.query(ScrapeRun).filter(ScrapeRun.user_id==user.id).count(),
        'scrape_jobs':db.query(ScrapeJob).filter(ScrapeJob.user_id==user.id).count(),
    }

@app.get('/tenders')
def get_tenders(db:Session=Depends(get_db),user:User=Depends(get_current_user)): return user_tenders(db,user).order_by(Tender.created_at.desc()).all()

def safe_filename(value):
    cleaned=''.join(ch if ch.isalnum() else '_' for ch in (value or 'tender'))
    return cleaned[:80].strip('_') or 'tender'

def tender_export_rows(tenders):
    rows=[]
    for t in tenders:
        eligibility=getattr(t,'eligibility',None)
        bid_decision=getattr(t,'bid_decision',None)
        rows.append({
            'Tender ID':t.tender_id or '',
            'Title':t.title or '',
            'Department':t.department or '',
            'State':t.state or '',
            'Estimated Value':str(t.estimated_value or 0),
            'Deadline':str(t.deadline or ''),
            'Source':t.source or '',
            'Category':t.category or '',
            'AI Score':str(t.relevance_score if t.relevance_score is not None else ''),
            'Recommendation':'Apply' if t.ai_recommendation else 'Review',
            'Status':t.status or '',
            'Reason':t.ai_reason or '',
            'Bid Decision':bid_decision.recommendation if bid_decision else '',
            'Bid Decision Score':str(bid_decision.decision_score if bid_decision else ''),
            'Bid Decision Reasons':json_list_text(bid_decision.reasons) if bid_decision else '',
            'Bid Decision Blockers':json_list_text(bid_decision.blockers) if bid_decision else '',
            'Bid Decision Next Steps':json_list_text(bid_decision.next_steps) if bid_decision else '',
            'EMD':eligibility.emd if eligibility else '',
            'Turnover Requirement':eligibility.turnover_requirement if eligibility else '',
            'Experience Requirement':eligibility.experience_requirement if eligibility else '',
            'Documents Required':eligibility.documents_required if eligibility else '',
            'Certifications Required':eligibility.certifications_required if eligibility else '',
            'Eligibility Risks':eligibility.risk_flags if eligibility else '',
            'Eligibility Summary':eligibility.summary if eligibility else '',
            'URL':t.url or '',
            'Description':t.description or '',
        })
    return rows

def build_csv(rows):
    output=io.StringIO()
    headers=list(rows[0].keys()) if rows else ['Tender ID','Title','Department','Deadline','AI Score','Status']
    writer=csv.DictWriter(output,fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()

def build_html_report(rows):
    headers=list(rows[0].keys()) if rows else ['Tender ID','Title','Department','Deadline','AI Score','Status']
    body_rows=[]
    for row in rows:
        body_rows.append('<tr>' + ''.join(f'<td>{escape(str(row.get(header,"")))}</td>' for header in headers) + '</tr>')
    return f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Tender Export Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 28px; color: #111827; }}
h1 {{ font-size: 22px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
th, td {{ border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }}
th {{ background: #f3f4f6; text-align: left; }}
td {{ white-space: pre-wrap; }}
</style>
</head>
<body>
<h1>Tender Export Report</h1>
<table>
<thead><tr>{''.join(f'<th>{escape(header)}</th>' for header in headers)}</tr></thead>
<tbody>{''.join(body_rows)}</tbody>
</table>
</body>
</html>'''

def build_tender_export_response(tenders,fmt,filename_base):
    rows=tender_export_rows(tenders)
    base=safe_filename(filename_base)
    if fmt=='xlsx':
        content=build_csv(rows)
        return Response(
            content,
            media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition':f'attachment; filename="{base}.csv"'},
        )
    content=build_html_report(rows)
    return Response(
        content,
        media_type='text/html; charset=utf-8',
        headers={'Content-Disposition':f'attachment; filename="{base}.html"'},
    )

def extract_pdf_text_from_url(url,timeout=25,pages=6):
    if not url:
        return '', 'none'
    try:
        response=requests.get(
            url,
            headers={
                'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept':'application/pdf,text/html,*/*',
            },
            timeout=timeout,
        )
        response.raise_for_status()
        content_type=response.headers.get('content-type','').split(';')[0].strip().lower()
        if content_type=='application/pdf' or response.content[:4]==b'%PDF':
            reader=PdfReader(io.BytesIO(response.content))
            text='\n'.join(page.extract_text() or '' for page in reader.pages[:pages])
            return text, 'pdf'
        html=response.text or ''
        text=re.sub(r'<(script|style).*?</\1>',' ',html,flags=re.I|re.S)
        text=re.sub(r'<[^>]+>',' ',text)
        return text, 'html'
    except Exception:
        return '', 'failed'

def extract_tender_eligibility(db,tender):
    documents=db.query(TenderDocument).filter(TenderDocument.tender_id==tender.id).all()
    text_parts=[]
    extracted_from='description'
    for doc in documents:
        if doc.extracted_text:
            text_parts.append(doc.extracted_text)
            extracted_from='stored_pdf_text'
        elif doc.url:
            text,source=extract_pdf_text_from_url(doc.url)
            if text:
                doc.extracted_text=text[:50000]
                doc.status='extracted'
                text_parts.append(text)
                extracted_from=source
    if not text_parts and tender.url:
        text,source=extract_pdf_text_from_url(tender.url)
        if text:
            document=db.query(TenderDocument).filter(TenderDocument.tender_id==tender.id,TenderDocument.url==tender.url).first()
            if not document:
                document=TenderDocument(tender_id=tender.id,document_type='raw_bid',url=tender.url,status='extracted')
                db.add(document)
            document.extracted_text=text[:50000]
            text_parts.append(text)
            extracted_from=source
    base_text='\n'.join([
        tender.title or '',
        tender.department or '',
        tender.description or '',
        '\n'.join(text_parts),
    ])
    data=extract_eligibility(base_text,tender)
    row=db.query(TenderEligibility).filter(TenderEligibility.tender_id==tender.id).first()
    if not row:
        row=TenderEligibility(tender_id=tender.id)
        db.add(row)
    row.emd=data.get('emd') or ''
    row.turnover_requirement=data.get('turnover_requirement') or ''
    row.experience_requirement=data.get('experience_requirement') or ''
    row.documents_required=data.get('documents_required') or ''
    row.certifications_required=data.get('certifications_required') or ''
    row.submission_deadline=data.get('submission_deadline') or ''
    row.payment_terms=data.get('payment_terms') or ''
    row.technical_specs=data.get('technical_specs') or ''
    row.risk_flags=json.dumps(data.get('risk_flags') or [])
    row.summary=data.get('summary') or ''
    row.extracted_from=extracted_from
    row.confidence=data.get('confidence') or 0
    db.commit()
    db.refresh(row)
    return row

def generate_bid_decision(db,tender):
    eligibility=db.query(TenderEligibility).filter(TenderEligibility.tender_id==tender.id).first()
    data=bid_decision_for_tender(tender,eligibility)
    row=db.query(BidDecision).filter(BidDecision.tender_id==tender.id).first()
    if not row:
        row=BidDecision(tender_id=tender.id)
        db.add(row)
    row.recommendation=data['recommendation']
    row.decision_score=data['decision_score']
    row.reasons=json.dumps(data['reasons'])
    row.blockers=json.dumps(data['blockers'])
    row.next_steps=json.dumps(data['next_steps'])
    row.confidence=data['confidence']
    db.commit()
    db.refresh(row)
    return row

def split_checklist_text(value):
    parts=[]
    for chunk in (value or '').replace(';',',').replace('|',',').split(','):
        for line in chunk.splitlines():
            cleaned=line.strip(' .:-')
            if cleaned:
                parts.append(cleaned)
    return list(dict.fromkeys(parts))

def build_document_checklist(db,tender):
    eligibility=db.query(TenderEligibility).filter(TenderEligibility.tender_id==tender.id).first()
    if not eligibility:
        eligibility=extract_tender_eligibility(db,tender)
    items=[]
    def add(title,source='standard',priority='normal'):
        title=(title or '').strip()
        if title and title.lower() not in {item['title'].lower() for item in items}:
            items.append({'title':title,'source':source,'priority':priority,'status':'pending'})
    for title in [
        'Technical bid document',
        'Financial/price bid',
        'Bid submission form',
        'GeM seller registration details',
        'Signed compliance declaration',
    ]:
        add(title,'standard','high')
    for title in split_checklist_text(eligibility.documents_required if eligibility else ''):
        add(title,'eligibility','high')
    for title in split_checklist_text(eligibility.certifications_required if eligibility else ''):
        add(title,'certification','high')
    if eligibility and eligibility.emd:
        add(f"EMD proof: {eligibility.emd}",'eligibility','high')
    if eligibility and eligibility.turnover_requirement:
        add(f"Turnover proof: {eligibility.turnover_requirement}",'eligibility','normal')
    if eligibility and eligibility.experience_requirement:
        add(f"Experience proof: {eligibility.experience_requirement}",'eligibility','normal')
    if eligibility and eligibility.technical_specs:
        add('Technical specification compliance sheet','eligibility','normal')
    if tender.url:
        add('Source bid PDF / GeM bid document','source','normal')
    return {
        'tender_id':tender.id,
        'tender_title':tender.title,
        'generated_from':'eligibility' if eligibility else 'standard',
        'total':len(items),
        'items':items,
    }

@app.get('/exports/tenders/{fmt}')
def export_all_tenders(fmt:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if fmt not in {'pdf','xlsx'}:
        raise HTTPException(404,'Unsupported export format')
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).all()
    return build_tender_export_response(tenders,fmt,'all_tenders_report')

@app.get('/tender/{tender_id}/export/{fmt}')
def export_single_tender(tender_id:int,fmt:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if fmt not in {'pdf','xlsx'}:
        raise HTTPException(404,'Unsupported export format')
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    return build_tender_export_response([tender],fmt,f'tender_{tender.id}_{tender.tender_id}')

@app.get('/tender/{tender_id}/download/raw-pdf')
def download_raw_bid_pdf(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    if not tender.url:
        raise HTTPException(404,'Tender source URL not available')

    try:
        response=requests.get(
            tender.url,
            headers={
                'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept':'application/pdf,text/html,*/*',
            },
            timeout=60,
        )
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(502,f'Could not download source bid document: {e}')

    content_type=response.headers.get('content-type','').split(';')[0].strip().lower()
    is_pdf=content_type=='application/pdf' or response.content[:4]==b'%PDF'
    ext='pdf' if is_pdf else 'html'
    media_type='application/pdf' if is_pdf else 'text/html; charset=utf-8'
    filename=f'{safe_filename(tender.tender_id or str(tender.id))}_raw_bid.{ext}'

    return Response(
        response.content,
        media_type=media_type,
        headers={'Content-Disposition':f'attachment; filename="{filename}"'},
    )

@app.get('/api/tenders/{tender_id}/eligibility')
def api_tender_eligibility(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    row=db.query(TenderEligibility).filter(TenderEligibility.tender_id==tender.id).first()
    return {'eligibility':eligibility_to_dict(row)}

@app.post('/api/tenders/{tender_id}/eligibility/extract')
def api_extract_tender_eligibility(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    row=extract_tender_eligibility(db,tender)
    return {'ok':True,'eligibility':eligibility_to_dict(row)}

@app.post('/api/eligibility/extract')
def api_extract_all_eligibility(limit:int=50,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    limit=max(1,min(200,limit))
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(limit).all()
    extracted=0
    failed=0
    for tender in tenders:
        try:
            extract_tender_eligibility(db,tender)
            extracted+=1
        except Exception:
            db.rollback()
            failed+=1
    return {'ok':True,'extracted':extracted,'failed':failed}

@app.get('/api/tenders/{tender_id}/bid-decision')
def api_tender_bid_decision(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    row=db.query(BidDecision).filter(BidDecision.tender_id==tender.id).first()
    return {'bid_decision':bid_decision_to_dict(row)}

@app.get('/api/tenders/{tender_id}/document-checklist')
def api_tender_document_checklist(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    return {'checklist':build_document_checklist(db,tender)}

@app.post('/api/tenders/{tender_id}/document-checklist/generate')
def api_generate_tender_document_checklist(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    return {'ok':True,'checklist':build_document_checklist(db,tender)}

@app.post('/api/tenders/{tender_id}/bid-decision/generate')
def api_generate_tender_bid_decision(tender_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    row=generate_bid_decision(db,tender)
    return {'ok':True,'bid_decision':bid_decision_to_dict(row)}

@app.post('/api/bid-decisions/generate')
def api_generate_all_bid_decisions(limit:int=100,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    limit=max(1,min(300,limit))
    tenders=user_tenders(db,user).order_by(Tender.created_at.desc()).limit(limit).all()
    generated=0
    failed=0
    for tender in tenders:
        try:
            generate_bid_decision(db,tender)
            generated+=1
        except Exception:
            db.rollback()
            failed+=1
    return {'ok':True,'generated':generated,'failed':failed}

def run_scrape_pipeline(db):
    return run_gem_job()

def run_scrape_subprocess(user_id,trigger='manual'):
    try:
        env=os.environ.copy()
        env['MANUAL_SCRAPE_USER_ID']=str(user_id)
        env['MANUAL_SCRAPE_TRIGGER']=trigger
        result=subprocess.run(
            [sys.executable,'-m','app.scraper.gem_job'],
            cwd=str(Path(__file__).resolve().parent.parent),
            capture_output=True,
            text=True,
            timeout=150,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return {
            'inserted':0,
            'scored':0,
            'alerts_sent':0,
            'emails_sent':0,
            'removed_low_priority':0,
            'failed_sources':['GeM'],
            'source_logs':[{'source':'GeM','status':'failed','message':'Manual scrape timed out after 2.5 minutes. Try fewer active keywords or disable high-priority-only mode temporarily.'}],
        }
    except Exception as e:
        return {
            'inserted':0,
            'scored':0,
            'alerts_sent':0,
            'emails_sent':0,
            'removed_low_priority':0,
            'failed_sources':['GeM'],
            'source_logs':[{'source':'GeM','status':'failed','message':f'Could not start scrape process: {e}'}],
        }
    if result.returncode != 0:
        message=(result.stderr or result.stdout or 'GeM scrape process failed').strip()
        return {
            'inserted':0,
            'scored':0,
            'alerts_sent':0,
            'emails_sent':0,
            'failed_sources':['GeM'],
            'source_logs':[{'source':'GeM','status':'failed','message':message}],
        }
    try:
        return json.loads(result.stdout.strip().splitlines()[-1])
    except Exception as e:
        return {
            'inserted':0,
            'scored':0,
            'alerts_sent':0,
            'emails_sent':0,
            'failed_sources':['GeM'],
            'source_logs':[{'source':'GeM','status':'failed','message':f'Could not parse scrape result: {e}. Output: {result.stdout}'}],
        }

def get_setting(db,user_id,key,default=None):
    item=db.query(AppSetting).filter(AppSetting.user_id==user_id,AppSetting.key==key).first()
    return item.value if item else default

def set_setting(db,user_id,key,value):
    item=db.query(AppSetting).filter(AppSetting.user_id==user_id,AppSetting.key==key).first()
    if item:
        item.value=value
    else:
        item=AppSetting(user_id=user_id,key=key,value=value)
        db.add(item)
    db.commit()
    db.refresh(item)
    return item

def get_json_setting(db,user_id,key,default=None):
    raw=get_setting(db,user_id,key,None)
    if raw is None:
        return default if default is not None else []
    try:
        value=json.loads(raw)
    except Exception:
        return default if default is not None else []
    return value if isinstance(value,list) else (default if default is not None else [])

def clean_alert_terms(values):
    if isinstance(values,str):
        raw=[]
        for chunk in values.replace('\n',',').replace(';',',').split(','):
            raw.append(chunk)
    elif isinstance(values,list):
        raw=values
    else:
        raw=[]
    cleaned=[]
    for item in raw:
        value=str(item).strip().lower()
        value=re.sub(r'\s+',' ',value)
        if value and len(value)<=120:
            cleaned.append(value)
    return list(dict.fromkeys(cleaned))[:50]

DEFAULT_GEM_CATEGORIES=[
    'automation','computer','hardware','iot','medical equipment','network','security','sensor','software','water purification'
]

def gem_alert_select_options(db,user):
    saved_categories=get_json_setting(db,user.id,'gem_alert_categories',[])
    saved_companies=get_json_setting(db,user.id,'gem_alert_companies',[])
    tenders=user_tenders(db,user).all()
    gem_tenders=[t for t in tenders if 'gem' in (t.source or '').lower()]

    categories=set(saved_categories)
    departments=set(saved_companies)
    for tender in gem_tenders:
        if tender.category and tender.category.strip():
            categories.add(tender.category.strip().lower())
        if tender.department and tender.department.strip():
            departments.add(tender.department.strip().lower())

    categories.update(DEFAULT_GEM_CATEGORIES)
    company_department_options=sorted(
        {value for value in departments.union(saved_companies) if value},
        key=lambda value:value.lower()
    )
    return {
        'categories':sorted({value for value in categories if value},key=lambda value:value.lower())[:250],
        'company_departments':company_department_options[:250],
        'source':'saved_gem_tenders',
    }

@app.post("/scrape-now")
def scrape_now(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result=run_scrape_subprocess(user.id)
    except Exception as e:
        result={
            'inserted':0,
            'scored':0,
            'alerts_sent':0,
            'emails_sent':0,
            'removed_low_priority':0,
            'failed_sources':['GeM'],
            'source_logs':[{'source':'GeM','status':'failed','message':f'Manual scrape failed before the scraper could start: {e}'}],
        }

    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if not wants_json and request.headers.get("content-type", "").startswith("application/x-www-form-urlencoded"):
        return RedirectResponse(url="/dashboard/admin", status_code=303)

    return result

@app.post('/api/scrape-now')
def api_scrape_now(user:User=Depends(get_current_user)):
    return run_scrape_subprocess(user.id)

@app.post('/admin/settings/only-high-priority')
def set_only_high_priority(request:Request,enabled:str=Form('false'),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    value='true' if enabled == 'true' else 'false'
    item=set_setting(db,user.id,'only_high_priority_scrape',value)
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'key':item.key,'value':item.value,'enabled':item.value=='true'}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/api/admin/settings/only-high-priority')
async def api_set_only_high_priority(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    value='true' if payload.get('enabled') else 'false'
    item=set_setting(db,user.id,'only_high_priority_scrape',value)
    return {'key':item.key,'value':item.value,'enabled':item.value=='true'}

@app.post('/admin/settings/location')
async def set_scrape_location(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    form=await request.form()
    clean_states=[
        state.strip()
        for state in form.getlist('states')
        if state.strip() in INDIAN_STATES
    ]
    clean_city=(form.get('city') or '').strip()
    clean_states=list(dict.fromkeys(clean_states))
    set_setting(db,user.id,'scrape_states',json.dumps(clean_states))
    set_setting(db,user.id,'scrape_state',clean_states[0] if len(clean_states)==1 else '')
    set_setting(db,user.id,'scrape_city',clean_city)
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'states':clean_states,'city':clean_city}
    return RedirectResponse('/dashboard/admin/settings',303)

@app.post('/api/admin/settings/location')
async def api_set_scrape_location(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    states=payload.get('states') or []
    clean_states=[state.strip() for state in states if isinstance(state,str) and state.strip() in INDIAN_STATES]
    clean_city=(payload.get('city') or '').strip()
    clean_states=list(dict.fromkeys(clean_states))
    set_setting(db,user.id,'scrape_states',json.dumps(clean_states))
    set_setting(db,user.id,'scrape_state',clean_states[0] if len(clean_states)==1 else '')
    set_setting(db,user.id,'scrape_city',clean_city)
    return {'states':clean_states,'city':clean_city}

@app.post('/admin/settings/auto-scrape')
async def set_auto_scrape(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    form=await request.form()
    enabled='true' if form.get('enabled') == 'true' else 'false'
    mode=form.get('mode') if form.get('mode') in {'interval','daily'} else 'interval'
    try:
        interval_hours=max(1,min(168,int(form.get('interval_hours') or '6')))
    except ValueError:
        interval_hours=6
    scrape_time=(form.get('scrape_time') or '09:00').strip()
    if not re.match(r'^\d{2}:\d{2}$',scrape_time):
        scrape_time='09:00'
    hour,minute=[int(part) for part in scrape_time.split(':')]
    if hour > 23 or minute > 59:
        scrape_time='09:00'

    set_setting(db,user.id,'auto_scrape_enabled',enabled)
    set_setting(db,user.id,'auto_scrape_mode',mode)
    set_setting(db,user.id,'auto_scrape_interval_hours',str(interval_hours))
    set_setting(db,user.id,'auto_scrape_time',scrape_time)

    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {
            'enabled':enabled == 'true',
            'mode':mode,
            'interval_hours':interval_hours,
            'scrape_time':scrape_time,
        }
    return RedirectResponse('/dashboard/admin/settings',303)

@app.post('/api/admin/settings/auto-scrape')
async def api_set_auto_scrape(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    enabled='true' if payload.get('enabled') else 'false'
    mode=payload.get('mode') if payload.get('mode') in {'interval','daily'} else 'interval'
    try:
        interval_hours=max(1,min(168,int(payload.get('interval_hours') or '6')))
    except (TypeError,ValueError):
        interval_hours=6
    scrape_time=(payload.get('scrape_time') or '09:00').strip()
    if not re.match(r'^\d{2}:\d{2}$',scrape_time):
        scrape_time='09:00'
    hour,minute=[int(part) for part in scrape_time.split(':')]
    if hour > 23 or minute > 59:
        scrape_time='09:00'

    set_setting(db,user.id,'auto_scrape_enabled',enabled)
    set_setting(db,user.id,'auto_scrape_mode',mode)
    set_setting(db,user.id,'auto_scrape_interval_hours',str(interval_hours))
    set_setting(db,user.id,'auto_scrape_time',scrape_time)
    return {'enabled':enabled == 'true','mode':mode,'interval_hours':interval_hours,'scrape_time':scrape_time}

@app.post('/api/admin/settings/daily-digest')
async def api_set_daily_digest(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    enabled='true' if payload.get('enabled') else 'false'
    digest_time=(payload.get('time') or '09:00').strip()
    if not re.match(r'^\d{2}:\d{2}$',digest_time):
        digest_time='09:00'
    hour,minute=[int(part) for part in digest_time.split(':')]
    if hour > 23 or minute > 59:
        digest_time='09:00'
    try:
        min_score=max(0,min(100,int(payload.get('min_score') or '70')))
    except (TypeError,ValueError):
        min_score=70
    set_setting(db,user.id,'daily_digest_enabled',enabled)
    set_setting(db,user.id,'daily_digest_time',digest_time)
    set_setting(db,user.id,'daily_digest_min_score',str(min_score))
    return {'enabled':enabled=='true','time':digest_time,'min_score':min_score}

@app.post('/api/daily-digest/send-now')
def api_send_daily_digest_now(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    try:
        min_score=max(0,min(100,int(get_setting(db,user.id,'daily_digest_min_score','70') or '70')))
    except ValueError:
        min_score=70
    result=send_daily_digest(db,user.id,min_score=min_score)
    set_setting(db,user.id,'daily_digest_last_run',datetime.now().isoformat(timespec='seconds'))
    return {'ok':True,**result}

@app.get('/api/admin/gem-alerts')
def api_get_gem_alerts(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return {
        'enabled':get_setting(db,user.id,'gem_alert_enabled','false')=='true',
        'categories':get_json_setting(db,user.id,'gem_alert_categories',[]),
        'companies':get_json_setting(db,user.id,'gem_alert_companies',[]),
        'options':gem_alert_select_options(db,user),
        'schedules':['06:00','18:00'],
        'last_6am':get_setting(db,user.id,'gem_alert_last_run_0600',''),
        'last_6pm':get_setting(db,user.id,'gem_alert_last_run_1800',''),
        'telegram_enabled':get_notification_preference(db,user.id,'telegram').enabled,
        'email_enabled':get_notification_preference(db,user.id,'email').enabled,
    }

@app.get('/api/admin/gem-alert-options')
def api_gem_alert_options(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return gem_alert_select_options(db,user)

@app.post('/api/admin/gem-alerts')
async def api_save_gem_alerts(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    enabled='true' if payload.get('enabled') else 'false'
    categories=clean_alert_terms(payload.get('categories') or [])
    companies=clean_alert_terms(payload.get('companies') or [])
    set_setting(db,user.id,'gem_alert_enabled',enabled)
    set_setting(db,user.id,'gem_alert_categories',json.dumps(categories))
    set_setting(db,user.id,'gem_alert_companies',json.dumps(companies))
    return {
        'enabled':enabled=='true',
        'categories':categories,
        'companies':companies,
        'options':gem_alert_select_options(db,user),
        'schedules':['06:00','18:00'],
    }

@app.post('/api/admin/gem-alerts/run-now')
def api_run_gem_alert_now(user:User=Depends(get_current_user)):
    return run_scrape_subprocess(user.id,trigger='gem_alert_manual')


@app.post('/admin/keywords')
def add_keyword(request:Request,keyword:str=Form(...),profile:str=Form('Custom'),synonyms:str=Form(''),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    cleaned=keyword.strip().lower()
    cleaned_profile=profile.strip() if profile.strip() in KEYWORD_PROFILES else 'Custom'
    cleaned_synonyms=json.dumps([item.strip().lower() for item in synonyms.split(',') if item.strip()])
    item=None
    if cleaned:
        existing=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.keyword==cleaned).first()
        if existing:
            existing.is_active=True
            existing.profile=cleaned_profile
            existing.synonyms=cleaned_synonyms
            item=existing
        else:
            item=ScrapeKeyword(user_id=user.id,keyword=cleaned,profile=cleaned_profile,synonyms=cleaned_synonyms,is_active=True)
            db.add(item)
        db.commit()
        db.refresh(item)
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        if not item:
            raise HTTPException(400,'Keyword is required')
        return {'id':item.id,'keyword':item.keyword,'profile':item.profile,'synonyms':', '.join(expand_keyword('', synonyms=item.synonyms)),'is_active':item.is_active}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/admin/keywords/{keyword_id}/toggle')
def toggle_keyword(request:Request,keyword_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.id==keyword_id).first()
    if not item:
        raise HTTPException(404,'Keyword not found')
    item.is_active=not item.is_active
    db.commit()
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'id':item.id,'keyword':item.keyword,'profile':item.profile,'synonyms':', '.join(expand_keyword('', synonyms=item.synonyms)),'is_active':item.is_active}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/admin/keywords/{keyword_id}/delete')
def delete_keyword(request:Request,keyword_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.id==keyword_id).first()
    if not item:
        raise HTTPException(404,'Keyword not found')
    db.delete(item)
    db.commit()
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'deleted':keyword_id}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/api/admin/keywords')
async def api_add_keyword(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    cleaned=(payload.get('keyword') or '').strip().lower()
    cleaned_profile=(payload.get('profile') or 'Custom').strip()
    if cleaned_profile not in KEYWORD_PROFILES:
        cleaned_profile='Custom'
    synonyms=payload.get('synonyms') or []
    if isinstance(synonyms,str):
        synonyms=[item.strip().lower() for item in synonyms.split(',') if item.strip()]
    else:
        synonyms=[str(item).strip().lower() for item in synonyms if str(item).strip()]
    if not cleaned:
        raise HTTPException(400,'Keyword is required')
    item=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.keyword==cleaned).first()
    if item:
        item.is_active=True
        item.profile=cleaned_profile
        item.synonyms=json.dumps(synonyms)
    else:
        item=ScrapeKeyword(user_id=user.id,keyword=cleaned,profile=cleaned_profile,synonyms=json.dumps(synonyms),is_active=True)
        db.add(item)
    db.commit()
    db.refresh(item)
    return keyword_to_dict(item)

@app.post('/api/admin/keywords/{keyword_id}/toggle')
def api_toggle_keyword(keyword_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.id==keyword_id).first()
    if not item:
        raise HTTPException(404,'Keyword not found')
    item.is_active=not item.is_active
    db.commit()
    db.refresh(item)
    return keyword_to_dict(item)

@app.delete('/api/admin/keywords/{keyword_id}')
def api_delete_keyword(keyword_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id==user.id,ScrapeKeyword.id==keyword_id).first()
    if not item:
        raise HTTPException(404,'Keyword not found')
    db.delete(item)
    db.commit()
    return {'deleted':keyword_id}

@app.post('/admin/scoring-criteria')
def add_scoring_criterion(request:Request,keyword:str=Form(...),weight:int=Form(...),match_type:str=Form('positive'),profile:str=Form('Custom'),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    cleaned=keyword.strip().lower()
    if not cleaned:
        raise HTTPException(400,'Keyword is required')
    match_type='negative' if match_type == 'negative' else 'positive'
    cleaned_profile=profile.strip() if profile.strip() in KEYWORD_PROFILES or profile.strip() == 'Negative' else 'Custom'
    weight=max(0,min(60,weight))
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.keyword==cleaned).first()
    if item:
        item.weight=weight
        item.match_type=match_type
        item.profile=cleaned_profile
        item.is_active=True
    else:
        item=ScoringCriterion(user_id=user.id,keyword=cleaned,weight=weight,match_type=match_type,profile=cleaned_profile,is_active=True)
        db.add(item)
    db.commit()
    db.refresh(item)
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'id':item.id,'keyword':item.keyword,'weight':item.weight,'match_type':item.match_type,'profile':item.profile,'is_active':item.is_active}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/admin/scoring-criteria/install-defaults')
def install_default_scoring(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    added=0
    updated=0
    for keyword,weight,match_type,profile in DEFAULT_CRITERIA:
        item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.keyword==keyword).first()
        if item:
            item.weight=weight
            item.match_type=match_type
            item.profile=profile
            item.is_active=True
            updated+=1
        else:
            db.add(ScoringCriterion(user_id=user.id,keyword=keyword,weight=weight,match_type=match_type,profile=profile,is_active=True))
            added+=1
    db.commit()
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'added':added,'updated':updated}
    return RedirectResponse('/dashboard/admin/scoring',303)

@app.post('/admin/scoring-criteria/{criterion_id}/toggle')
def toggle_scoring_criterion(request:Request,criterion_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.id==criterion_id).first()
    if not item:
        raise HTTPException(404,'Scoring criterion not found')
    item.is_active=not item.is_active
    db.commit()
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'id':item.id,'keyword':item.keyword,'weight':item.weight,'match_type':item.match_type,'profile':item.profile,'is_active':item.is_active}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/admin/scoring-criteria/{criterion_id}/delete')
def delete_scoring_criterion(request:Request,criterion_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.id==criterion_id).first()
    if not item:
        raise HTTPException(404,'Scoring criterion not found')
    db.delete(item)
    db.commit()
    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if wants_json:
        return {'deleted':criterion_id}
    return RedirectResponse('/dashboard/admin',303)

@app.post('/api/admin/scoring-criteria')
async def api_add_scoring_criterion(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    cleaned=(payload.get('keyword') or '').strip().lower()
    if not cleaned:
        raise HTTPException(400,'Keyword is required')
    match_type='negative' if payload.get('match_type') == 'negative' else 'positive'
    cleaned_profile=(payload.get('profile') or 'Custom').strip()
    if cleaned_profile not in KEYWORD_PROFILES and cleaned_profile != 'Negative':
        cleaned_profile='Custom'
    try:
        weight=int(payload.get('weight') or 0)
    except (TypeError,ValueError):
        weight=0
    weight=max(0,min(60,weight))
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.keyword==cleaned).first()
    if item:
        item.weight=weight
        item.match_type=match_type
        item.profile=cleaned_profile
        item.is_active=True
    else:
        item=ScoringCriterion(user_id=user.id,keyword=cleaned,weight=weight,match_type=match_type,profile=cleaned_profile,is_active=True)
        db.add(item)
    db.commit()
    db.refresh(item)
    return scoring_to_dict(item)

@app.post('/api/admin/scoring-criteria/install-defaults')
def api_install_default_scoring(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    added=0
    updated=0
    for keyword,weight,match_type,profile in DEFAULT_CRITERIA:
        item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.keyword==keyword).first()
        if item:
            item.weight=weight
            item.match_type=match_type
            item.profile=profile
            item.is_active=True
            updated+=1
        else:
            db.add(ScoringCriterion(user_id=user.id,keyword=keyword,weight=weight,match_type=match_type,profile=profile,is_active=True))
            added+=1
    db.commit()
    return {'added':added,'updated':updated}

@app.post('/api/admin/scoring-criteria/{criterion_id}/toggle')
def api_toggle_scoring_criterion(criterion_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.id==criterion_id).first()
    if not item:
        raise HTTPException(404,'Scoring criterion not found')
    item.is_active=not item.is_active
    db.commit()
    db.refresh(item)
    return scoring_to_dict(item)

@app.delete('/api/admin/scoring-criteria/{criterion_id}')
def api_delete_scoring_criterion(criterion_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.query(ScoringCriterion).filter(ScoringCriterion.user_id==user.id,ScoringCriterion.id==criterion_id).first()
    if not item:
        raise HTTPException(404,'Scoring criterion not found')
    db.delete(item)
    db.commit()
    return {'deleted':criterion_id}

@app.post('/admin/delete-tenders')
def delete_tenders(confirm:str=Form(...),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if confirm.strip()!='DELETE ALL TENDERS':
        raise HTTPException(400,'Confirmation text did not match')
    user_tender_ids=[row.id for row in user_tenders(db,user).all()]
    deleted_tracking=0
    deleted_documents=0
    deleted_notifications=0
    deleted_eligibility=0
    deleted_bid_decisions=0
    deleted_performance=0
    if user_tender_ids:
        deleted_bid_decisions=db.query(BidDecision).filter(BidDecision.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_eligibility=db.query(TenderEligibility).filter(TenderEligibility.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_documents=db.query(TenderDocument).filter(TenderDocument.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_notifications=db.query(NotificationLog).filter(NotificationLog.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_tracking=db.query(TenderTracking).filter(TenderTracking.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
    deleted_performance=db.query(KeywordPerformance).filter(KeywordPerformance.user_id==user.id).delete(synchronize_session=False)
    deleted_tenders=user_tenders(db,user).delete(synchronize_session=False)
    deleted_logs=db.query(ScrapingLog).filter(ScrapingLog.user_id==user.id).delete(synchronize_session=False)
    deleted_runs=db.query(ScrapeRun).filter(ScrapeRun.user_id==user.id).delete(synchronize_session=False)
    deleted_jobs=db.query(ScrapeJob).filter(ScrapeJob.user_id==user.id).delete(synchronize_session=False)
    db.commit()
    return {
        'deleted_tracking':deleted_tracking,
        'deleted_documents':deleted_documents,
        'deleted_notifications':deleted_notifications,
        'deleted_eligibility':deleted_eligibility,
        'deleted_bid_decisions':deleted_bid_decisions,
        'deleted_performance':deleted_performance,
        'deleted_tenders':deleted_tenders,
        'deleted_logs':deleted_logs,
        'deleted_runs':deleted_runs,
        'deleted_jobs':deleted_jobs,
    }

@app.post('/api/admin/delete-tenders')
async def api_delete_tenders(request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    if (payload.get('confirm') or '').strip()!='DELETE ALL TENDERS':
        raise HTTPException(400,'Confirmation text did not match')
    user_tender_ids=[row.id for row in user_tenders(db,user).all()]
    deleted_tracking=0
    deleted_documents=0
    deleted_notifications=0
    deleted_eligibility=0
    deleted_bid_decisions=0
    deleted_performance=0
    if user_tender_ids:
        deleted_bid_decisions=db.query(BidDecision).filter(BidDecision.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_eligibility=db.query(TenderEligibility).filter(TenderEligibility.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_documents=db.query(TenderDocument).filter(TenderDocument.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_notifications=db.query(NotificationLog).filter(NotificationLog.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
        deleted_tracking=db.query(TenderTracking).filter(TenderTracking.tender_id.in_(user_tender_ids)).delete(synchronize_session=False)
    deleted_performance=db.query(KeywordPerformance).filter(KeywordPerformance.user_id==user.id).delete(synchronize_session=False)
    deleted_tenders=user_tenders(db,user).delete(synchronize_session=False)
    deleted_logs=db.query(ScrapingLog).filter(ScrapingLog.user_id==user.id).delete(synchronize_session=False)
    deleted_runs=db.query(ScrapeRun).filter(ScrapeRun.user_id==user.id).delete(synchronize_session=False)
    deleted_jobs=db.query(ScrapeJob).filter(ScrapeJob.user_id==user.id).delete(synchronize_session=False)
    db.commit()
    return {
        'deleted_tracking':deleted_tracking,
        'deleted_documents':deleted_documents,
        'deleted_notifications':deleted_notifications,
        'deleted_eligibility':deleted_eligibility,
        'deleted_bid_decisions':deleted_bid_decisions,
        'deleted_performance':deleted_performance,
        'deleted_tenders':deleted_tenders,
        'deleted_logs':deleted_logs,
        'deleted_runs':deleted_runs,
        'deleted_jobs':deleted_jobs,
    }
@app.post("/rescore")
def rescore(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = rescore_all_tenders(db,user.id)

    wants_json='application/json' in request.headers.get('accept','') or request.headers.get('x-requested-with')=='fetch'
    if not wants_json and request.headers.get("content-type", "").startswith("application/x-www-form-urlencoded"):
        return RedirectResponse(url="/dashboard/admin", status_code=303)

    return {"rescored": count}

@app.post('/api/rescore')
def api_rescore(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return {'rescored':rescore_all_tenders(db,user.id)}

@app.post('/api/tracking/update-now')
def api_update_tracking_now(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return update_tender_statuses(db,user.id)

@app.get('/tracking')
def tracking(db:Session=Depends(get_db),user:User=Depends(get_current_user)): return user_tracking(db,user).all()
@app.post('/tender/{tender_id}/status')
def update_status(tender_id:int,status:str=Form(...),remarks:str=Form(''),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender: raise HTTPException(404,'Tender not found')
    tender.status=status; tr=db.query(TenderTracking).filter(TenderTracking.tender_id==tender.id).first()
    if tr: tr.remarks=remarks
    db.commit(); return RedirectResponse('/dashboard',303)

@app.post('/api/tenders/{tender_id}/status')
async def api_update_status(tender_id:int,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    payload=await request.json()
    tender=user_tenders(db,user).filter(Tender.id==tender_id).first()
    if not tender:
        raise HTTPException(404,'Tender not found')
    tender.status=(payload.get('status') or tender.status or 'new').strip()
    tr=db.query(TenderTracking).filter(TenderTracking.tender_id==tender.id).first()
    if tr:
        tr.remarks=(payload.get('remarks') or '').strip()
    db.commit()
    db.refresh(tender)
    return tender_to_dict(tender)
def init_db(): ensure_schema_updates(); print('Database tables created.')
def scrape_once():
    db=next(get_db())
    try: print(run_scrape_pipeline(db))
    finally: db.close()
if __name__=='__main__':
    cmd=sys.argv[1] if len(sys.argv)>1 else None
    if cmd=='init-db': init_db()
    elif cmd=='scrape': scrape_once()
    elif cmd=='scheduler': start_scheduler()
    else: print('python -m app.main init-db | scrape | scheduler')
