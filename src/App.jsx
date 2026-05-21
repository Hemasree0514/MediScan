import { useEffect, useMemo, useRef, useState } from "react";
import { answerLocally } from "./services/assistant";
import { buildScanResult } from "./services/parser";
import { loadLocal, saveLocal } from "./services/storage";

const HISTORY_KEY = "mediscan_history_v2";
const REMINDERS_KEY = "mediscan_reminders_v2";

const SCREENS = {
  SCAN: "scan",
  RESULT: "result",
  HISTORY: "history",
  REMINDERS: "reminders",
  HELP: "help",
};

const emptyManualMedicine = {
  name: "",
  dose: "",
  frequency: "",
  duration: "",
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2400);
    return () => clearTimeout(timer);
  }, [onClose]);

  return <div className="toast">{message}</div>;
}

function ConfidenceBadge({ value }) {
  return <span className={`badge badge-${String(value).replace(" ", "-")}`}>{value}</span>;
}

function Header({ screen, setScreen }) {
  const tabs = [
    ["Scan", SCREENS.SCAN],
    ["History", SCREENS.HISTORY],
    ["Reminders", SCREENS.REMINDERS],
    ["Help", SCREENS.HELP],
  ];

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Free local-first prescription reader</p>
        <h1>MediScan</h1>
      </div>
      <nav className="tabs" aria-label="Main navigation">
        {tabs.map(([label, id]) => (
          <button className={screen === id ? "active" : ""} key={id} onClick={() => setScreen(id)}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function MedicineCard({ medicine, onConfirm, onRemove }) {
  return (
    <article className="medicine-card">
      <div className="card-topline">
        <div>
          <h3>{medicine.name}</h3>
          <p>{medicine.category || "Manually added medicine"}</p>
        </div>
        {medicine.confirmed ? <span className="status-good">Confirmed</span> : <span className="status-warn">Check</span>}
      </div>

      <div className="pill-row">
        {medicine.dose && <span>{medicine.dose}</span>}
        {medicine.frequency && <span>{medicine.frequency}</span>}
        {medicine.duration && <span>{medicine.duration}</span>}
      </div>

      {medicine.sourceLine && (
        <div className="source-line">
          OCR line: <span>{medicine.sourceLine}</span>
        </div>
      )}

      {medicine.uses && <p className="body-text">{medicine.uses}</p>}
      {medicine.warnings && <p className="warning-text">{medicine.warnings}</p>}

      <div className="card-actions">
        <button onClick={onConfirm}>{medicine.confirmed ? "Mark unchecked" : "Confirm"}</button>
        <button className="danger-light" onClick={onRemove}>Remove</button>
      </div>
    </article>
  );
}

function ScanScreen({ onResult, setToast }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [backendError, setBackendError] = useState("");

  async function chooseFile(file) {
    if (!file) return;
    setSelectedFile(file);
    setPreview(await fileToDataUrl(file));
    setRawText("");
    setBackendError("");
  }

  async function runOcr() {
    if (!selectedFile) {
      setToast("Choose or capture a prescription first.");
      return;
    }

    setLoading(true);
    setProgress("Sending image to local PaddleOCR backend...");
    setBackendError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "OCR request failed.");
      }

      setProgress("OCR complete. Building local medicine matches...");
      const text = data.text || "";
      setRawText(text);
      onResult(buildScanResult({ rawText: text, imagePreview: preview }));
      setToast("OCR completed. Please verify the result.");
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  function useManualText() {
    if (!rawText.trim()) {
      setToast("Paste OCR text or type prescription text first.");
      return;
    }

    onResult(buildScanResult({ rawText, imagePreview: preview }));
  }

  return (
    <section className="screen">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">PaddleOCR pipeline</p>
          <h2>Scan a prescription without paid APIs</h2>
          <p>
            Upload or capture an image. The image goes to your local Python backend, PaddleOCR extracts text,
            and this app matches medicines from its local database.
          </p>
        </div>
        <div className="hero-status">No cloud AI key needed</div>
      </div>

      <div className="action-grid">
        <button className="primary-tile" onClick={() => fileInputRef.current?.click()}>
          <strong>Upload image</strong>
          <span>JPG, PNG, WEBP</span>
        </button>
        <button className="secondary-tile" onClick={() => cameraInputRef.current?.click()}>
          <strong>Use camera</strong>
          <span>Best on mobile</span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => chooseFile(event.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => chooseFile(event.target.files?.[0])} />

      {preview && (
        <div className="preview-wrap">
          <img src={preview} alt="Selected prescription" />
        </div>
      )}

      <div className="panel">
        <div className="panel-title">
          <h3>Extracted text</h3>
          <span>Edit before building result</span>
        </div>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder="OCR text will appear here. You can also paste/type text manually for testing."
        />
      </div>

      {backendError && (
        <div className="error-box">
          <strong>Backend/OCR issue:</strong> {backendError}
          <p>Make sure the FastAPI backend is running on port 8000.</p>
        </div>
      )}

      {progress && <div className="progress-box">{progress}</div>}

      <div className="sticky-actions">
        <button className="primary-button" disabled={loading || !selectedFile} onClick={runOcr}>
          {loading ? "Scanning..." : "Run PaddleOCR"}
        </button>
        <button className="plain-button" onClick={useManualText}>Build from text</button>
      </div>
    </section>
  );
}

function ResultScreen({ result, setResult, saveResult, addReminders, setToast }) {
  const [manual, setManual] = useState(emptyManualMedicine);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);

  const confirmedCount = useMemo(
    () => result?.medicines?.filter((medicine) => medicine.confirmed).length || 0,
    [result]
  );

  if (!result) {
    return (
      <section className="empty-state">
        <h2>No scan yet</h2>
        <p>Start with the Scan tab and run OCR on a prescription image.</p>
      </section>
    );
  }

  function updateMedicines(nextMedicines) {
    setResult({ ...result, medicines: nextMedicines });
  }

  function toggleConfirm(index) {
    updateMedicines(
      result.medicines.map((medicine, i) =>
        i === index ? { ...medicine, confirmed: !medicine.confirmed } : medicine
      )
    );
  }

  function removeMedicine(index) {
    updateMedicines(result.medicines.filter((_, i) => i !== index));
  }

  function addManualMedicine() {
    if (!manual.name.trim()) {
      setToast("Medicine name is required.");
      return;
    }

    updateMedicines([
      ...result.medicines,
      {
        ...manual,
        name: manual.name.trim(),
        category: "Manual entry",
        uses: "",
        sideEffects: "",
        warnings: "Manual entry. Verify this medicine with the prescription or pharmacist.",
        confirmed: false,
      },
    ]);
    setManual(emptyManualMedicine);
  }

  function askAssistant() {
    if (!question.trim()) return;
    const userMessage = question.trim();
    const reply = answerLocally(userMessage, result);
    setChat([...chat, { role: "user", text: userMessage }, { role: "assistant", text: reply }]);
    setQuestion("");
  }

  return (
    <section className="screen">
      <div className="result-header">
        <div>
          <p className="eyebrow">OCR result</p>
          <h2>Verify before using</h2>
        </div>
        <ConfidenceBadge value={result.confidence} />
      </div>

      <div className="safety-box">
        This app can misread prescriptions. Confirm medicine names, dosage, and timing before saving reminders.
        For medical decisions, ask a doctor or pharmacist.
      </div>

      <div className="summary-grid">
        <div>
          <strong>{result.medicines.length}</strong>
          <span>detected</span>
        </div>
        <div>
          <strong>{confirmedCount}</strong>
          <span>confirmed</span>
        </div>
        <div>
          <strong>{result.rawText.length}</strong>
          <span>text chars</span>
        </div>
      </div>

      <div className="section-title">
        <h3>Detected medicines</h3>
        <button onClick={() => saveResult(result)}>Save scan</button>
      </div>

      {result.medicines.length === 0 ? (
        <div className="empty-card">
          No medicine matched the local database. Add medicines manually from the prescription text.
        </div>
      ) : (
        result.medicines.map((medicine, index) => (
          <MedicineCard
            key={`${medicine.name}-${index}`}
            medicine={medicine}
            onConfirm={() => toggleConfirm(index)}
            onRemove={() => removeMedicine(index)}
          />
        ))
      )}

      <div className="panel">
        <div className="panel-title">
          <h3>Add medicine manually</h3>
          <span>Useful when OCR misses handwriting</span>
        </div>
        <div className="form-grid">
          <input placeholder="Medicine name" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} />
          <input placeholder="Dose e.g. 500 mg" value={manual.dose} onChange={(event) => setManual({ ...manual, dose: event.target.value })} />
          <input placeholder="Frequency e.g. twice daily" value={manual.frequency} onChange={(event) => setManual({ ...manual, frequency: event.target.value })} />
          <input placeholder="Duration e.g. 5 days" value={manual.duration} onChange={(event) => setManual({ ...manual, duration: event.target.value })} />
        </div>
        <button className="plain-button" onClick={addManualMedicine}>Add manual medicine</button>
      </div>

      <div className="section-title">
        <h3>Local assistant</h3>
        <span>No chatbot API used</span>
      </div>
      <div className="assistant-box">
        <div className="chat-log">
          {chat.length === 0 ? (
            <p className="muted">Ask: side effects, what is this for, dosage, warnings, when to take.</p>
          ) : (
            chat.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                {message.text}
              </div>
            ))
          )}
        </div>
        <div className="chat-input">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && askAssistant()}
            placeholder="Ask about detected medicines"
          />
          <button onClick={askAssistant}>Ask</button>
        </div>
      </div>

      <details className="raw-text">
        <summary>Raw OCR text</summary>
        <pre>{result.rawText || "No text extracted."}</pre>
      </details>

      <button className="primary-button" onClick={() => addReminders(result)}>
        Create reminders from confirmed medicines
      </button>
    </section>
  );
}
function HistoryScreen({ history, openResult, clearHistory }) {
  return (
    <section className="screen">
      <div className="section-title">
        <h2>Scan history</h2>
        {history.length > 0 && <button onClick={clearHistory}>Clear all</button>}
      </div>
      {history.length === 0 ? (
        <div className="empty-state">
          <h3>No saved scans</h3>
          <p>Saved scans stay in this browser only.</p>
        </div>
      ) : (
        history.map((entry) => (
          <button className="history-item" key={entry.id} onClick={() => openResult(entry)}>
            {entry.imagePreview && <img src={entry.imagePreview} alt="" />}
            <span>
              <strong>{entry.medicines.length} medicine(s)</strong>
              <small>{entry.createdAt}</small>
            </span>
            <ConfidenceBadge value={entry.confidence} />
          </button>
        ))
      )}
    </section>
  );
}

function RemindersScreen({ reminders, setReminders, setToast }) {
  const [draft, setDraft] = useState({ medicine: "", dose: "", time: "08:00", note: "" });

  function save(next) {
    setReminders(next);
    saveLocal(REMINDERS_KEY, next);
  }

  function addReminder() {
    if (!draft.medicine.trim()) {
      setToast("Medicine name is required.");
      return;
    }
    save([...reminders, { ...draft, id: Date.now(), active: true }]);
    setDraft({ medicine: "", dose: "", time: "08:00", note: "" });
  }

  return (
    <section className="screen">
      <div className="section-title">
        <h2>Reminders</h2>
        <span>Stored locally</span>
      </div>
      <div className="panel">
        <div className="form-grid">
          <input placeholder="Medicine" value={draft.medicine} onChange={(event) => setDraft({ ...draft, medicine: event.target.value })} />
          <input placeholder="Dose" value={draft.dose} onChange={(event) => setDraft({ ...draft, dose: event.target.value })} />
          <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          <input placeholder="Note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </div>
        <button className="plain-button" onClick={addReminder}>Add reminder</button>
      </div>

      {reminders.length === 0 ? (
        <div className="empty-card">No reminders yet.</div>
      ) : (
        reminders.map((reminder) => (
          <article className={`reminder-card ${reminder.active ? "" : "inactive"}`} key={reminder.id}>
            <div>
              <h3>{reminder.medicine}</h3>
              <p>{[reminder.dose, reminder.note].filter(Boolean).join(" - ") || "As prescribed"}</p>
            </div>
            <strong>{reminder.time}</strong>
            <button onClick={() => save(reminders.map((item) => item.id === reminder.id ? { ...item, active: !item.active } : item))}>
              {reminder.active ? "On" : "Off"}
            </button>
            <button className="danger-light" onClick={() => save(reminders.filter((item) => item.id !== reminder.id))}>
              Delete
            </button>
          </article>
        ))
      )}
    </section>
  );
}

function HelpScreen() {
  return (
    <section className="screen">
      <div className="panel readable">
        <h2>How this project works</h2>
        <p>
          This version avoids paid AI APIs. The React app handles the mobile interface, history, reminders,
          medicine matching, and local assistant. The Python backend handles OCR using PaddleOCR.
        </p>
        <ol>
          <li>Run the Python backend on your laptop or server.</li>
          <li>Run the Vite React frontend.</li>
          <li>Open the app from your phone using the laptop IP address on the same Wi-Fi.</li>
          <li>Upload or capture a prescription image.</li>
          <li>Verify OCR results before saving reminders.</li>
        </ol>
      </div>
      <div className="panel readable">
        <h3>Important limitation</h3>
        <p>
          PaddleOCR is free and strong for many printed documents, but handwritten prescriptions can still be
          wrong. That is why this app requires confirmation and manual editing.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SCAN);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => loadLocal(HISTORY_KEY, []));
  const [reminders, setReminders] = useState(() => loadLocal(REMINDERS_KEY, []));
  const [toast, setToast] = useState("");

  function saveResult(scan) {
    const next = [scan, ...history.filter((item) => item.id !== scan.id)].slice(0, 25);
    setHistory(next);
    saveLocal(HISTORY_KEY, next);
    setToast("Scan saved locally.");
  }

  function openResult(scan) {
    setResult(scan);
    setScreen(SCREENS.RESULT);
  }

  function handleNewResult(scan) {
    setResult(scan);
    setScreen(SCREENS.RESULT);
  }

  function addReminders(scan) {
    const confirmed = scan.medicines.filter((medicine) => medicine.confirmed);
    if (!confirmed.length) {
      setToast("Confirm at least one medicine first.");
      return;
    }

    const next = [
      ...reminders,
      ...confirmed.map((medicine) => ({
        id: Date.now() + Math.random(),
        medicine: medicine.name,
        dose: medicine.dose || "As prescribed",
        time: medicine.frequency?.toLowerCase().includes("night") ? "21:00" : "08:00",
        note: medicine.frequency || medicine.duration || "",
        active: true,
      })),
    ];

    setReminders(next);
    saveLocal(REMINDERS_KEY, next);
    setToast(`${confirmed.length} reminder(s) created.`);
    setScreen(SCREENS.REMINDERS);
  }

  return (
    <main className="app-shell">
      <Header screen={screen} setScreen={setScreen} />

      {screen === SCREENS.SCAN && <ScanScreen onResult={handleNewResult} setToast={setToast} />}
      {screen === SCREENS.RESULT && (
        <ResultScreen
          result={result}
          setResult={setResult}
          saveResult={saveResult}
          addReminders={addReminders}
          setToast={setToast}
        />
      )}
      {screen === SCREENS.HISTORY && (
        <HistoryScreen
          history={history}
          openResult={openResult}
          clearHistory={() => {
            setHistory([]);
            saveLocal(HISTORY_KEY, []);
            setToast("History cleared.");
          }}
        />
      )}
      {screen === SCREENS.REMINDERS && (
        <RemindersScreen reminders={reminders} setReminders={setReminders} setToast={setToast} />
      )}
      {screen === SCREENS.HELP && <HelpScreen />}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </main>
  );
}
