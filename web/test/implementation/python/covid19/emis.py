# covid19-phenomics, 2020.

import sys, csv

codes = ["EMISNQEX58", 	"EMISNQSU106", "EMISNQTE31", "EMISNQCO303", "EMISNQEX59"];
with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["emis-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in codes]):
                newRow["emis-identified"] = "CASE";
                break;
            else:
                newRow["emis-identified"] = "UNK";
        csv_writer.writerow(newRow)
