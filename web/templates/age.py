# [AUTHOR], [YEAR].

import sys, csv
from datetime import datetime, date

def calculateAge(born):
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["age-exclusion"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        if(calculateAge(datetime.fromisoformat(row["dob"]))>=[AGE_LOWER] and calculateAge(datetime.fromisoformat(row["dob"]))<[AGE_UPPER]):
            newRow["age-exclusion"] = "FALSE";
        else:
            newRow["age-exclusion"] = "TRUE";
        csv_writer.writerow(newRow)
