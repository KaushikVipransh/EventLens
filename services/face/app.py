"""EventLens face-recognition microservice.

Stateless: given an image, returns detected face bounding boxes + ArcFace
(512-d, L2-normalized) embeddings. No business logic, no DB access.
Detection: RetinaFace; embeddings: ArcFace — both via InsightFace `buffalo_l`.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

MODEL_NAME = os.environ.get("FACE_MODEL", "buffalo_l")
DET_SIZE = int(os.environ.get("FACE_DET_SIZE", "640"))

_state: dict[str, object] = {"model": None}


def _load_model():
    from insightface.app import FaceAnalysis

    # Only load the two models we actually use (detection + recognition),
    # skipping genderage / 2d106 / 3d68 landmarks — halves memory and load time.
    app_model = FaceAnalysis(
        name=MODEL_NAME,
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    # ctx_id=-1 forces CPU.
    app_model.prepare(ctx_id=-1, det_size=(DET_SIZE, DET_SIZE))
    return app_model


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _state["model"] = _load_model()
    yield
    _state["model"] = None


app = FastAPI(title="EventLens Face Service", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "model_loaded": _state["model"] is not None}


@app.post("/detect-embed")
async def detect_embed(request: Request) -> JSONResponse:
    model = _state["model"]
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty request body")

    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    faces = model.get(img)
    result = []
    for f in faces:
        x1, y1, x2, y2 = (float(v) for v in f.bbox)
        result.append(
            {
                "bbox": [x1, y1, x2, y2],
                "detScore": float(f.det_score),
                "embedding": f.normed_embedding.astype(float).tolist(),
            }
        )
    return JSONResponse({"faces": result})
