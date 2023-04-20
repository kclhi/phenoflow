# covid19-phenomics, 2020.

import sys, csv

codes = [{"code":"94558-4","system":"system"}, {"code":"94507-1","system":"system"}, {"code":"94508-9","system":"system"}, {"code":"94562-6","system":"system"}, {"code":"94563-4","system":"system"}, {"code":"94564-2","system":"system"}, {"code":"94547-7","system":"system"}, {"code":"94661-6","system":"system"}, {"code":"94506-3","system":"system"}, {"code":"94505-5","system":"system"}];

with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["loinc-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in list(map(lambda code: code['code'], codes))]):
                newRow["loinc-identified"] = "CASE";
                break;
            else:
                newRow["loinc-identified"] = "UNK";
        csv_writer.writerow(newRow)
