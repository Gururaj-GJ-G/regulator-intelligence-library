CREATE TABLE regulators (
    regulator_id VARCHAR(32) PRIMARY KEY,
    acronym VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    country CHAR(2) NOT NULL,
    jurisdiction_type VARCHAR(32) NOT NULL,
    regulator_family VARCHAR(32)[] NOT NULL,
    source_url TEXT NOT NULL,
    last_ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_profile_reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    prototype_meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE obligations (
    obligation_id VARCHAR(32) PRIMARY KEY,
    regulator_id VARCHAR(32) NOT NULL REFERENCES regulators(regulator_id) ON DELETE RESTRICT,
    obligation_type VARCHAR(64) NOT NULL,
    control_template_ref VARCHAR(64) NOT NULL,
    reporting BOOLEAN NOT NULL DEFAULT FALSE,
    source_url TEXT NOT NULL,
    source_published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    legal_source_ref VARCHAR(255) NOT NULL,
    source_excerpt TEXT NOT NULL,
    obligation_summary TEXT NOT NULL,
    prototype_meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE reporting_obligations (
    report_id VARCHAR(32) PRIMARY KEY,
    regulator_id VARCHAR(32) NOT NULL REFERENCES regulators(regulator_id) ON DELETE RESTRICT,
    trigger_type VARCHAR(32) NOT NULL,
    frequency VARCHAR(32) NOT NULL,
    format_type VARCHAR(32) NOT NULL,
    source_url TEXT NOT NULL,
    source_published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    report_name VARCHAR(255) NOT NULL,
    deadline_description TEXT NOT NULL,
    penalty_description TEXT
);

CREATE TABLE licenses (
    license_id VARCHAR(64) PRIMARY KEY,
    license_name VARCHAR(255) NOT NULL,
    jurisdiction CHAR(2) NOT NULL,
    primary_regulator VARCHAR(32) NOT NULL REFERENCES regulators(regulator_id) ON DELETE RESTRICT,
    secondary_regulators VARCHAR(32)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
    allowed_products VARCHAR(64)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
    prototype_meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE products (
    product_id VARCHAR(64) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    jurisdiction CHAR(2) NOT NULL,
    regulators_in_scope VARCHAR(32)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
    risk_domain_tags VARCHAR(64)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[]
);

CREATE TABLE obligation_license_mapping (
    obligation_id VARCHAR(32) REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    license_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (obligation_id, license_id)
);

CREATE TABLE obligation_product_mapping (
    obligation_id VARCHAR(32) REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (obligation_id, product_id)
);

CREATE INDEX idx_regulators_country_family ON regulators (country, regulator_family);
CREATE INDEX idx_obligations_regulator_type ON obligations (regulator_id, obligation_type);
CREATE INDEX idx_reporting_regulator_trigger ON reporting_obligations (regulator_id, trigger_type);
CREATE INDEX idx_licenses_jurisdiction_primary ON licenses (jurisdiction, primary_regulator);
