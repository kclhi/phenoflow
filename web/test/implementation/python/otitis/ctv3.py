# rest, 2020.

import sys, csv

codes =  ["F527.", "F520.", "XE2QD", "Y20ff"];
with open(sys.argv[1], 'r') as file_in, open('otitis-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["ctv3-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in codes]):
                newRow["ctv3-identified"] = "CASE";
                break;
            else:
                newRow["ctv3-identified"] = "UNK";
        csv_writer.writerow(newRow)
