import sys
import os
import base64
from pathlib import Path
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel

# Add the parent directory to the path so we can import deglare_pipeline
sys.path.append(str(Path(__file__).parent.parent))

from deglare_pipeline import process_one, DeglareConfig, Report

app = FastAPI(title="Fundus Pro AI Enhancement API")

class EnhanceRequest(BaseModel):
    imageBase64: str

class EnhanceResponse(BaseModel):
    enhancedBase64: str
    report: dict

@app.post("/api/enhance/glare", response_model=EnhanceResponse)
async def enhance_glare(request: EnhanceRequest):
    try:
        # Decode base64
        img_data = base64.b64decode(request.imageBase64)
        np_arr = np.frombuffer(img_data, np.uint8)
        bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if bgr is None:
            raise HTTPException(status_code=400, detail="Invalid image data")

        # Process image
        cfg = DeglareConfig()
        clean, core, rep = process_one(bgr, cfg)

        if rep.status == "failed" or clean is None:
            raise HTTPException(status_code=422, detail=f"Enhancement failed: {rep.reason}")

        # Encode back to base64
        _, buffer = cv2.imencode('.jpg', clean, [int(cv2.IMWRITE_JPEG_QUALITY), 96])
        enhanced_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            "enhancedBase64": enhanced_base64,
            "report": {
                "status": rep.status,
                "reason": rep.reason,
                "core_frac": rep.core_frac,
                "macula_frac": rep.macula_frac
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Fundus Pro AI Enhancement API"}
