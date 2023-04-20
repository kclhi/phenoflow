# covid19-phenomics, 2020.

import sys, csv

codes = [{"code":"1240581000000104","system":"system"},{"code":"1240591000000102","system":"system"},{"code":"1240631000000102","system":"system"},{"code":"1240751000000100","system":"system"},{"code":"1240561000000108","system":"system"},{"code":"1240571000000101","system":"system"},{"code":"1240601000000108","system":"system"},{"code":"1240531000000103","system":"system"},{"code":"1240521000000100","system":"system"},{"code":"1240551000000105","system":"system"},{"code":"1240541000000107","system":"system"},{"code":"1240431000000104","system":"system"},{"code":"1240741000000103 2019-nCoV","system":"system"},{"code":"1240491000000103","system":"system"},{"code":"1240511000000106","system":"system"},{"code":"1240461000000109","system":"system"},{"code":"1240471000000102","system":"system"},{"code":"1240451000000106","system":"system"},{"code":"1240421000000101","system":"system"},{"code":"1240661000000107","system":"system"},{"code":"1240651000000109","system":"system"},{"code":"1240781000000106","system":"system"},{"code":"1240681000000103","system":"system"},{"code":"1240671000000100","system":"system"},{"code":"1240701000000101","system":"system"},{"code":"1240731000000107","system":"system"},{"code":"1240721000000105","system":"system"},{"code":"1240711000000104","system":"system"},{"code":"1240761000000102","system":"system"},{"code":"1240401000000105","system":"system"},{"code":"1240391000000107","system":"system"},{"code":"1240411000000107","system":"system"},{"code":"1300671000000104","system":"system"},{"code":"1321071000000107","system":"system"},{"code":"1321081000000109","system":"system"},{"code":"1321091000000106","system":"system"},{"code":"1300591000000101","system":"system"},{"code":"1300571000000100","system":"system"},{"code":"1300561000000107","system":"system"},{"code":"1300631000000101","system":"system"},{"code":"1300681000000102","system":"system"},{"code":"1321161000000104","system":"system"},{"code":"1321131000000109","system":"system"},{"code":"1321141000000100","system":"system"},{"code":"1321151000000102","system":"system"},{"code":"1321231000000101","system":"system"},{"code":"1321061000000100","system":"system"},{"code":"1320971000000102","system":"system"},{"code":"1300721000000109","system":"system"},{"code":"1300731000000106","system":"system"},{"code":"1321101000000103","system":"system"},{"code":"1321111000000101","system":"system"},{"code":"1321121000000107","system":"system"},{"code":"1321221000000103","system":"system"},{"code":"1321171000000106","system":"system"},{"code":"1321031000000105","system":"system"},{"code":"1321041000000101","system":"system"},{"code":"1321051000000103","system":"system"},{"code":"1321201000000107","system":"system"},{"code":"1321211000000109","system":"system"},{"code":"1321191000000105","system":"system"},{"code":"1321181000000108","system":"system"},{"code":"1240511000000100","system":"system"},{"code":"1008541000000100","system":"system"}];

with open(sys.argv[1], 'r') as file_in, open('covid-potential-cases.csv', 'w', newline='') as file_out:
    csv_reader = csv.DictReader(file_in)
    csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["snomed-uk-identified"])
    csv_writer.writeheader();
    for row in csv_reader:
        newRow = row.copy();
        for cell in row:
            if ([value for value in row[cell].split(",") if value in list(map(lambda code: code['code'], codes))]):
                newRow["snomed-uk-identified"] = "CASE";
                break;
            else:
                newRow["snomed-uk-identified"] = "UNK";
        csv_writer.writerow(newRow)
