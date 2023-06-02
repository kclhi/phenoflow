# covid19-phenomics, 2020.

import sys, csv

codes = [{"code":"4J3R100","system":"system"}, {"code":"4J3R200","system":"system"}, {"code":"9Niq.","system":"system"},	{"code":"A7951","system":"system"}, {"code":"65PW100","system":"system"},	{"code":"4J3R.","system":"system"}, {"code":"9N312","system":"system"}, {"code":"8CAO1","system":"system"}, {"code":"8CAO.","system":"system"}, {"code":"1JX1.","system":"system"}];
with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["vision-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in list(map(lambda code: code['code'], codes))]):
                newRow["vision-identified"] = "CASE";
                break;
            else:
                newRow["vision-identified"] = "UNK";
        csv_writer.writerow(newRow)
