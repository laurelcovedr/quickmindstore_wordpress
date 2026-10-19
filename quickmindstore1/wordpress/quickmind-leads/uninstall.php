<?php
if (!defined('WP_UNINSTALL_PLUGIN')) exit;
// Preserve leads on removal by default. Explicit opt-in after backup/privacy review.
if (defined('QM_LEADS_DELETE_ON_UNINSTALL') && QM_LEADS_DELETE_ON_UNINSTALL===true) {
 global $wpdb; $wpdb->query('DROP TABLE IF EXISTS '.$wpdb->prefix.'qm_leads');
 delete_option('qm_notify'); delete_option('qm_retention');
}
wp_clear_scheduled_hook('qm_leads_worker');
