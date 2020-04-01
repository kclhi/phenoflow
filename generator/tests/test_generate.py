import unittest
from starlette.testclient import TestClient
from .. import api

class BasicTests(unittest.TestCase):

    def test_generate(self):

        client = TestClient(api.app)
        response = client.post('/generate')
        assert response.status_code == 200


if __name__ == "__main__":
    unittest.main()
