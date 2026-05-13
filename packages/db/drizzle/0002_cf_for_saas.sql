-- Cloudflare for SaaS — Custom Hostnames support.
-- Phase: pivot HostDaddy.app from registrar-clone to "Cloudflare for non-technical Muslims".
-- Adds the columns needed to attach a customer's BYO domain via CF's Custom Hostnames API.

ALTER TABLE `sites` ADD COLUMN `custom_hostname` text;
ALTER TABLE `sites` ADD COLUMN `cf_hostname_id` text;
ALTER TABLE `sites` ADD COLUMN `ssl_status` text;
ALTER TABLE `sites` ADD COLUMN `verification_record_type` text;
ALTER TABLE `sites` ADD COLUMN `verification_record_name` text;
ALTER TABLE `sites` ADD COLUMN `verification_record_value` text;
ALTER TABLE `sites` ADD COLUMN `provisioned_at` integer;

CREATE UNIQUE INDEX `sites_custom_hostname_unique` ON `sites` (`custom_hostname`);
CREATE UNIQUE INDEX `sites_cf_hostname_unique` ON `sites` (`cf_hostname_id`);
