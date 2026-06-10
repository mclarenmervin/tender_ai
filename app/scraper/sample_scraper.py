from datetime import date,timedelta
from app.scraper.base_scraper import BaseScraper
class SampleScraper(BaseScraper):
    source_name='Sample'
    def scrape(self):
        return [
            {'source':self.source_name,'tender_id':'SAMPLE-IOT-001','title':'IoT Based Smart Irrigation Automation System','department':'Water Resources Department','state':'Odisha','estimated_value':7500000,'deadline':date.today()+timedelta(days=8),'url':'https://example.com/sample-iot-001','description':'IoT smart irrigation automation telemetry SCADA monitoring system','category':'Smart Irrigation'},
            {'source':self.source_name,'tender_id':'SAMPLE-IT-002','title':'IT Infrastructure and Network Monitoring Setup','department':'Smart City Mission','state':'Odisha','estimated_value':12500000,'deadline':date.today()+timedelta(days=15),'url':'https://example.com/sample-it-002','description':'IT infrastructure sensor monitoring dashboard and network control systems','category':'IT Infrastructure'},
            {'source':self.source_name,'tender_id':'SAMPLE-CIVIL-003','title':'Civil Construction of Boundary Wall','department':'PWD','state':'Odisha','estimated_value':3500000,'deadline':date.today()+timedelta(days=20),'url':'https://example.com/sample-civil-003','description':'Civil construction and repair work','category':'Civil'},
        ]
