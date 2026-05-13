CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text NOT NULL,
	`phone` text,
	`company` text,
	`country` text DEFAULT 'MY' NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`franchise_code` text,
	`stripe_customer_id` text,
	`email_verified_at` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`domain_name` text NOT NULL,
	`tld` text NOT NULL,
	`registrar` text NOT NULL,
	`cloudflare_zone_id` text,
	`status` text DEFAULT 'pending_register' NOT NULL,
	`expires_at` integer,
	`auto_renew` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT true NOT NULL,
	`privacy_enabled` integer DEFAULT true NOT NULL,
	`purchase_price_cents` integer NOT NULL,
	`renewal_price_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`cf_rule_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hosting_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`plan_type` text NOT NULL,
	`sites_limit` integer NOT NULL,
	`storage_gb` integer NOT NULL,
	`billing_cycle` text DEFAULT 'yearly' NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`price_cents` integer NOT NULL,
	`started_at` integer,
	`expires_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`stripe_subscription_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`description` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`sst_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text DEFAULT 'MYR' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payment_provider` text,
	`stripe_invoice_id` text,
	`billplz_bill_id` text,
	`pdf_url` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `processed_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text,
	`ip_address` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`hosting_plan_id` text NOT NULL,
	`domain_id` text,
	`name` text NOT NULL,
	`cf_pages_project` text NOT NULL,
	`github_repo` text,
	`template` text,
	`status` text DEFAULT 'provisioning' NOT NULL,
	`last_deployed_at` integer,
	`last_deployment_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hosting_plan_id`) REFERENCES `hosting_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`domain_name` text NOT NULL,
	`direction` text DEFAULT 'in' NOT NULL,
	`auth_code` text,
	`status` text DEFAULT 'initiated' NOT NULL,
	`error_message` text,
	`initiated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`payload` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_log_customer_idx` ON `audit_log` (`customer_id`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_stripe_idx` ON `customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`domain_name`);--> statement-breakpoint
CREATE INDEX `domains_customer_idx` ON `domains` (`customer_id`);--> statement-breakpoint
CREATE INDEX `domains_expires_idx` ON `domains` (`expires_at`);--> statement-breakpoint
CREATE INDEX `email_routes_domain_idx` ON `email_routes` (`domain_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_routes_cf_rule_unique` ON `email_routes` (`cf_rule_id`);--> statement-breakpoint
CREATE INDEX `hosting_plans_customer_idx` ON `hosting_plans` (`customer_id`);--> statement-breakpoint
CREATE INDEX `hosting_plans_stripe_idx` ON `hosting_plans` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `invoices_customer_idx` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_stripe_idx` ON `invoices` (`stripe_invoice_id`);--> statement-breakpoint
CREATE INDEX `processed_events_provider_idx` ON `processed_events` (`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_customer_idx` ON `sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sites_customer_idx` ON `sites` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sites_plan_idx` ON `sites` (`hosting_plan_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sites_cf_pages_unique` ON `sites` (`cf_pages_project`);--> statement-breakpoint
CREATE INDEX `support_tickets_customer_idx` ON `support_tickets` (`customer_id`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`);--> statement-breakpoint
CREATE INDEX `transfers_customer_idx` ON `transfers` (`customer_id`);--> statement-breakpoint
CREATE INDEX `transfers_domain_idx` ON `transfers` (`domain_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `verification_tokens_hash_unique` ON `verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `verification_tokens_customer_idx` ON `verification_tokens` (`customer_id`);--> statement-breakpoint
CREATE INDEX `verification_tokens_expires_idx` ON `verification_tokens` (`expires_at`);