from api.routes import app
import uvicorn

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=3004, ssl_keyfile='certs/generator.key', ssl_certfile='certs/generator.crt');
