<?php
if (wp_get_environment_type()!=='staging') throw new Exception('staging required');
function check_qm($ok,$label) { if (!$ok) throw new Exception($label); echo "PASS $label\n"; }
function payload_qm($lang='en',$type='home') { return ['submission_id'=>wp_generate_uuid4(),'name'=>'=formula','email'=>wp_generate_uuid4().'@example.com','country'=>'Singapore','quantity'=>'1','customer_type'=>$type,'language'=>$lang,'consent'=>true,'source_page'=>'/contact/','source_cta'=>'test','utm'=>['utm_source'=>'linkedin']]; }
function request_qm($p) { $r=new WP_REST_Request('POST','/quickmind/v1/leads'); $r->set_header('Content-Type','application/json'); $r->set_header('Origin',home_url()); $r->set_body(wp_json_encode($p)); return rest_do_request($r); }
global $wpdb; $t=QM_Leads::table(); $wpdb->query("TRUNCATE TABLE $t"); $_SERVER['REMOTE_ADDR']='192.0.2.10';
$rate='qm_rate_'.substr(hash_hmac('sha256',$_SERVER['REMOTE_ADDR'],wp_salt('auth')),0,40); delete_transient($rate);
foreach (QM_Leads::LANGS as $lang) foreach (['home','clinic','distributor'] as $type) {
 $p=payload_qm($lang,$type); $r=request_qm($p); check_qm($r->get_status()===201,"persist $lang $type");
 $d=json_decode($wpdb->get_var($wpdb->prepare("SELECT data FROM $t WHERE id=%s",$r->get_data()['lead_id'])),true); check_qm($d['utm']===$p['utm'] && $d['customer_type']===$type,'DB attribution');
}
delete_transient($rate); $p=payload_qm(); $a=request_qm($p)->get_data(); $b=request_qm($p); check_qm($b->get_status()===200 && $b->get_data()['lead_id']===$a['lead_id'],'idempotency');
$p['name']='Changed'; check_qm(request_qm($p)->get_status()===409,'conflict');
foreach (['consent'=>false,'website'=>'spam','email'=>'bad','quantity'=>'0','language'=>'xx','customer_type'=>'other','source_page'=>'//evil','utm'=>'bad'] as $k=>$v) { $p=payload_qm(); $p[$k]=$v; check_qm(request_qm($p)->get_status()===422,"reject $k"); }
check_qm(rest_do_request(new WP_REST_Request('POST','/quickmind/v1/leads'))->get_status()===403,'origin');
check_qm(!current_user_can('manage_options'),'anonymous administration denied');
check_qm(QM_Leads::csv_cell(" \t=1")==="' \t=1",'CSV injection');
update_option('qm_notify','admin@example.com'); $fail=function(){return false;}; add_filter('pre_wp_mail',$fail); QM_Leads::worker(); remove_filter('pre_wp_mail',$fail);
check_qm((int)$wpdb->get_var("SELECT COUNT(*) FROM $t WHERE notification='failed'")>0,'mock mail failed');
$wpdb->query("UPDATE $t SET next_attempt=0"); $pass=function(){return true;}; add_filter('pre_wp_mail',$pass); QM_Leads::worker(); remove_filter('pre_wp_mail',$pass);
check_qm((int)$wpdb->get_var("SELECT COUNT(*) FROM $t WHERE notification='mail_accepted'")>0,'mock mail retry');
$wpdb->query("UPDATE $t SET created=1"); QM_Leads::worker(); check_qm((int)$wpdb->get_var("SELECT COUNT(*) FROM $t")===0,'retention');
delete_transient($rate); $wpdb->query("RENAME TABLE $t TO {$t}_offline"); $wpdb->suppress_errors(true); $r=request_qm(payload_qm()); $wpdb->query("RENAME TABLE {$t}_offline TO $t"); $wpdb->suppress_errors(false); check_qm($r->get_status()===503,'storage failure');
set_transient($rate,30,60); check_qm(request_qm(payload_qm())->get_status()===429,'rate limit'); delete_transient($rate);
$p=payload_qm(); request_qm($p); $erasers=apply_filters('wp_privacy_personal_data_erasers',[]); check_qm($erasers['quickmind-leads']['callback']($p['email'])['items_removed'],'privacy erasure');
