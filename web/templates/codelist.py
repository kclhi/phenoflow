# [AUTHOR], [YEAR].

import sys, csv

codes = [[LIST]];
REQUIRED_CODES = [REQUIRED_CODES];
with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-identified"])
    csv_writer.writeheader();
    codes_identified = 0;
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            # Iterate cell lists (e.g. codes)
            for item in row[cell].split(","):
              # If we previously excluded this individual due to their age, they cannot be a case now.
              if(item in codes and not("age-exclusion" in row and row["age-exclusion"]=="TRUE") and not("last-encounter-exclusion" in row and row["last-encounter-exclusion"]=="TRUE")): codes_identified+=1;
              if(codes_identified>=REQUIRED_CODES):
                  newRow["[CATEGORY]-identified"] = "CASE";
                  break;
            if(codes_identified>=REQUIRED_CODES): break;
        if(codes_identified<REQUIRED_CODES):
            newRow["[CATEGORY]-identified"] = "UNK";
        codes_identified=0;
        csv_writer.writerow(newRow)
