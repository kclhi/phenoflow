# rest, 2020.

import sys, csv
from datetime import datetime, date

def calculateAge(born):
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

ageLower = 1;
ageUpper = 16;

with open(sys.argv[1], 'r') as file_in, open('otitis-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["age-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        if(ageLower <= calculateAge(datetime.fromisoformat(row["dob"])) and calculateAge(datetime.fromisoformat(row["dob"])) < ageUpper):
            newRow["age-identified"] = "CASE";
        else:
            newRow["age-identified"] = "UNK";
        csv_writer.writerow(newRow)
