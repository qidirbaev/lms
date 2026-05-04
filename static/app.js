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
}

async function analyzeCustom() {
  const raw_text = document.getElementById("customText").value;

  setLoading();

  const res = await fetch("/analyze-custom", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({raw_text})
  });

  const data = await res.json();
  renderResult(data);
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