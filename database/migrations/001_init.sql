-- CAPTANHUNG Attendance Platform - Initial Schema
-- Run against a PostgreSQL database.
-- Creates the pgcrypto extension for gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE event_status AS ENUM ('DRAFT','UPCOMING','OPEN','PAUSED','CLOSED','CANCELLED','COMPLETED');
CREATE TYPE event_access_type AS ENUM ('PUBLIC','ACCESS_CODE','INVITATION_ONLY','LOGIN_REQUIRED');
CREATE TYPE evidence_mode AS ENUM ('NONE','OPTIONAL','MANDATORY');
CREATE TYPE attendance_status AS ENUM ('NOT_CHECKED_IN','CHECKED_IN','COMPLETED','MISSING_CHECKOUT','FLAGGED','REJECTED','ADMIN_REVIEWED');
CREATE TYPE verification_status AS ENUM ('PENDING','PASSED','FAILED','FLAGGED');
CREATE TYPE evidence_stage AS ENUM ('CHECK_IN','CHECK_OUT');
CREATE TYPE evidence_review_status AS ENUM ('PENDING','REVIEWED','FLAGGED','APPROVED');
CREATE TYPE action_result AS ENUM ('SUCCESS','FAILURE');

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(300) NOT NULL UNIQUE,
  phone VARCHAR(50),
  password_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- user_roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  assigned_by UUID,
  CONSTRAINT user_roles_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_uniq UNIQUE (user_id, role_id)
);

-- role_permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT role_permissions_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_id_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_uniq UNIQUE (role_id, permission_id)
);

-- sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  refresh_expires_at TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  banner_image TEXT,
  venue_name VARCHAR(200),
  venue_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 100,
  checkin_start_at TIMESTAMP NOT NULL,
  checkin_end_at TIMESTAMP NOT NULL,
  checkout_start_at TIMESTAMP,
  checkout_end_at TIMESTAMP,
  timezone VARCHAR(60) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  status event_status NOT NULL DEFAULT 'DRAFT',
  access_type event_access_type NOT NULL DEFAULT 'PUBLIC',
  access_code_hash TEXT,
  require_login BOOLEAN NOT NULL DEFAULT FALSE,
  require_gps_checkin BOOLEAN NOT NULL DEFAULT TRUE,
  require_gps_checkout BOOLEAN NOT NULL DEFAULT TRUE,
  gps_accuracy_threshold_meters INTEGER NOT NULL DEFAULT 20,
  require_geofence BOOLEAN NOT NULL DEFAULT TRUE,
  require_checkout_evidence evidence_mode NOT NULL DEFAULT 'MANDATORY',
  evidence_mode evidence_mode NOT NULL DEFAULT 'MANDATORY',
  allow_multiple_attendance BOOLEAN NOT NULL DEFAULT FALSE,
  max_attendance INTEGER,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP,
  closed_at TIMESTAMP,
  CONSTRAINT events_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- event_custom_fields
CREATE TABLE event_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  field_name VARCHAR(200) NOT NULL,
  field_type VARCHAR(30) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT event_custom_fields_event_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- attendance_records
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  attendance_reference VARCHAR(80) NOT NULL UNIQUE,
  idempotency_key UUID UNIQUE,
  participant_user_id UUID,
  participant_name VARCHAR(200) NOT NULL,
  participant_phone VARCHAR(100) NOT NULL,
  participant_identifier VARCHAR(100),
  participant_organization VARCHAR(200),
  participant_category VARCHAR(100),
  checkin_at TIMESTAMP,
  checkin_latitude DOUBLE PRECISION,
  checkin_longitude DOUBLE PRECISION,
  checkin_accuracy DOUBLE PRECISION,
  checkin_gps_timestamp TIMESTAMP,
  checkin_verification_status verification_status NOT NULL DEFAULT 'PENDING',
  checkout_at TIMESTAMP,
  checkout_latitude DOUBLE PRECISION,
  checkout_longitude DOUBLE PRECISION,
  checkout_accuracy DOUBLE PRECISION,
  checkout_gps_timestamp TIMESTAMP,
  checkout_verification_status verification_status NOT NULL DEFAULT 'PENDING',
  attendance_duration_seconds INTEGER,
  attendance_status attendance_status NOT NULL DEFAULT 'NOT_CHECKED_IN',
  checkout_evidence_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_records_event_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT attendance_records_participant_user_id_fk FOREIGN KEY (participant_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- attendance_custom_field_values
CREATE TABLE attendance_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL,
  field_id UUID NOT NULL,
  value TEXT NOT NULL,
  CONSTRAINT attendance_cfv_record_id_fk FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
  CONSTRAINT attendance_cfv_field_id_fk FOREIGN KEY (field_id) REFERENCES event_custom_fields(id) ON DELETE CASCADE,
  CONSTRAINT attendance_cfv_uniq UNIQUE (attendance_record_id, field_id)
);

-- attendance_evidence
CREATE TABLE attendance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL,
  stage evidence_stage NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_by UUID,
  review_status evidence_review_status NOT NULL DEFAULT 'PENDING',
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  CONSTRAINT attendance_evidence_record_id_fk FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
  CONSTRAINT attendance_evidence_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- attendance_verification_logs
CREATE TABLE attendance_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL,
  stage evidence_stage NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  calculated_distance DOUBLE PRECISION,
  geofence_result BOOLEAN,
  verification_result verification_status NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_verif_logs_record_id_fk FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE
);

-- audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_actor_id_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- access_logs
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  access_attempt_type TEXT NOT NULL,
  result action_result NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT access_logs_event_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- report_exports
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  format VARCHAR(20) NOT NULL,
  file_path TEXT NOT NULL,
  row_count INTEGER,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT report_exports_event_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  CONSTRAINT report_exports_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_status_idx ON users(status);
CREATE INDEX roles_name_idx ON roles(name);
CREATE INDEX permissions_name_idx ON permissions(name);
CREATE INDEX user_roles_user_id_idx ON user_roles(user_id);
CREATE INDEX user_roles_role_id_idx ON user_roles(role_id);
CREATE INDEX role_permissions_role_id_idx ON role_permissions(role_id);
CREATE INDEX role_permissions_permission_id_idx ON role_permissions(permission_id);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);
CREATE INDEX events_event_code_idx ON events(event_code);
CREATE INDEX events_status_idx ON events(status);
CREATE INDEX events_created_at_idx ON events(created_at);
CREATE INDEX events_checkin_window_idx ON events(checkin_start_at, checkin_end_at);
CREATE INDEX event_custom_fields_event_id_idx ON event_custom_fields(event_id);
CREATE INDEX attendance_records_event_id_idx ON attendance_records(event_id);
CREATE INDEX attendance_records_reference_idx ON attendance_records(attendance_reference);
CREATE INDEX attendance_records_phone_idx ON attendance_records(participant_phone);
CREATE INDEX attendance_records_status_idx ON attendance_records(attendance_status);
CREATE INDEX attendance_records_checkin_at_idx ON attendance_records(checkin_at);
CREATE INDEX attendance_cfv_record_id_idx ON attendance_custom_field_values(attendance_record_id);
CREATE INDEX attendance_cfv_field_id_idx ON attendance_custom_field_values(field_id);
CREATE INDEX attendance_evidence_record_id_idx ON attendance_evidence(attendance_record_id);
CREATE INDEX attendance_evidence_stage_idx ON attendance_evidence(stage);
CREATE INDEX attendance_evidence_review_status_idx ON attendance_evidence(review_status);
CREATE INDEX attendance_verif_logs_record_id_idx ON attendance_verification_logs(attendance_record_id);
CREATE INDEX attendance_verif_logs_stage_idx ON attendance_verification_logs(stage);
CREATE INDEX attendance_verif_logs_created_at_idx ON attendance_verification_logs(created_at);
CREATE INDEX audit_logs_actor_id_idx ON audit_logs(actor_user_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX access_logs_event_id_idx ON access_logs(event_id);
CREATE INDEX access_logs_created_at_idx ON access_logs(created_at);
CREATE INDEX access_logs_result_idx ON access_logs(result);
CREATE INDEX report_exports_event_id_idx ON report_exports(event_id);
CREATE INDEX report_exports_created_at_idx ON report_exports(created_at);
