function medicineSummary(med) {
  return `${med.name}: ${med.uses} Usual note: ${med.usualDose} Warnings: ${med.warnings}`;
}

export function answerLocally(question, scan) {
  const q = question.toLowerCase();
  const medicines = scan?.medicines || [];

  if (!scan) {
    return "Scan a prescription first, then I can help explain the detected medicines.";
  }

  if (!medicines.length) {
    return "I could not confidently detect a medicine from the OCR text. Please check the raw text and add the medicine manually before using reminders.";
  }

  if (q.includes("side") || q.includes("effect")) {
    return medicines.map((med) => `${med.name}: ${med.sideEffects}`).join("\n");
  }

  if (q.includes("use") || q.includes("for") || q.includes("why")) {
    return medicines.map((med) => `${med.name}: ${med.uses}`).join("\n");
  }

  if (q.includes("dose") || q.includes("dosage") || q.includes("how much")) {
    return medicines
      .map((med) => `${med.name}: OCR found "${med.dose || "no clear dose"}". ${med.usualDose}`)
      .join("\n");
  }

  if (q.includes("when") || q.includes("time") || q.includes("food")) {
    return medicines
      .map((med) => {
        const timing = [med.frequency, med.duration].filter(Boolean).join(", ") || "timing was not clear in OCR";
        return `${med.name}: ${timing}. Follow the doctor's prescription and verify with a pharmacist.`;
      })
      .join("\n");
  }

  if (q.includes("stop") || q.includes("skip")) {
    return "Do not stop or skip prescribed medicine without checking with your doctor. This app can explain detected text, but it cannot replace medical advice.";
  }

  if (q.includes("safe") || q.includes("warning") || q.includes("careful")) {
    return medicines.map((med) => `${med.name}: ${med.warnings}`).join("\n");
  }

  return medicines.map(medicineSummary).join("\n\n");
}

