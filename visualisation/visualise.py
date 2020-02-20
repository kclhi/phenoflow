import requests

headers = {'accept': 'application/json'}
payload = {
    "url": "http://git-server:7005/workflows.git",
    "branch": "master",
    "path": "/compile1.cwl"
}
r = requests.post("http://localhost:8080/workflows", headers=headers, data=payload)
print(r.text)
