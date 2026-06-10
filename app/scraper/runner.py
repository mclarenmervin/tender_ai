from sqlalchemy.exc import IntegrityError
import os
from app.database.models import KeywordPerformance,Tender,TenderDocument,TenderTracking,ScrapingLog
from app.scraper.nexizo_scraper import NexizoScraper
from app.scraper.gem_scraper import GemScraper
from app.scraper.cppp_scraper import CPPPScraper
def run_scrapers(db,scrapers,return_details=False,user_id=None,scrape_run_id=None):
    inserted=0
    details=[]
    for scraper in scrapers:
        try:
            tenders=scraper.scrape()
            source_inserted=0
            source_inserted_ids=[]
            skipped_existing=0
            performance={}
            for item in tenders:
                search_keyword=item.pop('_search_keyword','') or 'general'
                stats=performance.setdefault(search_keyword,{'fetched':0,'inserted':0,'duplicate':0,'inserted_ids':[]})
                stats['fetched']+=1
                item['user_id']=user_id
                existing=db.query(Tender).filter(Tender.user_id==user_id,Tender.source==item['source'],Tender.tender_id==item['tender_id']).first()
                if existing:
                    skipped_existing+=1
                    stats['duplicate']+=1
                    continue
                if os.getenv('SCRAPE_PDF_VALUES','false').lower()=='true' and hasattr(scraper,'enrich_item_from_pdf'):
                    item=scraper.enrich_item_from_pdf(item)
                db.add(Tender(**item))
                try:
                    db.commit(); tender=db.query(Tender).filter(Tender.user_id==user_id,Tender.source==item['source'],Tender.tender_id==item['tender_id']).first()
                    if tender and not tender.tracking: db.add(TenderTracking(tender_id=tender.id))
                    if tender and tender.url:
                        db.add(TenderDocument(tender_id=tender.id,document_type='raw_bid',url=tender.url,status='available'))
                    db.commit()
                    inserted+=1; source_inserted+=1
                    if tender:
                        source_inserted_ids.append(tender.id)
                        stats['inserted']+=1
                        stats['inserted_ids'].append(tender.id)
                except IntegrityError: db.rollback()
            for keyword,stats in performance.items():
                inserted_tenders=db.query(Tender).filter(Tender.id.in_(stats['inserted_ids'])).all() if stats['inserted_ids'] else []
                high_priority=sum(1 for tender in inserted_tenders if tender.relevance_score is not None and tender.relevance_score>=70)
                average_score=(sum(tender.relevance_score or 0 for tender in inserted_tenders)/len(inserted_tenders)) if inserted_tenders else 0
                db.add(KeywordPerformance(
                    user_id=user_id,
                    scrape_run_id=scrape_run_id,
                    keyword=keyword,
                    fetched_count=stats['fetched'],
                    inserted_count=stats['inserted'],
                    duplicate_count=stats['duplicate'],
                    high_priority_count=high_priority,
                    average_score=average_score,
                ))
            message=f'Fetched {len(tenders)} tenders, inserted {source_inserted} new tenders'
            if skipped_existing:
                message+=f', skipped {skipped_existing} already saved'
            db.add(ScrapingLog(user_id=user_id,source=scraper.source_name,status='success',message=message)); db.commit()
            details.append({'source':scraper.source_name,'status':'success','message':message,'inserted_ids':source_inserted_ids})
        except Exception as e:
            message=str(e) or repr(e)
            db.rollback(); db.add(ScrapingLog(user_id=user_id,source=scraper.source_name,status='failed',message=message)); db.commit()
            details.append({'source':scraper.source_name,'status':'failed','message':message})
    if return_details:
        return inserted,details
    return inserted

def run_gem_scraper(db,return_details=False,user_id=None,scrape_run_id=None):
    return run_scrapers(db,[GemScraper()],return_details=return_details,user_id=user_id,scrape_run_id=scrape_run_id)

def run_gem_keyword_scraper(db,keywords,return_details=False,max_bids=20,user_id=None,state=None,states=None,city=None,scrape_run_id=None):
    return run_scrapers(db,[GemScraper(keywords=keywords,max_bids=max_bids,state=state,states=states,city=city)],return_details=return_details,user_id=user_id,scrape_run_id=scrape_run_id)

def run_all_scrapers(db,return_details=False,user_id=None,scrape_run_id=None):
    return run_scrapers(db,[NexizoScraper(),GemScraper(),CPPPScraper()],return_details=return_details,user_id=user_id,scrape_run_id=scrape_run_id)
