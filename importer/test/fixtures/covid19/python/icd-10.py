# covid19-phenomics, 2020.

import sys, csv

codes = [{"code":"U07.1","system":"system"}, {"code":"U07.2","system":"system"}];
with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["icd10-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in list(map(lambda code: code['code'], codes))]):
                newRow["icd10-identified"] = "CASE";
                break;
            else:
                newRow["icd10-identified"] = "UNK";
        csv_writer.writerow(newRow)
