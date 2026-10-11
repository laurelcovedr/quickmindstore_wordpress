"""Store1 compatible lead API. Run behind HTTPS reverse proxy; stdlib only."""
import os,json,sqlite3,time,uuid,hashlib,hmac,re,csv,io,smtplib,ssl,argparse
from http.server import BaseHTTPRequestHandler,HTTPServer
from email.message import EmailMessage
from pathlib import Path
DB=os.environ.get('QM_LEAD_DB','/tmp/store1-leads.sqlite3')
ORIGIN=os.environ.get('QM_ORIGIN','http://localhost:8080')
ADMIN=os.environ.get('QM_ADMIN_TOKEN','')
SECRET=os.environ.get('QM_HASH_SECRET','')
LANGS=['en','zh-CN','es','fr','de','ja','ko','id']
def connect():
    c=sqlite3.connect(DB,timeout=10); c.row_factory=sqlite3.Row; return c
def init():
    Path(DB).parent.mkdir(parents=True,exist_ok=True)
    with connect() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY, key TEXT UNIQUE, fingerprint TEXT, created INTEGER, data TEXT, notification TEXT DEFAULT 'pending');
        CREATE INDEX IF NOT EXISTS dedupe ON leads(fingerprint,created);
        CREATE TABLE IF NOT EXISTS limits(hash TEXT, created INTEGER);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, created INTEGER, data TEXT);''')
    os.chmod(DB,0o600)
def digest(s):return hmac.new(SECRET.encode(),s.encode(),hashlib.sha256).hexdigest()
def clean(p):
    if not isinstance(p,dict):raise ValueError('invalid')
    if p.get('website') or p.get('consent') is not True:raise ValueError('consent_or_spam')
    d={k:str(p.get(k,'')).strip() for k in ['name','email','country','organization','quantity','notes','payment','customer_type','language','source_page','source_cta','source_reference']}
    if any(len(v)> (2000 if k=='notes' else 200) or '\x00' in v for k,v in d.items()):raise ValueError('too_long')
    d['email']=d['email'].lower()
    if not d['name'] or not d['country'] or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',d['email']):raise ValueError('contact')
    if d['customer_type'] not in ['home','clinic','distributor'] or d['language'] not in LANGS:raise ValueError('type_language')
    if not d['quantity'].isdigit() or not 1<=int(d['quantity'])<=10000:raise ValueError('quantity')
    if not d['source_page'].startswith('/') or '?' in d['source_page'] or '#' in d['source_page'] or d['source_page'].startswith('//'):raise ValueError('page')
    u=p.get('utm',{})
    if not isinstance(u,dict):raise ValueError('utm')
    d['utm']={k:re.sub(r'[^a-zA-Z0-9 _.-]','',str(u[k]))[:100] for k in ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'] if k in u}
    d['consent_version']='store1-inquiry-v1';return d
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass # never log contact data, bearer tokens or query strings
    def reply(self,status,p,kind='application/json'):
        b=(json.dumps(p,ensure_ascii=False) if kind=='application/json' else p).encode();self.send_response(status)
        for k,v in [('Content-Type',kind+'; charset=utf-8'),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Content-Length',str(len(b)))]:self.send_header(k,v)
        if self.headers.get('Origin')==ORIGIN:self.send_header('Access-Control-Allow-Origin',ORIGIN);self.send_header('Vary','Origin')
        self.end_headers();self.wfile.write(b)
    def do_OPTIONS(self):
        if self.headers.get('Origin')!=ORIGIN:return self.reply(403,{'error':'origin'})
        self.send_response(204);self.send_header('Access-Control-Allow-Origin',ORIGIN);self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Access-Control-Allow-Methods','POST, GET');self.end_headers()
    def do_POST(self):
        if self.path not in ['/v1/leads','/v1/events']:return self.reply(404,{'error':'not_found'})
        if self.headers.get('Origin')!=ORIGIN:return self.reply(403,{'error':'origin'})
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply(415,{'error':'content_type'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=16384:return self.reply(413,{'error':'size'})
            p=json.loads(self.rfile.read(size));now=int(time.time())
            if not isinstance(p,dict):raise ValueError('object')
            with connect() as c:
                c.execute('BEGIN IMMEDIATE')
                ip=digest(self.client_address[0]);c.execute('DELETE FROM limits WHERE created<?',(now-3600,))
                if c.execute('SELECT count(*) FROM limits WHERE hash=? AND created>?',(ip,now-60)).fetchone()[0]>=30:return self.reply(429,{'error':'rate_limit'})
                c.execute('INSERT INTO limits VALUES(?,?)',(ip,now));c.commit();c.execute('BEGIN IMMEDIATE')
                if self.path=='/v1/events':
                    if p.get('consent') is not True or p.get('event') not in ['page_view','inquiry_click']:raise ValueError('event')
                    page=str(p.get('source_page',''))
                    if not page.startswith('/') or len(page)>200 or '?' in page:raise ValueError('page')
                    eid=str(p.get('id',''))
                    if not re.fullmatch(r'[a-zA-Z0-9-]{16,80}',eid):raise ValueError('id')
                    data={'event':p['event'],'source_page':page,'source_cta':str(p.get('source_cta',''))[:200],'language':p.get('language') if p.get('language') in LANGS else 'en'}
                    c.execute('INSERT OR IGNORE INTO events VALUES(?,?,?)',(eid,now,json.dumps(data)));c.commit();return self.reply(202,{'ok':True})
                d=clean(p);key=str(p.get('submission_id',''))
                if not re.fullmatch(r'[a-zA-Z0-9-]{16,80}',key):raise ValueError('submission_id')
                fp=digest(json.dumps(d,sort_keys=True,ensure_ascii=False))
                row=c.execute('SELECT * FROM leads WHERE key=?',(key,)).fetchone()
                if row and row['fingerprint']!=fp:return self.reply(409,{'error':'key_conflict'})
                if not row:row=c.execute('SELECT * FROM leads WHERE fingerprint=? AND created>?',(fp,now-86400,)).fetchone()
                duplicate=bool(row)
                if row:lid=row['id']
                else:
                    lid=str(uuid.uuid4());c.execute('INSERT INTO leads(id,key,fingerprint,created,data) VALUES(?,?,?,?,?)',(lid,key,fp,now,json.dumps(d,ensure_ascii=False)))
            return self.reply(200 if duplicate else 201,{'ok':True,'lead_id':lid,'duplicate':duplicate,'stored':True,'notification':'queued'})
        except (ValueError,TypeError,json.JSONDecodeError):return self.reply(422,{'error':'validation'})
        except sqlite3.Error:return self.reply(503,{'error':'storage_unavailable'})
    def authorized(self):return bool(ADMIN) and hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+ADMIN)
    def do_GET(self):
        if self.path=='/health':return self.reply(200,{'ok':True,'mode':'api','smtp_configured':bool(os.environ.get('QM_SMTP_HOST'))})
        if self.path not in ['/v1/export.csv','/v1/summary']:return self.reply(404,{'error':'not_found'})
        if not self.authorized():return self.reply(401,{'error':'unauthorized'})
        with connect() as c:
            rows=c.execute('SELECT * FROM leads ORDER BY created DESC').fetchall()
            if self.path=='/v1/summary':
                counts={}
                for r in c.execute('SELECT data FROM events'):
                    d=json.loads(r['data']);k=d['source_page'];counts.setdefault(k,{'page_view':0,'inquiry_click':0,'leads':0});counts[k][d['event']]+=1
                for r in rows:
                    k=json.loads(r['data'])['source_page'];counts.setdefault(k,{'page_view':0,'inquiry_click':0,'leads':0});counts[k]['leads']+=1
                return self.reply(200,{'pages':counts,'note':'Consented event counts; views are not unique visitors. Leads include visitors without analytics consent; do not treat this as an unbiased conversion rate.'})
        out=io.StringIO();w=csv.writer(out);w.writerow(['id','submitted_utc','notification','name','email','country','customer_type','language','source_page','source_cta','source_reference','utm','organization','quantity','notes','consent_version'])
        for r in rows:
            d=json.loads(r['data']);vals=[r['id'],time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(r['created'])),r['notification']]+[json.dumps(d[k],ensure_ascii=False) if k=='utm' else d.get(k,'') for k in ['name','email','country','customer_type','language','source_page','source_cta','source_reference','utm','organization','quantity','notes','consent_version']]
            w.writerow(["'"+str(v) if str(v).lstrip().startswith(('=','+','-','@')) else v for v in vals])
        self.reply(200,out.getvalue(),'text/csv')
def notify():
    host=os.environ.get('QM_SMTP_HOST');recipient=os.environ.get('QM_NOTIFY_TO');sender=os.environ.get('QM_SMTP_FROM')
    if not all([host,recipient,sender]):raise RuntimeError('SMTP configuration missing; queue remains pending')
    with connect() as c:
        for r in c.execute("SELECT * FROM leads WHERE notification IN ('pending','failed')").fetchall():
            m=EmailMessage();m['From']=sender;m['To']=recipient;m['Subject']='Store1 inquiry '+r['id'];m['Message-ID']='<'+r['id']+'@store1.local>';m.set_content('New lead: '+r['id']+'\nUTC: '+str(r['created'])+'\n'+json.dumps(json.loads(r['data']),ensure_ascii=False,indent=2))
            try:
                with smtplib.SMTP(host,int(os.environ.get('QM_SMTP_PORT','587')),timeout=15) as s:
                    s.starttls(context=ssl.create_default_context())
                    if os.environ.get('QM_SMTP_USER'):s.login(os.environ['QM_SMTP_USER'],os.environ['QM_SMTP_PASSWORD'])
                    s.send_message(m)
                state='smtp_accepted' # not proof of recipient delivery
            except Exception:state='failed'
            c.execute('UPDATE leads SET notification=? WHERE id=?',(state,r['id']))
def purge(days):
    with connect() as c:
        for table in ['leads','events']:c.execute('DELETE FROM '+table+' WHERE created<?',(int(time.time())-days*86400,))
        c.execute('DELETE FROM limits')
        c.commit();c.execute('VACUUM')
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--port',type=int,default=8081);a.add_argument('--notify',action='store_true');a.add_argument('--purge-days',type=int);args=a.parse_args()
    if len(SECRET)<32 or len(ADMIN)<32:raise SystemExit('Configure QM_HASH_SECRET and QM_ADMIN_TOKEN (at least 32 chars)')
    init()
    if args.notify:notify()
    elif args.purge_days is not None:
        if args.purge_days<1:raise SystemExit('days must be positive')
        purge(args.purge_days)
    else:HTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
