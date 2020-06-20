FROM library/postgres
COPY init.sql /docker-entrypoint-initdb.d/0-init.sql
# Data model (https://github.com/OHDSI/CommonDataModel/tree/master/PostgreSQL)
ARG ddl="cdm/PostgreSQL/*ddl*.*"
COPY ${ddl} /docker-entrypoint-initdb.d/1-ddl.sql
# Vocabulary data (https://athena.ohdsi.org/vocabulary)
COPY vocabulary/*.csv /docker-entrypoint-initdb.d/vocabulary/
ARG vocab="cdm/PostgreSQL/VocabImport/*vocabulary*.*"
COPY ${vocab} /docker-entrypoint-initdb.d/2-vocab.sql
RUN find /docker-entrypoint-initdb.d/2-vocab.sql -type f -exec sed -i 's/C:\\CDMV5VOCAB\\/\/docker-entrypoint-initdb.d\/vocabulary\//g' {} \;
# Observational data (http://www.ltscomputingllc.com/downloads/)
COPY data/*.csv /docker-entrypoint-initdb.d/data/
COPY data.sql /docker-entrypoint-initdb.d/3-data.sql
ARG pk_indexes="cdm/PostgreSQL/*indexes*.*"
COPY ${pk_indexes} /docker-entrypoint-initdb.d/4-pk-indexes.sql
ARG constraints="cdm/PostgreSQL/*constraints*.*"
COPY ${constraints} /docker-entrypoint-initdb.d/5-constraints.sql
# The be executed manually, after Broadsea tools run their migration.
COPY ohdsi.sql .
