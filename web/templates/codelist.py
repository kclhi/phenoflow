# [AUTHOR], [YEAR].

import sys, csv

codes = [[LIST]];
with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            # If we previously excluded this individual due to their age, they cannot be a case now.
            if([value for value in row[cell].split(",") if value in codes] and not("age-exclusion" in row and row["age-exclusion"]=="TRUE")):
                newRow["[CATEGORY]-identified"] = "CASE";
                break;
            else:
                newRow["[CATEGORY]-identified"] = "UNK";
        csv_writer.writerow(newRow)
