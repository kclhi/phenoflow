FROM tiangolo/uvicorn-gunicorn-starlette:python3.11
COPY requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
