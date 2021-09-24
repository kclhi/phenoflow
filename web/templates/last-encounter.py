# [AUTHOR], [YEAR].

import sys, csv
from datetime import datetime, date

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["last-encounter-exclusion"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        if(date.today().year-datetime.fromisoformat(row["last-encounter"]).year<[MAX_YEARS]):
            newRow["last-encounter-exclusion"] = "FALSE";
        else:
            newRow["last-encounter-exclusion"] = "TRUE";
        csv_writer.writerow(newRow)
