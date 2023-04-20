# martinchapman, 2020.

import sys, csv

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames)
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        # If any exclusion criteria are met prior to any cases being identified, those cases cannot be flagged as such (assist interpretation by user).
        newRow.update(list(map(lambda item:(item[0],"UNK") if len([subitem for subitem in list(newRow.items())[:list(newRow.items()).index(item)] if "exclusion" in subitem[0] and subitem[1]=="TRUE"])>0 and "identified" in item[0] else item, newRow.items())));
        csv_writer.writerow(newRow)
