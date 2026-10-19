<?php
/**
 * Plugin Name: QuickMind Store1 Leads
 * Description: Staging inquiry collection. No orders or payments.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 */
if (!defined('ABSPATH')) { exit; }
final class QM_Leads {
 const LANGS = ['en','zh-CN','es','fr','de','ja','ko','id'];
 static function table() { global $wpdb; return $wpdb->prefix.'qm_leads'; }
 static function activate() {
  global $wpdb;
  require_once ABSPATH.'wp-admin/includes/upgrade.php';
  $t=self::table(); $charset=$wpdb->get_charset_collate();
  dbDelta("CREATE TABLE $t (
   id varchar(36) NOT NULL,
   submission_key varchar(80) NOT NULL,
   fingerprint char(64) NOT NULL,
   created bigint unsigned NOT NULL,
   customer_type varchar(20) NOT NULL,
   language varchar(10) NOT NULL,
   email varchar(200) NOT NULL,
   data longtext NOT NULL,
   notification varchar(20) NOT NULL DEFAULT 'pending',
   attempts int unsigned NOT NULL DEFAULT 0,
   next_attempt bigint unsigned NOT NULL DEFAULT 0,
   PRIMARY KEY  (id),
   UNIQUE KEY submission_key (submission_key),
   KEY fingerprint (fingerprint),
   KEY created (created)
  ) ENGINE=InnoDB $charset;");
  if (!wp_next_scheduled('qm_leads_worker')) wp_schedule_event(time()+60,'hourly','qm_leads_worker');
 }
 static function enabled() { return wp_get_environment_type()==='staging'; }
 static function error($code,$status=422) { return new WP_Error($code,$code,['status'=>$status]); }
 static function clean($p) {
  if (!is_array($p) || ($p['consent']??null)!==true || !empty($p['website'])) return self::error('consent_or_spam');
  $d=[];
  foreach (['name','email','country','organization','quantity','notes','payment','customer_type','language','source_page','source_cta','source_reference'] as $k) {
   $v=$p[$k]??'';
   if (!is_string($v) || strlen($v)>($k==='notes'?8000:800) || str_contains($v,"\0")) return self::error('invalid_field');
   $d[$k]= $k==='notes'?sanitize_textarea_field($v):sanitize_text_field($v);
  }
  $d['email']=strtolower($d['email']);
  if (!$d['name'] || !$d['country'] || !is_email($d['email']) || strlen($d['email'])>200) return self::error('contact');
  if (!in_array($d['language'],self::LANGS,true) || !in_array($d['customer_type'],['home','clinic','distributor'],true)) return self::error('type_language');
  if (!ctype_digit($d['quantity']) || (int)$d['quantity']<1 || (int)$d['quantity']>10000) return self::error('quantity');
  if (!str_starts_with($d['source_page'],'/') || str_starts_with($d['source_page'],'//') || strpbrk($d['source_page'],'?#')!==false) return self::error('page');
  if (!preg_match('/^[a-zA-Z0-9-]{16,80}$/',$p['submission_id']??'')) return self::error('submission_id');
  if (isset($p['utm']) && !is_array($p['utm'])) return self::error('utm');
  $d['utm']=[];
  foreach (['utm_source','utm_medium','utm_campaign','utm_content','utm_term'] as $k) {
   if (isset($p['utm'][$k])) {
    if (!is_string($p['utm'][$k])) return self::error('utm');
    $d['utm'][$k]=substr(preg_replace('/[^a-zA-Z0-9 _.-]/','',$p['utm'][$k]),0,100);
   }
  }
  $d['consent_version']='store1-inquiry-v1'; return $d;
 }
 static function permission($r) {
  if (!self::enabled()) return self::error('staging_only',503);
  $origin=$r->get_header('origin');
  $expected=wp_parse_url(home_url('/'),PHP_URL_SCHEME).'://'.wp_parse_url(home_url('/'),PHP_URL_HOST);
  $port=wp_parse_url(home_url('/'),PHP_URL_PORT); if ($port) $expected.=':'.$port;
  if ($origin!==$expected) return self::error('origin',403);
  if (!str_starts_with(strtolower($r->get_header('content-type')),'application/json')) return self::error('content_type',415);
  if (strlen($r->get_body())>16384) return self::error('size',413);
  return true;
 }
 static function receive($r) {
  global $wpdb; $t=self::table(); $now=time();
  // Database advisory lock serializes rate checks, idempotency and exact-payload dedupe.
  $lock='qm_'.substr(hash('sha256',DB_NAME.$t),0,40);
  if ((string)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)',$lock))!=='1') return self::error('storage_busy',503);
  try {
   $ip=hash_hmac('sha256',$_SERVER['REMOTE_ADDR']??'unknown',wp_salt('auth'));
   $rate='qm_rate_'.substr($ip,0,40); $count=(int)get_transient($rate);
   if ($count>=30) return self::error('rate_limit',429);
   set_transient($rate,$count+1,MINUTE_IN_SECONDS);
   $p=$r->get_json_params(); $d=self::clean($p); if (is_wp_error($d)) return $d;
   $key=$p['submission_id']; $fp=hash_hmac('sha256',wp_json_encode($d),wp_salt('auth'));
   $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE submission_key=%s",$key));
   if ($wpdb->last_error) return self::error('storage_unavailable',503);
   if ($row && !hash_equals($row->fingerprint,$fp)) return self::error('key_conflict',409);
   if (!$row) $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE fingerprint=%s AND created>%d LIMIT 1",$fp,$now-DAY_IN_SECONDS));
   if ($wpdb->last_error) return self::error('storage_unavailable',503);
   $duplicate=(bool)$row;
   if (!$row) {
    $id=wp_generate_uuid4();
    if (false===$wpdb->insert($t,['id'=>$id,'submission_key'=>$key,'fingerprint'=>$fp,'created'=>$now,'customer_type'=>$d['customer_type'],'language'=>$d['language'],'email'=>$d['email'],'data'=>wp_json_encode($d),'next_attempt'=>$now])) return self::error('storage_unavailable',503);
   } else $id=$row->id;
   $res=new WP_REST_Response(['ok'=>true,'stored'=>true,'lead_id'=>$id,'duplicate'=>$duplicate,'notification'=>$row?$row->notification:'pending'],$duplicate?200:201);
   $res->header('Cache-Control','no-store'); return $res;
  } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)',$lock)); }
 }
 static function worker() {
  if (!self::enabled()) return;
  global $wpdb; $t=self::table(); $now=time();
  $days=max(1,min(730,(int)get_option('qm_retention',180)));
  $wpdb->query($wpdb->prepare("DELETE FROM $t WHERE created<%d",$now-$days*DAY_IN_SECONDS));
  $recipient=get_option('qm_notify',get_option('admin_email'));
  if (!is_email($recipient)) return;
  $lock='qm_mail_'.substr(hash('sha256',DB_NAME.$t),0,35);
  if ((string)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)',$lock))!=='1') return;
  try {
   $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE notification IN ('pending','failed') AND attempts<5 AND next_attempt<=%d ORDER BY created LIMIT 20",$now));
   foreach ($rows as $row) {
    // Notification contains no submitted PII. Authorized admin must log in to view.
    $ok=wp_mail($recipient,'QuickMind inquiry '.$row->id,'A new inquiry is stored. Reference: '.$row->id."\n".admin_url('admin.php?page=qm-leads'));
    $attempts=(int)$row->attempts+1;
    $wpdb->update($t,['notification'=>$ok?'mail_accepted':'failed','attempts'=>$attempts,'next_attempt'=>$now+min(DAY_IN_SECONDS,300*(2**$attempts))],['id'=>$row->id]);
   }
  } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)',$lock)); }
 }
 static function csv_cell($v) { $v=(string)$v; return preg_match('/^[\s\x00-\x20]*[=+@-]/u',$v)?"'".$v:$v; }
 static function action() {
  if (!current_user_can('manage_options')) wp_die('Forbidden',403);
  check_admin_referer('qm-leads'); global $wpdb; $t=self::table();
  $op=sanitize_key($_POST['operation']??'');
  if ($op==='settings') {
   $email=sanitize_email(wp_unslash($_POST['notify']??'')); if (!is_email($email)) wp_die('Invalid email');
   update_option('qm_notify',$email,false); update_option('qm_retention',max(1,min(730,(int)($_POST['days']??180))),false);
  } elseif (in_array($op,['delete','retry'],true)) {
   $id=sanitize_text_field(wp_unslash($_POST['lead_id']??''));
   if ($op==='delete') $wpdb->delete($t,['id'=>$id]);
   else $wpdb->update($t,['notification'=>'pending','attempts'=>0,'next_attempt'=>time()],['id'=>$id]);
  } elseif ($op==='export') {
   nocache_headers(); header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename=quickmind-leads.csv');
   $out=fopen('php://output','w'); fputcsv($out,['id','submitted_utc','notification','customer_type','language','name','email','country','organization','quantity','payment','notes','source_page','source_cta','source_reference','utm','consent_version']);
   $offset=0;
   do {
    $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $t ORDER BY created,id LIMIT 500 OFFSET %d",$offset));
    foreach ($rows as $r) {
     $d=json_decode($r->data,true); $cells=[$r->id,gmdate('c',$r->created),$r->notification,$r->customer_type,$r->language];
     foreach (['name','email','country','organization','quantity','payment','notes','source_page','source_cta','source_reference','utm','consent_version'] as $k) $cells[]=is_array($d[$k]??null)?wp_json_encode($d[$k]):($d[$k]??'');
     fputcsv($out,array_map([__CLASS__,'csv_cell'],$cells));
    } $offset+=500;
   } while (count($rows)===500);
   fclose($out); exit;
  }
  wp_safe_redirect(admin_url('admin.php?page=qm-leads')); exit;
 }
 static function form($op,$id='') {
  echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'">'; wp_nonce_field('qm-leads');
  echo '<input type="hidden" name="action" value="qm_leads"><input type="hidden" name="operation" value="'.esc_attr($op).'"><input type="hidden" name="lead_id" value="'.esc_attr($id).'">';
 }
 static function admin() {
  if (!current_user_can('manage_options')) return;
  global $wpdb; $t=self::table();
  echo '<div class="wrap"><h1>QuickMind Store1 inquiries</h1><p>'.(self::enabled()?'Staging receiver enabled.':'Disabled: WP_ENVIRONMENT_TYPE must be staging.').' mail_accepted means mail component accepted, NOT delivered. No orders created.</p>';
  self::form('settings'); echo '<label>Notification email <input name="notify" type="email" required value="'.esc_attr(get_option('qm_notify',get_option('admin_email'))).'"></label> <label>Retention days <input name="days" type="number" min="1" max="730" value="'.esc_attr(get_option('qm_retention',180)).'"></label> <button>Save settings</button></form>';
  self::form('export'); echo '<button>Export all leads CSV</button></form>';
  $counts=$wpdb->get_results("SELECT customer_type,language,COUNT(*) AS n FROM $t GROUP BY customer_type,language");
  echo '<h2>Counts by customer type and language</h2><ul>'; foreach ($counts as $c) echo '<li>'.esc_html("$c->customer_type / $c->language: $c->n").'</li>'; echo '</ul>';
  $page=max(1,(int)($_GET['paged']??1)); $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $t ORDER BY created DESC,id LIMIT 25 OFFSET %d",($page-1)*25));
  foreach ($rows as $r) {
   echo '<hr><h2>'.esc_html($r->id).'</h2><p>'.esc_html(gmdate('c',$r->created).' | '.$r->notification.' | attempts '.$r->attempts).'</p><pre style="white-space:pre-wrap">'.esc_html(wp_json_encode(json_decode($r->data),JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)).'</pre>';
   self::form('delete',$r->id); echo '<button>Delete permanently</button></form>'; self::form('retry',$r->id); echo '<button>Queue notification again</button></form>';
  }
  if ($page>1) echo '<a href="'.esc_url(add_query_arg('paged',$page-1)).'">Previous</a> ';
  if (count($rows)===25) echo '<a href="'.esc_url(add_query_arg('paged',$page+1)).'">Next</a>'; echo '</div>';
 }
}
register_activation_hook(__FILE__,['QM_Leads','activate']);
register_deactivation_hook(__FILE__,function(){wp_clear_scheduled_hook('qm_leads_worker');});
add_action('qm_leads_worker',['QM_Leads','worker']);
add_action('rest_api_init',function(){register_rest_route('quickmind/v1','/leads',['methods'=>'POST','permission_callback'=>['QM_Leads','permission'],'callback'=>['QM_Leads','receive']]);});
add_action('admin_menu',function(){add_menu_page('QuickMind leads','QuickMind leads','manage_options','qm-leads',['QM_Leads','admin'],'dashicons-email-alt');});
add_action('admin_post_qm_leads',['QM_Leads','action']);
// Use WordPress's verified privacy-request workflow for erasure by contact email.
add_filter('wp_privacy_personal_data_erasers',function($erasers){
 $erasers['quickmind-leads']=['eraser_friendly_name'=>'QuickMind inquiries','callback'=>function($email,$page=1){
  global $wpdb; $result=$wpdb->delete(QM_Leads::table(),['email'=>strtolower($email)]);
  return ['items_removed'=>$result>0,'items_retained'=>$result===false,'messages'=>$result===false?['QuickMind storage unavailable; retry erasure.']:[],'done'=>$result!==false];
 }]; return $erasers;
});
add_filter('wp_privacy_personal_data_exporters',function($exporters){
 $exporters['quickmind-leads']=['exporter_friendly_name'=>'QuickMind inquiries','callback'=>function($email,$page=1){
  global $wpdb; $t=QM_Leads::table(); $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE email=%s ORDER BY id LIMIT 100 OFFSET %d",strtolower($email),(max(1,(int)$page)-1)*100));
  $data=[]; foreach ($rows as $r) $data[]=['group_id'=>'quickmind-leads','group_label'=>'QuickMind inquiries','item_id'=>'qm-'.$r->id,'data'=>[['name'=>'Submitted UTC','value'=>gmdate('c',$r->created)],['name'=>'Inquiry','value'=>$r->data]]];
  return ['data'=>$data,'done'=>count($rows)<100];
 }]; return $exporters;
});
