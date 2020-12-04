# rest, 2020.

import sys, csv, json, urllib.request
from urllib.error import HTTPError
from html.parser import HTMLParser
from html.entities import name2codepoint

def postRequest(url, params):
    req = urllib.request.Request(url, data=bytes(params, encoding="utf-8"));
    req.add_header('content-type', 'application/x-www-form-urlencoded');
    try:
        response = urllib.request.urlopen(req);
    except HTTPError as exception:
        print(exception);
        return None;
    return response.read().decode('utf8');

def identifyCodes(dynamicCodes):
    staticCodes = ["F527.", "F520.", "XE2QD", "Y20ff"];
    codes = staticCodes + dynamicCodes;
    with open(sys.argv[1], 'r') as file_in, open('otitis-potential-cases.csv', 'w', newline='') as file_out:
        csv_reader = csv.DictReader(file_in)
        csv_writer = csv.DictWriter(file_out, csv_reader.fieldnames + ["ctv3-identified"])
        csv_writer.writeheader();
        for row in csv_reader:
            newRow = row.copy();
            for cell in row:
                if ([value for value in row[cell].split(",") if value in codes]):
                    newRow["ctv3-identified"] = "CASE";
                    break;
                else:
                    newRow["ctv3-identified"] = "UNK";
            csv_writer.writerow(newRow);

class UMLSParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for attr in attrs:
            if(attr[0]=="action"):
                tgt = attr[1].rsplit('/', 1)[-1];
                ticket = postRequest("https://utslogin.nlm.nih.gov/cas/v1/tickets/" + tgt, "service=http://umlsks.nlm.nih.gov")
                if(ticket):
                    try:
                        with urllib.request.urlopen("https://uts-ws.nlm.nih.gov/rest/search/current?string=otitis&sabs=RCD,SNOMEDCT_US&returnIdType=code&includeObsolete=true&ticket=" + ticket) as umlsCodesResponse:
                            umlsCodes = [result["ui"] for result in json.loads(umlsCodesResponse.read())["result"]["results"]];
                            identifyCodes(umlsCodes);
                    except HTTPError as exception:
                        print(exception);
                        identifyCodes([]);
                else:
                    identifyCodes([]);

parser = UMLSParser()

API_KEY="";
tgtRequest = postRequest("https://utslogin.nlm.nih.gov/cas/v1/api-key", "apikey="+API_KEY);
if(tgtRequest): parser.feed(tgtRequest);
else: identifyCodes([]);
