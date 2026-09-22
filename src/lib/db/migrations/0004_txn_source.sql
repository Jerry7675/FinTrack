ALTER TABLE `transactions` ADD `source_type` text;
ALTER TABLE `transactions` ADD `source_id` text;
CREATE INDEX `tx_source_idx` ON `transactions` (`source_type`,`source_id`);
