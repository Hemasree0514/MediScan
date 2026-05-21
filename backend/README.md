# MediScan OCR Backend

This backend runs OCR locally using PaddleOCR. The React app sends prescription images to `/api/ocr`.

## Setup

Use Python 3.10 or 3.11 for this backend. PaddlePaddle does not currently install on very new Python versions such as Python 3.14.

```bash
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

If `py -3.11` is not detected, use your direct Python path:

```bash
cd backend
"%LOCALAPPDATA%\Programs\Python\Python311\python.exe" -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open the health check:

```text
http://127.0.0.1:8000/api/health
```

## Notes

- The first OCR request can be slow because PaddleOCR loads its models.
- PaddleOCR model files are cached inside `backend/.paddle-cache`.
- This is free to run locally, but it needs Python dependencies installed on the machine running the backend.
- Handwritten prescriptions may still be inaccurate, so the frontend asks users to verify results.
- If `py -3.11` is not found, install Python 3.11 from python.org and enable "Add python.exe to PATH" during setup.
