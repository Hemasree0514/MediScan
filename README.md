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

## Important Safety Note
OCR can make mistakes, especially with handwritten prescriptions. Users must verify medicine name, dose, and timing before saving reminders. This app is for assistance only and does not replace a doctor or pharmacist.
