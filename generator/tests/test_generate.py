import unittest, json
from starlette.testclient import TestClient
from api import routes
import oyaml as yaml

class BasicTests(unittest.TestCase):
  def test_generate(self):
    client = TestClient(routes.app)
    response = client.post('/generate');
    assert response.status_code == 200;
  
  @staticmethod
  def generate_twosteps():
    client = TestClient(routes.app)
    response = client.post('/generate', json=[
      {"id":1,"name":"stepName","doc":"doc","type":"type","position":1,"createdAt":"2020-04-02T10:11:47.805Z","updatedAt":"2020-04-02T10:11:47.805Z","workflowId":1,
        "inputs":[
          {"id":1,"doc":"doc","createdAt":"2020-04-02T10:11:47.829Z","updatedAt":"2020-04-02T10:11:47.829Z","stepId":1}
        ],
        "outputs":[
          {"id":1,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.850Z","updatedAt":"2020-04-02T10:11:47.850Z","stepId":1}
        ],
        "implementation":{"id":1,"fileName":"hello-world.py","language":"python","createdAt":"2020-04-02T10:11:47.891Z","updatedAt":"2020-04-02T10:11:47.891Z","stepId":1}
      },
      {"id":2,"name":"stepName","doc":"doc","type":"type","position":2,"createdAt":"2020-04-02T10:11:47.899Z","updatedAt":"2020-04-02T10:11:47.899Z","workflowId":1,
        "inputs":[
          {"id":2,"doc":"doc","createdAt":"2020-04-02T10:11:47.908Z","updatedAt":"2020-04-02T10:11:47.908Z","stepId":2}
        ],
        "outputs":[
          {"id":2,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.915Z","updatedAt":"2020-04-02T10:11:47.915Z","stepId":2}
        ],
        "implementation":{"id":2,"fileName":"hello-world.py","language":"python","createdAt":"2020-04-02T10:11:47.931Z","updatedAt":"2020-04-02T10:11:47.931Z","stepId":2}
      }
    ]);
    return response;

  def test_generate_twosteps(self):
    response = BasicTests.generate_twosteps();
    assert response.status_code == 200;
  
  def test_generate_nested(self):
    twosteps_response = BasicTests.generate_twosteps();
    assert twosteps_response.status_code == 200;
    client = TestClient(routes.app)
    response = client.post('/generate', json=[
      {"id":1,"name":"stepName","doc":"doc","type":"type","position":1,"createdAt":"2020-04-02T10:11:47.805Z","updatedAt":"2020-04-02T10:11:47.805Z","workflowId":1,
        "inputs":[
          {"id":1,"doc":"doc","createdAt":"2020-04-02T10:11:47.829Z","updatedAt":"2020-04-02T10:11:47.829Z","stepId":1}
        ],
        "outputs":[
          {"id":1,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.850Z","updatedAt":"2020-04-02T10:11:47.850Z","stepId":1}
        ],
        "implementation":{"id":1,"fileName":"hello-world-outer.py","language":"python","createdAt":"2020-04-02T10:11:47.891Z","updatedAt":"2020-04-02T10:11:47.891Z","stepId":1}
      },
       {"id":2,"name":"stepName","doc":"doc","type":"type","position":2,"createdAt":"2020-04-02T10:11:47.899Z","updatedAt":"2020-04-02T10:11:47.899Z","workflowId":1,
        "implementation": {
          "steps": [
            {"id":1,"name":"stepName","doc":"doc","type":"type","position":1,"createdAt":"2020-04-02T10:11:47.805Z","updatedAt":"2020-04-02T10:11:47.805Z","workflowId":1,
              "inputs":[
                {"id":1,"doc":"doc","createdAt":"2020-04-02T10:11:47.829Z","updatedAt":"2020-04-02T10:11:47.829Z","stepId":1}
              ],
              "outputs":[
                {"id":1,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.850Z","updatedAt":"2020-04-02T10:11:47.850Z","stepId":1}
              ],
              "implementation":{"id":1,"fileName":"hello-world.py","language":"python","createdAt":"2020-04-02T10:11:47.891Z","updatedAt":"2020-04-02T10:11:47.891Z","stepId":1}
            },
            {"id":2,"name":"stepName","doc":"doc","type":"type","position":2,"createdAt":"2020-04-02T10:11:47.899Z","updatedAt":"2020-04-02T10:11:47.899Z","workflowId":1,
              "inputs":[
                {"id":2,"doc":"doc","createdAt":"2020-04-02T10:11:47.908Z","updatedAt":"2020-04-02T10:11:47.908Z","stepId":2}
              ],
              "outputs":[
                {"id":2,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.915Z","updatedAt":"2020-04-02T10:11:47.915Z","stepId":2}
              ],
              "implementation":{"id":2,"fileName":"hello-world.py","language":"python","createdAt":"2020-04-02T10:11:47.931Z","updatedAt":"2020-04-02T10:11:47.931Z","stepId":2}
            }
          ]
        }
      },
      {"id":3,"name":"stepName","doc":"doc","type":"type","position":3,"createdAt":"2020-04-02T10:11:47.899Z","updatedAt":"2020-04-02T10:11:47.899Z","workflowId":1,
        "inputs":[
          {"id":3,"doc":"doc","createdAt":"2020-04-02T10:11:47.908Z","updatedAt":"2020-04-02T10:11:47.908Z","stepId":3}
        ],
        "outputs":[
          {"id":3,"doc":"doc","extension":"extension","createdAt":"2020-04-02T10:11:47.915Z","updatedAt":"2020-04-02T10:11:47.915Z","stepId":3}
        ],
        "implementation":{"id":3,"fileName":"hello-world-outer.py","language":"python","createdAt":"2020-04-02T10:11:47.931Z","updatedAt":"2020-04-02T10:11:47.931Z","stepId":3}
      }
    ]);
    assert response.status_code == 200;

if __name__ == "__main__":
    unittest.main();
