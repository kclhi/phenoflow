import sys, csv

with open(sys.argv[1], 'r') as file_in, open('potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["t2dm_prediction"])
    csv_writer.writeheader();
    for row in csv_reader:
        if ( row["t1dm_dx_cnt"] == "0" and row["t2dm_dx_cnt"] == "0" and "t2dm_rx_dts" in csv_reader.fieldnames and "abnormal_lab" in csv_reader.fieldnames and row["abnormal_lab"] == "1" ):
            row["t2dm_prediction"] = "CASE";
        else:
            row["t2dm_prediction"] = "UNK";
        csv_writer.writerow(row)
