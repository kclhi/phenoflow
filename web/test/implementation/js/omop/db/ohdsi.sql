-- remove any previously added database connection configuration data
truncate ohdsi.source cascade;
truncate ohdsi.source_daimon;

-- OHDSI CDM source
INSERT INTO ohdsi.source(source_id, source_name, source_key, source_connection, source_dialect) VALUES (1, 'OHDdockeSI CDM V5 Database', 'OHDSI-CDMV5', 'jdbc:postgresql://db:5432/omop?user=user&password=password', 'postgresql');

-- CDM daimon
INSERT INTO ohdsi.source_daimon(source_daimon_id, source_id, daimon_type, table_qualifier, priority) VALUES (1, 1, 0, 'public', 2);

-- VOCABULARY daimon
INSERT INTO ohdsi.source_daimon(source_daimon_id, source_id, daimon_type, table_qualifier, priority) VALUES (2, 1, 1, 'public', 2);

-- RESULTS daimon
INSERT INTO ohdsi.source_daimon(source_daimon_id, source_id, daimon_type, table_qualifier, priority) VALUES (3, 1, 2, 'ohdsi', 2);

-- EVIDENCE daimon
INSERT INTO ohdsi.source_daimon(source_daimon_id, source_id, daimon_type, table_qualifier, priority) VALUES (4, 1, 3, 'ohdsi', 2);

-- https://forums.ohdsi.org/t/cohort-generation-in-atlas-with-generation-status-failed/5690/25
ALTER TABLE ohdsi.cohort_inclusion_result ADD mode_id int NOT NULL DEFAULT 0;

ALTER TABLE ohdsi.cohort_inclusion_stats ADD mode_id int NOT NULL DEFAULT 0;

ALTER TABLE ohdsi.cohort_summary_stats ADD mode_id int NOT NULL DEFAULT 0;
