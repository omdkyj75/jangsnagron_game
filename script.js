let questions = [];
let currentIndex = 0;
let totalScore = 0;
let currentQuestion = null;

const difficultyOrder = { "하": 1, "중": 2, "상": 3 };

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuestions();
  restoreProgress();
  buildDynamicOptions();
  bindEvents();
  renderQuestion();
  renderScore();
});

async function loadQuestions() {
  try {
    const response = await fetch("questions.json");
    if (!response.ok) {
      throw new Error(`questions.json 로드 실패: ${response.status}`);
    }

    questions = await response.json();

    questions.sort((a, b) => {
      const da = difficultyOrder[a.difficulty] || 99;
      const db = difficultyOrder[b.difficulty] || 99;
      return da - db || a.id - b.id;
    });
  } catch (error) {
    console.error(error);
    alert("questions.json을 불러오지 못했습니다.");
  }
}

function buildDynamicOptions() {
  buildSelectOptions("relation", collectUniqueValues("relationAnswer"), true);
  buildSelectOptions("pattern", collectUniqueValues("patternAnswer"), false);
}

function collectUniqueValues(fieldName) {
  const values = new Set();

  questions.forEach(question => {
    const rawValue = question[fieldName];

    if (Array.isArray(rawValue)) {
      rawValue.forEach(value => {
        const cleaned = String(value || "").trim();
        if (cleaned) values.add(cleaned);
      });
    } else {
      const cleaned = String(rawValue || "").trim();
      if (cleaned) values.add(cleaned);
    }
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b, "ko"));
}

function buildSelectOptions(selectId, values, includeNone = false) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "선택";
  select.appendChild(defaultOption);

  if (includeNone && !values.includes("없음")) {
    values.unshift("없음");
  }

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function bindEvents() {
  const submitBtn = document.getElementById("submitBtn");
  const nextBtn = document.getElementById("nextBtn");
  const restartInlineBtn = document.getElementById("restartInlineBtn");

  if (submitBtn) submitBtn.addEventListener("click", handleSubmit);
  if (nextBtn) nextBtn.addEventListener("click", handleNext);

  if (restartInlineBtn) {
    restartInlineBtn.addEventListener("click", () => {
      const ok = confirm("진행 기록과 점수를 모두 초기화하시겠습니까?");
      if (!ok) return;
      localStorage.removeItem("jangsang_currentIndex");
      localStorage.removeItem("jangsang_totalScore");
      location.reload();
    });
  }
}

function restoreProgress() {
  const savedIndex = localStorage.getItem("jangsang_currentIndex");
  const savedScore = localStorage.getItem("jangsang_totalScore");

  currentIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
  totalScore = savedScore ? parseInt(savedScore, 10) : 0;
}

function saveProgress() {
  localStorage.setItem("jangsang_currentIndex", String(currentIndex));
  localStorage.setItem("jangsang_totalScore", String(totalScore));
}

function renderQuestion() {
  if (!questions.length) return;

  if (currentIndex >= questions.length) {
    renderGameEnd();
    return;
  }

  currentQuestion = questions[currentIndex];

  setText("questionNumber", `${currentQuestion.id}번`);
  setText("difficulty", currentQuestion.difficulty || "-");
  setText("questionText", currentQuestion.question || "문항 설명 없음");

  renderList("symptomsList", currentQuestion.symptoms || []);
  renderList("extraCluesList", currentQuestion.extraClues || []);

  resetInputs();
  hideElement("resultBox");
  showElement("submitBtn");
  hideElement("nextBtn");
}

function renderList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function resetInputs() {
  const ids = [
    "primaryOrgan",
    "secondaryOrgan",
    "relatedBowel",
    "relation",
    "pattern",
    "shortAnswer"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.tagName === "SELECT") {
      el.selectedIndex = 0;
    } else {
      el.value = "";
    }
  });
}

function handleSubmit() {
  if (!currentQuestion) return;

  const userAnswer = {
    primaryOrgan: getValue("primaryOrgan"),
    secondaryOrgan: getValue("secondaryOrgan"),
    relatedBowel: getValue("relatedBowel"),
    relation: getValue("relation"),
    pattern: getValue("pattern"),
    shortAnswer: getValue("shortAnswer").trim()
  };

  const result = gradeAnswer(currentQuestion, userAnswer);
  totalScore += result.score;

  saveProgress();
  renderScore();
  renderResult(currentQuestion, result);

  hideElement("submitBtn");
  showElement("nextBtn");
}

function handleNext() {
  currentIndex += 1;
  saveProgress();
  renderQuestion();
}

function gradeAnswer(question, userAnswer) {
  let score = 0;
  const details = [];

  if (matchesAnswer(userAnswer.primaryOrgan, question.primaryOrganAnswer)) {
    score += 1;
    details.push("주 장부 1점");
  } else {
    details.push("주 장부 0점");
  }

  if (matchesAnswer(userAnswer.secondaryOrgan, question.secondaryOrganAnswer)) {
    score += 1;
    details.push("연계 장부 1점");
  } else {
    details.push("연계 장부 0점");
  }

  if (matchesAnswer(userAnswer.relation, question.relationAnswer)) {
    score += 2;
    details.push("관계 2점");
  } else {
    details.push("관계 0점");
  }

  if (matchesAnswer(userAnswer.pattern, question.patternAnswer)) {
    score += 2;
    details.push("병기 2점");
  } else {
    details.push("병기 0점");
  }

  const shortAnswerMatched = checkKeywords(
    userAnswer.shortAnswer,
    question.shortAnswerKeywords || []
  );

  if (shortAnswerMatched) {
    score += 1;
    details.push("짧은 서술 1점");
  } else {
    details.push("짧은 서술 0점");
  }

  return {
    score,
    details
  };
}

function matchesAnswer(userValue, answerValue) {
  if (Array.isArray(answerValue)) {
    return answerValue.some(answer => normalize(userValue) === normalize(answer));
  }

  if (!answerValue) return false;
  return normalize(userValue) === normalize(answerValue);
}

function checkKeywords(text, keywords) {
  const normalizedText = normalize(text);
  if (!normalizedText) return false;

  return keywords.some(keyword => normalizedText.includes(normalize(keyword)));
}

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function renderResult(question, result) {
  const resultBox = document.getElementById("resultBox");
  if (!resultBox) return;

  const html = `
    <h3>채점 결과</h3>
    <p>이번 문항 점수: ${result.score} / 7</p>
    <ul>
      ${result.details.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
    <hr>
    <p>정답 주 장부: ${escapeHtml(formatAnswer(question.primaryOrganAnswer))}</p>
    <p>정답 연계 장부: ${escapeHtml(formatAnswer(question.secondaryOrganAnswer))}</p>
    <p>정답 관련 부: ${escapeHtml(formatAnswer(question.relatedBowelAnswer))}</p>
    <p>정답 관계: ${escapeHtml(formatAnswer(question.relationAnswer))}</p>
    <p>정답 병기: ${escapeHtml(formatAnswer(question.patternAnswer))}</p>
    <hr>
    <p>해설: ${escapeHtml(question.explanation || "해설 없음")}</p>
  `;

  resultBox.innerHTML = html;
  showElement("resultBox");
}

function formatAnswer(answerValue) {
  if (Array.isArray(answerValue)) {
    return answerValue.join(" / ");
  }
  return answerValue || "-";
}

function renderScore() {
  setText("totalScore", `누적 점수: ${totalScore}`);
}

function renderGameEnd() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <h2>게임 종료</h2>
      <p>최종 점수: ${totalScore}</p>
      <button id="restartBtn" type="button">다시 시작</button>
    </div>
  `;

  const restartBtn = document.getElementById("restartBtn");
  restartBtn.addEventListener("click", () => {
    currentIndex = 0;
    totalScore = 0;
    localStorage.removeItem("jangsang_currentIndex");
    localStorage.removeItem("jangsang_totalScore");
    location.reload();
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "";
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
