import unittest,tempfile,threading,urllib.request,urllib.error,json,os,sqlite3,io,csv
import server
class API(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();server.DB=cls.tmp.name+'/db';server.SECRET='x'*32;server.ADMIN='a'*32;server.ORIGIN='https://store1.test';server.init();cls.http=server.HTTPServer(('127.0.0.1',0),server.Handler);cls.url='http://127.0.0.1:'+str(cls.http.server_port);threading.Thread(target=cls.http.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
 def setUp(self):
  with server.connect() as c:c.execute('DELETE FROM limits')
 def request(self,path,p=None,origin=True,admin=False):
  h={};data=None
  if p is not None:data=json.dumps(p).encode();h['Content-Type']='application/json'
  if origin:h['Origin']=server.ORIGIN
  if admin:h['Authorization']='Bearer '+server.ADMIN
  try:r=urllib.request.urlopen(urllib.request.Request(self.url+path,data,headers=h));return r.status,r.read().decode()
  except urllib.error.HTTPError as e:return e.code,e.read().decode()
 def payload(self,lang='en',kind='home'):
  import uuid
  return dict(submission_id=str(uuid.uuid4()),name='=formula',email=str(uuid.uuid4())+'@example.com',country='Singapore',quantity='1',customer_type=kind,language=lang,consent=True,source_page='/'+lang+'/pages/contact/',source_cta='QM1-'+lang+'-clinic-1',source_reference='QM-CONTACT',utm={'utm_source':'linkedin','utm_campaign':'october'},notes='test')
 def test_01_languages_and_types(self):
  for lang in server.LANGS:
   for kind in ['home','clinic','distributor']:
    p=self.payload(lang,kind);code,res=self.request('/v1/leads',p);self.assertEqual(code,201);lid=json.loads(res)['lead_id']
    with server.connect() as c:d=json.loads(c.execute('SELECT data FROM leads WHERE id=?',(lid,)).fetchone()[0]);self.assertEqual(d['source_cta'],p['source_cta']);self.assertEqual(d['utm'],p['utm'])
 def test_02_dedupe_and_conflict(self):
  p=self.payload();a=json.loads(self.request('/v1/leads',p)[1]);code,b=self.request('/v1/leads',p);self.assertEqual(code,200);self.assertEqual(json.loads(b)['lead_id'],a['lead_id']);p['submission_id']='new-submission-id-1234';self.assertEqual(self.request('/v1/leads',p)[0],200);p['name']='changed';p['submission_id']=self.payload()['submission_id'];self.assertEqual(self.request('/v1/leads',p)[0],201);p['name']='again';self.assertEqual(self.request('/v1/leads',p)[0],409)
 def test_03_reject(self):
  for k,v in [('consent',False),('website','bot'),('email','bad'),('quantity','0'),('notes','a'*2001),('source_page','/page?email=pii')]:
   p=self.payload();p[k]=v;self.assertEqual(self.request('/v1/leads',p)[0],422)
  self.assertEqual(self.request('/v1/leads',self.payload(),origin=False)[0],403)
 def test_04_export(self):
  self.assertEqual(self.request('/v1/export.csv',admin=False)[0],401);code,s=self.request('/v1/export.csv',admin=True);self.assertEqual(code,200);self.assertIn("'=formula",s);self.assertIn('submitted_utc',s)
 def test_05_events(self):
  p={'id':'event-unique-12345678','consent':True,'event':'page_view','source_page':'/en/pages/contact/','language':'en'};self.assertEqual(self.request('/v1/events',p)[0],202);self.assertEqual(self.request('/v1/events',p)[0],202);code,s=self.request('/v1/summary',admin=True);self.assertEqual(json.loads(s)['pages'][p['source_page']]['page_view'],1)
 def test_06_storage_failure(self):
  previous=server.DB;server.DB=self.tmp.name+'/missing/db';self.assertEqual(self.request('/v1/leads',self.payload())[0],503);server.DB=previous
 def test_07_notification_failure_retained(self):
  self.assertEqual(self.request('/v1/leads',self.payload())[0],201)
  with self.assertRaises(RuntimeError):server.notify()
  with server.connect() as c:self.assertGreater(c.execute("SELECT count(*) FROM leads WHERE notification='pending'").fetchone()[0],0)
 def test_075_smtp_retry(self):
  from unittest.mock import patch
  class SMTP:
   fail=True
   def __init__(self,*a,**k):pass
   def __enter__(self):return self
   def __exit__(self,*a):pass
   def starttls(self,**k):pass
   def send_message(self,m):
    if self.fail:raise OSError('simulated')
  with patch.dict(os.environ,{'QM_SMTP_HOST':'smtp.test','QM_NOTIFY_TO':'sales@example.com','QM_SMTP_FROM':'store@example.com'}),patch.object(server.smtplib,'SMTP',SMTP):
   server.notify()
   with server.connect() as c:self.assertGreater(c.execute("SELECT count(*) FROM leads WHERE notification='failed'").fetchone()[0],0)
   SMTP.fail=False;server.notify()
   with server.connect() as c:self.assertEqual(c.execute("SELECT count(*) FROM leads WHERE notification!='smtp_accepted'").fetchone()[0],0)
 def test_08_rate_limit(self):
  with server.connect() as c:c.execute('DELETE FROM limits')
  codes=[self.request('/v1/leads',self.payload())[0] for _ in range(31)];self.assertEqual(codes[-1],429)
if __name__=='__main__':unittest.main()
