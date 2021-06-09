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
            if ([value for value in row[cell].split(",") if value in codes]):
                newRow["[CATEGORY]-identified"] = "CASE";
                break;
            else:
                newRow["[CATEGORY]-identified"] = "UNK";
        csv_writer.writerow(newRow)
