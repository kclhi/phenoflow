# covid19-phenomics, 2020.

import sys, csv

codes = ["4J3R100", "4J3R200", "9Niq.",	"A7951", "65PW100",	"4J3R.", "9N312", "8CAO1", "8CAO.", "1JX1."];
with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["vision-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in codes]):
                newRow["vision-identified"] = "CASE";
                break;
            else:
                newRow["vision-identified"] = "UNK";
        csv_writer.writerow(newRow)
