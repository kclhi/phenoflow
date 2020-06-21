FROM r-base:latest

# R devtools
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libssh-dev \
    libxml2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN R -e "install.packages('devtools', repos='https://cloud.r-project.org/')"

# R rJava
RUN apt-get update && apt-get install -y \
    openjdk-8-jdk-headless \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME /usr/lib/jvm/java-8-openjdk-amd64
RUN R CMD javareconf
RUN R -e "install.packages('rJava', repos='https://cloud.r-project.org/')"

# ETL for observational data (https://github.com/OHDSI/ETL-Synthea)
RUN R -e "devtools::install_github('OHDSI/ETL-Synthea')"
# Observational data (https://github.com/synthetichealth/synthea)
COPY data/output/csv/*.csv data/
# Vocabulary data (https://athena.ohdsi.org/vocabulary)
COPY vocabulary vocabulary

COPY bin/wait-for-it.sh .
COPY etl.R .
CMD ["Rscript", "etl.R"]
