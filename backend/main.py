import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, ".paddle-cache")
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ.setdefault("HOME", CACHE_DIR)
os.environ.setdefault("USERPROFILE", CACHE_DIR)
os.environ.setdefault("PADDLE_HOME", CACHE_DIR)
os.environ.setdefault("XDG_CACHE_HOME", CACHE_DIR)


app = FastAPI(title="MediScan OCR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_ocr_engine():
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. Run: pip install -r backend/requirements.txt"
        ) from exc

    return PaddleOCR(use_angle_cls=True, lang="en", show_log=False, use_gpu=False)


def parse_paddle_result(result):
    lines = []

    if not result:
        return lines

    # PaddleOCR versions can return either [page] or page directly.
    page = result[0] if len(result) == 1 and isinstance(result[0], list) else result

    for item in page:
        try:
            box, text_info = item
            text, score = text_info
            lines.append(
                {
                    "text": str(text),
                    "confidence": float(score),
                    "box": box,
                }
            )
        except (TypeError, ValueError):
            continue

    return lines


def useful_text_score(lines):
    if not lines:
        return 0

    text = " ".join(line["text"] for line in lines)
    useful_chars = sum(ch.isalnum() for ch in text)
    avg_confidence = sum(line["confidence"] for line in lines) / max(len(lines), 1)
    return useful_chars + (avg_confidence * 80) + (len(lines) * 5)


def write_image(path, image):
    import cv2

    ok = cv2.imwrite(path, image)
    if not ok:
        raise RuntimeError(f"Could not write OCR preprocessing image: {path}")


def create_preprocessed_images(source_path):
    import cv2
    import numpy as np

    image = cv2.imread(source_path)
    if image is None:
        raise RuntimeError("Could not read uploaded image.")

    variants = [("original", source_path)]
    height, width = image.shape[:2]
    scale = 2 if max(height, width) < 1600 else 1
    resized = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, 18, 7, 21)

    sharpened = cv2.filter2D(
        denoised,
        -1,
        kernel=np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32),
    )
    adaptive = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    processed = [
        ("resized", resized),
        ("gray", gray),
        ("sharpened", sharpened),
        ("adaptive", adaptive),
        ("otsu", otsu),
    ]

    for name, img in processed:
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{name}.png")
        temp.close()
        write_image(temp.name, img)
        variants.append((name, temp.name))

    return variants


def run_best_ocr(engine, source_path):
    variants = create_preprocessed_images(source_path)
    attempts = []

    try:
        for variant_name, variant_path in variants:
            result = engine.ocr(variant_path, cls=True)
            lines = parse_paddle_result(result)
            text = "\n".join(line["text"] for line in lines)
            attempts.append(
                {
                    "variant": variant_name,
                    "text": text,
                    "lines": lines,
                    "score": useful_text_score(lines),
                }
            )

        attempts.sort(key=lambda item: item["score"], reverse=True)
        best = attempts[0] if attempts else {"variant": "none", "text": "", "lines": [], "score": 0}
        return best, attempts
    finally:
        for variant_name, variant_path in variants:
            if variant_path != source_path:
                try:
                    os.remove(variant_path)
                except Exception:
                    pass


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/ocr")
async def run_ocr(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    suffix = os.path.splitext(file.filename or "")[1] or ".png"

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(await file.read())
            temp_path = temp.name

        engine = get_ocr_engine()
        best, attempts = run_best_ocr(engine, temp_path)

        return {
            "text": best["text"],
            "lines": best["lines"],
            "lineCount": len(best["lines"]),
            "variant": best["variant"],
            "attempts": [
                {
                    "variant": item["variant"],
                    "lineCount": len(item["lines"]),
                    "score": round(item["score"], 2),
                }
                for item in attempts
            ],
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except Exception:
                pass
