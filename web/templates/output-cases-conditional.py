# martinchapman, 2020.

import sys, csv

def checkRow(row):
  for case_steps in cases: 
    if not "CASE" in {col:row[col] for col in case_steps if col in row}.values(): return row;
  for unk_steps in unks: 
    if "CASE" in {col:row[col] for col in unk_steps if col in row}.values(): return row;
  row['[NESTED]-identified'] = 'CASE';
  return row;

cases = [CASES];
unks = [UNKS];

with open(sys.argv[1], 'r') as file_in, open('[PHENOTYPE]-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    all_cases = [category for codes in cases for category in codes];
    all_unks = [category for codes in unks for category in codes];
    csv_writer = csv.DictWriter(file_out, list(set(csv_reader.fieldnames)-set(all_cases+all_unks)) + ['[NESTED]-identified'])
    csv_writer.writeheader();
    for row in csv_reader:
      new_row = row.copy();
      new_row['[NESTED]-identified'] = 'UNK';
      new_row = checkRow(new_row);
      for case_key in all_cases+all_unks: new_row.pop(case_key, None);
      csv_writer.writerow(new_row);
