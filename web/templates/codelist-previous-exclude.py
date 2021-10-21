# [AUTHOR], [YEAR].

import sys, csv, re

codes_previous= [[LIST_PREVIOUS]];
codes_exclude = [[LIST_EXCLUDE]];

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-exclusion"])
    csv_writer.writeheader();
    codes_identified = 0;
    for row in csv_reader:
        previous=exclude=False;
        newRow = row.copy();
        newRow["[CATEGORY]-exclusion"] = "FALSE";
        for cell in row:
            # Iterate cell lists (e.g. codes)
            for item in re.findall(r'\(([^,]*)\,', row[cell]):
                if(item in codes_previous): previous = True;
                if(item in codes_exclude): exclude = True
        if(previous and exclude): newRow["[CATEGORY]-exclusion"] = "TRUE";
        csv_writer.writerow(newRow);
