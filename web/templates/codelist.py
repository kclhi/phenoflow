# [AUTHOR], [YEAR].

import sys, csv

codes = [[CODE_LIST]];
with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CODE_CATEGORY]-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if (row[cell] in codes):
                newRow["[CODE_CATEGORY]-identified"] = "CASE";
                break;
            else:
                newRow["[CODE_CATEGORY]-identified"] = "UNK";
        csv_writer.writerow(newRow)
