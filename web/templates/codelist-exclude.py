# [AUTHOR], [YEAR].

import sys, csv, re

codes_exclude = [[LIST_EXCLUDE]];
codes_include = [[LIST_INCLUDE]];

def checkRow(row):
    newRow = row.copy();
    for cell in row:
        # Iterate cell lists (e.g. codes)
        for item in re.findall(r'\(([^,]*)\,', row[cell]):
            if(item in codes_exclude):
                newRow["[CATEGORY]-identified"] = "UNK";
                return newRow;
            if(item in codes_include):
                newRow["[CATEGORY]-identified"] = "CASE";
    return newRow;

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-identified"])
    csv_writer.writeheader();
    codes_identified = 0;
    for row in csv_reader:
        csv_writer.writerow(checkRow(row));
