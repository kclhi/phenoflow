# [AUTHOR], [YEAR].

import sys, csv, re

codes_previous= [[LIST_PREVIOUS]];
codes_current = [[LIST_CURRENT]];

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-[EXCLUSION_IDENTIFIED]"])
    csv_writer.writeheader();
    codes_identified = 0;
    for row in csv_reader:
        previous=exclude=False;
        newRow = row.copy();
        newRow["[CATEGORY]-[EXCLUSION_IDENTIFIED]"] = "[FALSE_UNK]";
        for cell in row:
            # Iterate cell lists (e.g. codes)
            for item in re.findall(r'\(([^,]*)\,', row[cell]):
                if(item in codes_previous): previous = True;
                if(item in codes_current): current = True
        if(previous==[PREVIOUS_PRESENT] and current==[CURRENT_PRESENT]): newRow["[CATEGORY]-[EXCLUSION_IDENTIFIED]"] = "[TRUE_CASE]";
        csv_writer.writerow(newRow);
