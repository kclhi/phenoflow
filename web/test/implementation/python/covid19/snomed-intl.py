# covid19-phenomics, 2020.

import sys, csv

codes = ["138875005","840539006","840539006","840539006","840544004","840544004","840544004","840544004","840546002","840546002","840546002","840533007","840533007","840533007","840536004","840536004","840536004","840535000","840535000","840535000","840534001","840534001","840534001","840534001"];

with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["snomed-intl-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in codes]):
                newRow["snomed-intl-identified"] = "CASE";
                break;
            else:
                newRow["snomed-intl-identified"] = "UNK";
        csv_writer.writerow(newRow)
