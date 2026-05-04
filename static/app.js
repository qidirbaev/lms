function showTab(id) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "dashboard") loadDashboard();
  if (id === "logs") loadLogs();
}

async function loadFeedbacks() {
  const source = document.getElementById("source").value;
  const res = await fetch(`/feedbacks/${source}`);
  const data = await res.json();

  const select = document.getElementById("feedbackSelect");
  select.innerHTML = "";

  data.items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.index;
    option.textContent = `${item.index} | ${item.feedback_id} | ${item.raw_text.slice(0, 80)}`;
    select.appendChild(option);
  });
}

async function analyzeSelected() {
  const source = document.getElementById("source").value;
  const index = document.getElementById("feedbackSelect").value;

  setLoading();

  const res = await fetch("/analyze-file-item", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({source, index})
  });

  const data = await res.json();
  renderResult(data);
  loadDashboard();
}

async function processBatch() {
  const source = document.getElementById("batchSource").value;
  const limit = Number(document.getElementById("batchLimit").value || 30);

  document.getElementById("batchResult").textContent = "Processing batch...";
  setLoading();

  const res = await fetch("/process-batch", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({source, limit})
  });

  const data = await res.json();

  document.getElementById("batchResult").textContent = JSON.stringify(data, null, 2);
  document.getElementById("outputBox").textContent = JSON.stringify(data.dashboard, null, 2);
  document.getElementById("inputBox").textContent = `Processed ${data.success}/${data.requested}`;
  document.getElementById("rawBox").textContent = "Batch mode does not display raw output for every item.";

  loadDashboard();
  loadLogs();
}

async function analyzeCustom() {
  const raw_text = document.getElementById("customText").value;
  const rating = Number(document.getElementById("customRating").value || 4);

  setLoading();

  const res = await fetch("/analyze-custom", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({raw_text, rating})
  });

  const data = await res.json();
  renderResult(data);
  loadDashboard();
}

async function loadDashboard() {
  const res = await fetch("/dashboard");
  const data = await res.json();

  document.getElementById("totalProcessed").textContent = data.total_processed;
  document.getElementById("sentimentCounts").textContent = JSON.stringify(data.sentiment_counts, null, 2);
  document.getElementById("severityCounts").textContent = JSON.stringify(data.severity_counts, null, 2);
  document.getElementById("issueCounts").textContent = JSON.stringify(data.issue_counts, null, 2);
  document.getElementById("latestResults").textContent = JSON.stringify(data.latest, null, 2);
}

async function loadLogs() {
  const res = await fetch("/logs");
  const data = await res.json();

  document.getElementById("logsBox").textContent = data.logs.join("\n");
}

function setLoading() {
  document.getElementById("inputBox").textContent = "Processing...";
  document.getElementById("outputBox").textContent = "Processing...";
  document.getElementById("rawBox").textContent = "Processing...";
}

function renderResult(data) {
  document.getElementById("inputBox").textContent =
    JSON.stringify(data.inputToSystem || data, null, 2);

  document.getElementById("outputBox").textContent =
    JSON.stringify(data.outputFromAI || data, null, 2);

  document.getElementById("rawBox").textContent =
    data.rawModelOutput || "No raw output";
}

loadFeedbacks();
loadDashboard();