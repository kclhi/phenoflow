# [AUTHOR], [YEAR].

import sys, csv, re
from datetime import datetime, date

codes_a = [[LIST_A]];
codes_b = [[LIST_B]];
MIN_DAYS = [MIN_DAYS];
MAX_DAYS = [MAX_DAYS];

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["[CATEGORY]-identified"])
    csv_writer.writeheader();
    codes_identified = 0;
    for row in csv_reader:
        new_row = row.copy();
        matching_a_codes=[];
        matching_b_codes=[];
        for cell in row:
            # Iterate cell lists (e.g. codes)
            for item in re.findall(r'\(([^,]*\,[^,]*)\)', row[cell]):
                code = item.split(",")[0];
                date = datetime.fromisoformat(item.split(",")[1]);
                if(code in codes_a): matching_a_codes.append((code, date));
                if(code in codes_b): matching_b_codes.append((code, date));
                sorted(matching_a_codes, key=lambda code_date: code_date[1]);
                sorted(matching_b_codes, key=lambda code_date: code_date[1]);
                matching_a_codes.reverse();
        if(len(matching_a_codes)>0 and len(matching_b_codes)>0): 
            if(MIN_DAYS < (matching_b_codes[0][1]-matching_a_codes[0][1]).days and (matching_b_codes[0][1]-matching_a_codes[0][1]).days < MAX_DAYS):
                new_row["[CATEGORY]-identified"] = "CASE";
            else:
                new_row["[CATEGORY]-identified"] = "UNK";
        csv_writer.writerow(new_row)
