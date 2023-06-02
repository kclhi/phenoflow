# covid19-phenomics, 2020.

import sys, csv

codes = [{"code":"138875005","system":"system"},{"code":"840539006","system":"system"},{"code":"840539006","system":"system"},{"code":"840539006","system":"system"},{"code":"840544004","system":"system"},{"code":"840544004","system":"system"},{"code":"840544004","system":"system"},{"code":"840544004","system":"system"},{"code":"840546002","system":"system"},{"code":"840546002","system":"system"},{"code":"840546002","system":"system"},{"code":"840533007","system":"system"},{"code":"840533007","system":"system"},{"code":"840533007","system":"system"},{"code":"840536004","system":"system"},{"code":"840536004","system":"system"},{"code":"840536004","system":"system"},{"code":"840535000","system":"system"},{"code":"840535000","system":"system"},{"code":"840535000","system":"system"},{"code":"840534001","system":"system"},{"code":"840534001","system":"system"},{"code":"840534001","system":"system"},{"code":"840534001","system":"system"}];

with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["snomed-intl-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in list(map(lambda code: code['code'], codes))]):
                newRow["snomed-intl-identified"] = "CASE";
                break;
            else:
                newRow["snomed-intl-identified"] = "UNK";
        csv_writer.writerow(newRow)
