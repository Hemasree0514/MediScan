# MediScan

MediScan is a free local-first prescription reader. It uses a React mobile-friendly frontend, a Python FastAPI backend, PaddleOCR for text extraction, and a local medicine database for basic explanations.

No paid AI API key is required.

## What It Does

- Upload or capture a prescription image.
- Send the image to a local PaddleOCR backend.
- Extract raw prescription text.
- Match medicines from a local database.
- Let the user confirm, remove, or manually add medicines.
- Save scan history in the browser.
- Create local medication reminders.
- Answer basic medicine questions from local data.

## Project Structure

```text
mediscan-ai/
  src/
    App.jsx
    index.css
    data/medicineDb.js
    services/assistant.js
    services/parser.js
    services/storage.js
  backend/
    main.py
    requirements.txt
```

## Run Backend

PaddleOCR needs Python 3.10 or 3.11. It will not install correctly on very new Python versions such as Python 3.14.

```bash
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

If `py -3.11` is not detected on your machine, use the full installed path:

```bash
cd backend
"%LOCALAPPDATA%\Programs\Python\Python311\python.exe" -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Check:

```text
http://127.0.0.1:8000/api/health
```

## Run Frontend

Open a second terminal:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Open On Mobile

Keep laptop and phone on the same Wi-Fi.

Run:

```bash
npm run dev:mobile
```

Find your laptop IP address:

```bash
ipconfig
```

Open this on your phone:

```text
http://YOUR-LAPTOP-IP:5173
```

Example:

```text
http://192.168.1.5:5173
```

## Important Safety Note

OCR can make mistakes, especially with handwritten prescriptions. Users must verify medicine name, dose, and timing before saving reminders. This app is for assistance only and does not replace a doctor or pharmacist.
