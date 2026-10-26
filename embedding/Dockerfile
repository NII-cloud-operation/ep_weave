FROM python:3.12-slim

# Use a CUDA index (e.g. https://download.pytorch.org/whl/cu128) to build a GPU image.
# pip prefers the index's "+cpu"/"+cu128" build over the PyPI one of the same version.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

WORKDIR /app
ENV HF_HOME=/models

COPY requirements.txt ./
RUN pip install --no-cache-dir --extra-index-url ${TORCH_INDEX_URL} -r requirements.txt

COPY embeddinggemma.py ./
# Bake the model into the image so that startup needs no network access.
RUN python -c "from embeddinggemma import create; create(device='cpu')"
COPY app.py ./

USER nobody

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
