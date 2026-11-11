import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

from embeddinggemma import create


class Document(BaseModel):
    title: str
    text: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = create()
    app.state.lock = threading.Lock()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/embeddings")
def embeddings(document: Document):
    with app.state.lock:
        vector = app.state.engine.text(document.text, title=document.title)
    return {"embedding": vector.tolist()}
