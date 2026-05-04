FROM python:3.10-slim

# create non-root user
RUN useradd -m -u 1000 user
USER user

ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /app

# install dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# copy project
COPY --chown=user . /app

# HF requirement: MUST listen on 7860
CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "7860"]