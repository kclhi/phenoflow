library(ETLSyntheaBuilder)

 cd <- DatabaseConnector::createConnectionDetails(
  dbms     = "postgresql",
  server   = "db/omop",
  user     = "user",
  password = "password",
  port     = 5432
)

ETLSyntheaBuilder::DropVocabTables(connectionDetails = cd, vocabDatabaseSchema = "cdm")
ETLSyntheaBuilder::DropEventTables(connectionDetails = cd, cdmDatabaseSchema = "cdm")
ETLSyntheaBuilder::DropSyntheaTables(connectionDetails = cd, syntheaDatabaseSchema = "public")
ETLSyntheaBuilder::DropMapAndRollupTables (connectionDetails = cd, cdmDatabaseSchema = "cdm")
ETLSyntheaBuilder::CreateVocabTables(connectionDetails = cd, vocabDatabaseSchema = "cdm")
ETLSyntheaBuilder::CreateEventTables(connectionDetails = cd, cdmDatabaseSchema = "cdm")
ETLSyntheaBuilder::CreateSyntheaTables(connectionDetails = cd, syntheaDatabaseSchema = "public")
ETLSyntheaBuilder::LoadSyntheaTables(connectionDetails = cd, syntheaDatabaseSchema = "public", syntheaFileLoc = "data")
ETLSyntheaBuilder::LoadVocabFromCsv(connectionDetails = cd, cdmDatabaseSchema = "cdm", vocabFileLoc = "/vocabulary")
ETLSyntheaBuilder::CreateVocabMapTables(connectionDetails = cd, cdmDatabaseSchema = "cdm")
ETLSyntheaBuilder::CreateVisitRollupTables(connectionDetails = cd, cdmDatabaseSchema = "cdm", syntheaDatabaseSchema = "public")
ETLSyntheaBuilder::LoadEventTables(connectionDetails = cd, cdmDatabaseSchema = "cdm", syntheaDatabaseSchema = "public")
