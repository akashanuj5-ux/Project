-- =============================================================================
-- MySQL DDL Schema Script (Merged & Converted from Supabase PostgreSQL)
-- Compatible with phpMyAdmin and MySQL 5.7+ / MariaDB
-- Generated on: 2026-10-05
-- =============================================================================

-- Disable foreign key checks temporarily to avoid constraint ordering issues
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if they exist to allow clean re-runs
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `audit_trail`;
DROP TABLE IF EXISTS `deviations`;
DROP TABLE IF EXISTS `deviation_ticket_seq`;
DROP TABLE IF EXISTS `form_fields`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `auth_users`;
DROP TABLE IF EXISTS `profiles`;
DROP TABLE IF EXISTS `master_routing`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. MASTER ROUTING TABLE
-- =============================================================================
CREATE TABLE `master_routing` (
  `id` VARCHAR(36) NOT NULL,
  `item` VARCHAR(255) DEFAULT NULL,
  `op_code` VARCHAR(255) DEFAULT NULL,
  `op_desc` VARCHAR(255) DEFAULT NULL,
  `dept_code` VARCHAR(255) DEFAULT NULL,
  `dept_desc` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_mr_item` (`item`),
  INDEX `idx_mr_op_code` (`op_code`),
  INDEX `idx_mr_op_desc` (`op_desc`),
  INDEX `idx_mr_dept_code` (`dept_code`),
  INDEX `idx_mr_dept_desc` (`dept_desc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. PROFILES TABLE
-- =============================================================================
CREATE TABLE `profiles` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL DEFAULT '',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `permissions` JSON DEFAULT NULL COMMENT 'Per-user page visibility and action overrides layered over the selected role preset.',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 3. USER ROLES TABLE
-- =============================================================================
CREATE TABLE `user_roles` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `role` ENUM('ADMIN', 'REQUESTER', 'FLOOR_MANAGER', 'PPC_REVIEWER', 'VIEWER') NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ur_user_role` (`user_id`, `role`),
  CONSTRAINT `fk_ur_user_id` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. FORM FIELDS TABLE
-- =============================================================================
CREATE TABLE `form_fields` (
  `id` VARCHAR(36) NOT NULL,
  `field_key` VARCHAR(255) NOT NULL UNIQUE,
  `label` VARCHAR(255) NOT NULL,
  `field_type` VARCHAR(50) NOT NULL DEFAULT 'text',
  `options` JSON DEFAULT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 0,
  `visible` TINYINT(1) NOT NULL DEFAULT 1,
  `is_core` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `lookup_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `lookup_column` VARCHAR(255) DEFAULT NULL,
  `lookup_mode` VARCHAR(50) NOT NULL DEFAULT 'prefix',
  `lookup_min_chars` INT NOT NULL DEFAULT 0,
  `autofill_target` VARCHAR(255) DEFAULT NULL,
  `autofill_source` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 5. DEVIATIONS TABLE
-- =============================================================================
CREATE TABLE `deviations` (
  `id` VARCHAR(36) NOT NULL,
  `ticket_no` VARCHAR(50) NOT NULL UNIQUE,
  `requester_id` VARCHAR(36) DEFAULT NULL,
  `requester_name` VARCHAR(255) NOT NULL DEFAULT '',
  `requester_email` VARCHAR(255) NOT NULL DEFAULT '',
  `supervisor_name` VARCHAR(255) NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `last_seq_no` INT DEFAULT NULL,
  `last_operation_name` VARCHAR(255) DEFAULT NULL,
  `next_dept_code` VARCHAR(255) DEFAULT NULL,
  `next_dept_desc` VARCHAR(255) DEFAULT NULL,
  `next_seq_no` INT DEFAULT NULL,
  `next_op_code` VARCHAR(255) DEFAULT NULL,
  `proposed_operation` VARCHAR(255) NOT NULL,
  `movement_date` DATE DEFAULT NULL,
  `change_type` VARCHAR(50) NOT NULL DEFAULT 'Permanent',
  `remarks` TEXT DEFAULT NULL,
  `custom_fields` JSON DEFAULT NULL,
  `floor_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'NA') NOT NULL DEFAULT 'PENDING',
  `floor_reviewed_by` VARCHAR(36) DEFAULT NULL,
  `floor_reviewer_name` VARCHAR(255) DEFAULT NULL,
  `floor_reviewed_at` TIMESTAMP DEFAULT NULL,
  `floor_remarks` TEXT DEFAULT NULL,
  `ppc_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'NA') NOT NULL DEFAULT 'PENDING',
  `ppc_reviewed_by` VARCHAR(36) DEFAULT NULL,
  `ppc_reviewer_name` VARCHAR(255) DEFAULT NULL,
  `ppc_reviewed_at` TIMESTAMP DEFAULT NULL,
  `ppc_remarks` TEXT DEFAULT NULL,
  `eco_no` VARCHAR(255) DEFAULT NULL,
  `fusion_sync` ENUM('NOT_SYNCED', 'SYNCED', 'FAILED') NOT NULL DEFAULT 'NOT_SYNCED',
  `fusion_synced_at` TIMESTAMP DEFAULT NULL,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eco_attachment_url` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_dev_requester_id` FOREIGN KEY (`requester_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 6. AUDIT TRAIL TABLE
-- =============================================================================
CREATE TABLE `audit_trail` (
  `id` VARCHAR(36) NOT NULL,
  `deviation_id` VARCHAR(36) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `actor_id` VARCHAR(36) DEFAULT NULL,
  `actor_name` VARCHAR(255) NOT NULL DEFAULT '',
  `actor_email` VARCHAR(255) NOT NULL DEFAULT '',
  `actor_role` VARCHAR(255) NOT NULL DEFAULT '',
  `remarks` TEXT DEFAULT NULL,
  `changes` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_audit_deviation_id` FOREIGN KEY (`deviation_id`) REFERENCES `deviations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_actor_id` FOREIGN KEY (`actor_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL,
  INDEX `idx_audit_dev` (`deviation_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 7. APP SETTINGS TABLE
-- =============================================================================
CREATE TABLE `app_settings` (
  `key` VARCHAR(255) NOT NULL,
  `value` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 8. TICKET ATTACHMENTS (stored locally in MySQL — LONGBLOB binary data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id` VARCHAR(36) NOT NULL,
  `deviation_id` VARCHAR(36) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL,
  `file_data` LONGBLOB NOT NULL,
  `uploaded_by` VARCHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ta_deviation_id` (`deviation_id`),
  CONSTRAINT `fk_ta_deviation_id` FOREIGN KEY (`deviation_id`) REFERENCES `deviations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 9. AUTH USERS EMULATION (For User Sign-up flows / trigger support)
-- =============================================================================
CREATE TABLE `auth_users` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `raw_user_meta_data` JSON DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 10. TICKET NUMBER SEQUENCE SIMULATION (Auto-increment table helper)
-- =============================================================================
CREATE TABLE `deviation_ticket_seq` (
  `id` INT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT = 1001 DEFAULT CHARSET=utf8mb4;


-- =============================================================================
-- 11. PROCEDURES, FUNCTIONS & TRIGGERS
-- =============================================================================
DELIMITER $$

-- Trigger: Automatically generate UUID for master_routing if not provided
CREATE TRIGGER `trg_master_routing_uuid` BEFORE INSERT ON `master_routing`
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$

-- Trigger: Automatically generate UUID for user_roles if not provided
CREATE TRIGGER `trg_user_roles_uuid` BEFORE INSERT ON `user_roles`
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$

-- Trigger: Automatically generate UUID for form_fields if not provided
CREATE TRIGGER `trg_form_fields_uuid` BEFORE INSERT ON `form_fields`
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$

-- Trigger: Automatically generate UUID and Ticket Number for deviations
CREATE TRIGGER `trg_deviations_insert` BEFORE INSERT ON `deviations`
FOR EACH ROW
BEGIN
  DECLARE next_seq INT;
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
  IF NEW.ticket_no IS NULL OR NEW.ticket_no = '' THEN
    INSERT INTO `deviation_ticket_seq` VALUES (NULL);
    SET next_seq = LAST_INSERT_ID();
    SET NEW.ticket_no = CONCAT('DEV-', YEAR(NOW()), '-', LPAD(next_seq, 4, '0'));
  END IF;
END$$

-- Trigger: Automatically generate UUID for audit_trail if not provided
CREATE TRIGGER `trg_audit_trail_uuid` BEFORE INSERT ON `audit_trail`
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$

-- Trigger: Automatically handle profile creation and role assignment on auth sign-up
CREATE TRIGGER `on_auth_user_created` AFTER INSERT ON `auth_users`
FOR EACH ROW
BEGIN
  DECLARE first_user INT;
  DECLARE user_role VARCHAR(50);
  DECLARE user_full_name VARCHAR(255);

  -- Extract full name from JSON metadata or fallback to email prefix or empty string
  SET user_full_name = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(NEW.raw_user_meta_data, '$.full_name')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(NEW.raw_user_meta_data, '$.name')), 'null'),
    SUBSTRING_INDEX(NEW.email, '@', 1),
    ''
  );

  -- Insert profile
  INSERT IGNORE INTO `profiles` (`id`, `email`, `full_name`)
  VALUES (NEW.id, COALESCE(NEW.email, ''), user_full_name);

  -- Count existing user roles
  SELECT COUNT(*) INTO first_user FROM `user_roles`;

  -- Extract role from metadata
  SET user_role = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(NEW.raw_user_meta_data, '$.role')), 'null');

  -- ADMIN for the very first account, REQUESTER / metadata role for subsequent accounts
  IF first_user = 0 THEN
    INSERT IGNORE INTO `user_roles` (`user_id`, `role`) VALUES (NEW.id, 'ADMIN');
  ELSE
    INSERT IGNORE INTO `user_roles` (`user_id`, `role`)
    VALUES (NEW.id, COALESCE(user_role, 'REQUESTER'));
  END IF;
END$$


-- Helper Function: has_role
CREATE FUNCTION `has_role`(_user_id VARCHAR(36), _role VARCHAR(50))
RETURNS TINYINT(1)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE has_it INT DEFAULT 0;
  SELECT COUNT(*) INTO has_it FROM `user_roles` WHERE `user_id` = _user_id AND `role` = _role;
  RETURN IF(has_it > 0, 1, 0);
END$$


-- Helper Function: is_admin
CREATE FUNCTION `is_admin`(_user_id VARCHAR(36))
RETURNS TINYINT(1)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE isAdmin INT DEFAULT 0;
  SELECT COUNT(*) INTO isAdmin FROM `user_roles` WHERE `user_id` = _user_id AND `role` = 'ADMIN';
  RETURN IF(isAdmin > 0, 1, 0);
END$$

DELIMITER ;


-- =============================================================================
-- 12. DATA SEEDING (Core Form Fields)
-- =============================================================================
INSERT INTO `form_fields` (
  `field_key`, `label`, `field_type`, `required`, `visible`, `is_core`, `sort_order`, `options`,
  `lookup_enabled`, `lookup_column`, `autofill_target`, `autofill_source`
) VALUES
 ('supervisor_name', 'Supervisor Name (Prod. Transit Control)', 'text', 1, 1, 1, 1, '[]', 0, NULL, NULL, NULL),
 ('item_name', 'Item Name', 'item_lookup', 1, 1, 1, 2, '[]', 1, 'item', NULL, NULL),
 ('last_seq_no', 'Last Seq No.', 'number', 1, 1, 1, 3, '[]', 0, NULL, NULL, NULL),
 ('last_operation_name', 'Last Operation Name', 'op_desc_lookup', 1, 1, 1, 4, '[]', 1, 'op_desc', NULL, NULL),
 ('next_dept_code', 'Next Department Code', 'dept_code_lookup', 1, 1, 1, 5, '[]', 1, 'dept_code', 'next_dept_desc', 'dept_desc'),
 ('next_dept_desc', 'Next Department Description', 'dept_desc_lookup', 0, 1, 1, 6, '[]', 1, 'dept_desc', 'next_dept_code', 'dept_code'),
 ('next_seq_no', 'Next Seq No', 'number', 1, 1, 1, 7, '[]', 0, NULL, NULL, NULL),
 ('next_op_code', 'Next Operation Code', 'op_code_lookup', 0, 1, 1, 8, '[]', 1, 'op_code', 'proposed_operation', 'op_desc'),
 ('proposed_operation', 'Proposed Operation (Need to Change in Routing)', 'op_desc_lookup', 1, 1, 1, 9, '[]', 1, 'op_desc', NULL, NULL),
 ('movement_date', 'Movement Date', 'date', 0, 1, 1, 10, '[]', 0, NULL, NULL, NULL),
 ('change_type', 'Change Type', 'select', 1, 1, 1, 11, '["Permanent", "Temporary", "Pilot / Trial", "Emergency Rework"]', 0, NULL, NULL, NULL),
 ('remarks', 'Remarks', 'textarea', 0, 1, 1, 12, '[]', 0, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
 `label` = VALUES(`label`),
 `field_type` = VALUES(`field_type`),
 `required` = VALUES(`required`),
 `visible` = VALUES(`visible`),
 `is_core` = VALUES(`is_core`),
 `sort_order` = VALUES(`sort_order`),
 `options` = VALUES(`options`),
 `lookup_enabled` = VALUES(`lookup_enabled`),
 `lookup_column` = VALUES(`lookup_column`),
 `autofill_target` = VALUES(`autofill_target`),
 `autofill_source` = VALUES(`autofill_source`);
