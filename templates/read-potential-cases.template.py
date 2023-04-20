import csv

with open('[PHENOTYPE]-potential-cases.csv', 'w', newline='') as file_out:
    csv_writer = csv.DictWriter(file_out, ["patient-id","dob","codes","last-encounter"])
    csv_writer.writeheader();
