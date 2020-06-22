FROM library/postgres
# The be executed manually, after the WebAPI runs its migration.
COPY ohdsi.sql .
RUN echo "create schema cdm; ALTER DATABASE omop SET search_path TO cdm;" > /docker-entrypoint-initdb.d/0-init-cdm.sql
RUN echo "ALTER DATABASE omop SET search_path TO cdm;" > /docker-entrypoint-initdb.d/5-init-cdm.sql
# Results tables (http://localhost:8080/WebAPI/ddl/results?dialect=postgresql), replaces legacy tables created by WebAPI migration.
RUN echo "create schema results; ALTER DATABASE omop SET search_path TO results;" > /docker-entrypoint-initdb.d/3-init-results.sql
COPY results.sql /docker-entrypoint-initdb.d/4-results.sql
RUN find /docker-entrypoint-initdb.d/4-results.sql -type f -exec sed -i 's/\ vocab./\ cdm./g' {} \;
# Data model (https://github.com/OHDSI/CommonDataModel/tree/master/PostgreSQL (v5 branch))
ARG ddl="cdm/PostgreSQL/*ddl*.*"
COPY ${ddl} /docker-entrypoint-initdb.d/1-ddl.sql
# Indexes
ARG pk_indexes="cdm/PostgreSQL/*indexes*.*"
COPY ${pk_indexes} /docker-entrypoint-initdb.d/7-pk-indexes.sql
# Constraints
ARG constraints="cdm/PostgreSQL/*constraints*.*"
COPY ${constraints} /docker-entrypoint-initdb.d/8-constraints.sql
# Observational data (http://www.ltscomputingllc.com/downloads/)
COPY data/*.csv /docker-entrypoint-initdb.d/data/
COPY data.sql /docker-entrypoint-initdb.d/6-data.sql
# Vocabulary data (https://athena.ohdsi.org/vocabulary)
COPY vocabulary/*.csv /docker-entrypoint-initdb.d/vocabulary/
ARG vocab="cdm/PostgreSQL/VocabImport/*vocabulary*.*"
COPY ${vocab} /docker-entrypoint-initdb.d/2-vocab.sql
RUN find /docker-entrypoint-initdb.d/2-vocab.sql -type f -exec sed -i 's/C:\\CDMV5VOCAB\\/\/docker-entrypoint-initdb.d\/vocabulary\//g' {} \;
