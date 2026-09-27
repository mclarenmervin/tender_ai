import io
import json
import os
import zipfile
from unittest.mock import patch

os.environ.setdefault('DATABASE_URL', 'sqlite://')
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database.db_connection import Base
from app.database.models import User, Tender, ScrapeRun, CriterionTender
from app.alerts.criterion_reports import criterion_tenders, criterion_attachment
from app.alerts.email_alerts import notify_new_tenders_email, notify_scrape_summary_email
from app.main import api_criterion_master, normalized_scrape_profile
from fastapi import HTTPException

@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all([User(id=1, name='One', email='one@example.com', password_hash='x'), User(id=2, name='Two', email='two@example.com', password_hash='x')])
    session.add_all([Tender(id=i, user_id=1 if i < 4 else 2, source='GeM', tender_id=f'BID-{i}', title=f'Tender {i}') for i in range(1,5)])
    session.commit()
    yield session
    session.close()
    engine.dispose()

def ids(rows):
    return {row.id for row in rows}

def test_cumulative_dedup_and_user_criterion_isolation(db):
    assert ids(criterion_tenders(db,1,'a',[1,2,2,4])) == {1,2}
    assert ids(criterion_tenders(db,1,'a',[2,3])) == {1,2,3}
    assert ids(criterion_tenders(db,1,'b',[2])) == {2}
    assert ids(criterion_tenders(db,2,'a',[1,4])) == {4}
    assert db.query(CriterionTender).count() == 5

def test_backfills_only_matching_historical_runs(db):
    db.add_all([ScrapeRun(id=1,user_id=1,criteria_json=json.dumps({'profile_id':'a'})), ScrapeRun(id=2,user_id=1,criteria_json=json.dumps({'profile_id':'b'})),ScrapeRun(id=3,user_id=1,criteria_json='bad json')])
    db.get(Tender,1).scrape_run_id=1
    db.get(Tender,2).scrape_run_id=2
    db.commit()
    assert ids(criterion_tenders(db,1,'a')) == {1}

def test_workbook_stable_filename_and_all_rows(db):
    criterion_tenders(db,1,'a',[1])
    first=criterion_attachment(db,1,{'profile_id':'a'})
    criterion_tenders(db,1,'a',[2,3])
    second=criterion_attachment(db,1,{'profile_id':'a'})
    assert first['filename']==second['filename']=='criterion_a_master.xlsx'
    with zipfile.ZipFile(io.BytesIO(second['content'])) as workbook:
        xml=''.join(workbook.read(name).decode() for name in workbook.namelist() if name.endswith('.xml'))
        for bid in ['BID-1','BID-2','BID-3']:
            assert bid in xml
        assert 'BID-4' not in xml
    assert zipfile.is_zipfile(io.BytesIO(criterion_attachment(db,1,{'profile_id':'empty'})['content']))

def test_new_and_zero_new_email_both_attach_master(db):
    criterion_tenders(db,1,'a',[1,2])
    details={'profile_id':'a','profile_name':'Example','inserted':1}
    with patch('app.alerts.email_alerts.send_email', return_value=True) as send, patch('app.alerts.email_alerts.email_configured', return_value=True):
        assert notify_new_tenders_email(db,[2],1,details)==1
        attachment=send.call_args.kwargs['attachments'][0]
        assert attachment['filename']=='criterion_a_master.xlsx'
        assert notify_scrape_summary_email(db,1,{**details,'inserted':0})==1
        assert send.call_args.kwargs['attachments'][0]['filename']==attachment['filename']

def test_download_rejects_unknown_or_other_user_criterion(db):
    with pytest.raises(HTTPException) as error:
        api_criterion_master('other', db, db.get(User,1))
    assert error.value.status_code==404

def test_multivalue_normalization():
    result=normalized_scrape_profile({'keywords':['Software','software','Hardware'],'cities':['Pune','Mumbai'],'states':['Maharashtra','Odisha'],'authorities':['A','B']})
    assert result['keywords']==['Software','Hardware']
    assert len(result['cities'])==len(result['states'])==len(result['authorities'])==2

def test_create_edit_and_download_api(db):
    from fastapi.testclient import TestClient
    from app.main import app, get_db, get_current_user
    user=db.get(User,1)
    app.dependency_overrides[get_db]=lambda: db
    app.dependency_overrides[get_current_user]=lambda: user
    client=TestClient(app)
    try:
        payload={'name':'Multiple options','keywords':['software','hardware'],'states':['Odisha','Gujarat'],'cities':['Pune','Mumbai'],'authorities':['A','B'],'enabled':False}
        created=client.post('/api/admin/settings/scrape-profiles',json=payload)
        assert created.status_code==200
        profile=created.json()['profile']
        edited=client.post('/api/admin/settings/scrape-profiles',json={**profile,'name':'Updated','cities':['Pune','Mumbai','Cuttack']})
        assert edited.status_code==200
        assert edited.json()['profile']['id']==profile['id']
        assert len(edited.json()['profiles'])==1
        criterion_tenders(db,1,profile['id'],[1,2])
        exported=client.get(f"/api/admin/settings/scrape-profiles/{profile['id']}/master.xlsx")
        assert exported.status_code==200
        assert zipfile.is_zipfile(io.BytesIO(exported.content))
        app.dependency_overrides[get_current_user]=lambda: db.get(User,2)
        assert client.get(f"/api/admin/settings/scrape-profiles/{profile['id']}/master.xlsx").status_code==404
    finally:
        app.dependency_overrides.clear()

def test_scraper_records_existing_matches_for_another_criterion(db):
    from app.scraper.runner import run_scrapers
    class FakeScraper:
        source_name='GeM'
        def scrape(self):
            return [{'source':'GeM','tender_id':'BID-1','title':'Updated existing bid'}, {'source':'GeM','tender_id':'NEW-BID','title':'New bid'}]
    inserted, logs=run_scrapers(db,[FakeScraper()],return_details=True,user_id=1)
    assert inserted==1
    assert 1 in logs[0]['matched_ids']
    assert set(logs[0]['inserted_ids']).issubset(logs[0]['matched_ids'])
    assert len(criterion_tenders(db,1,'overlap',logs[0]['matched_ids']))==2
