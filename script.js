
"use strict";

/* =====================================================
   CUBETIME — SPEEDCUBING TIMER
   HTML + CSS + JavaScript puro
   Armazenamento: localStorage
   ===================================================== */

/*
  IMPORTANTE:
  Os scrambles abaixo são geradores simplificados para treino.
  Eles NÃO são equivalentes aos geradores oficiais da WCA.
*/

// =====================================================
// 1. EVENTOS
// =====================================================

const EVENTS = [
  { id: "222", name: "2×2×2 Cube", type: "222" },
  { id: "333", name: "3×3×3 Cube", type: "333" },
  { id: "444", name: "4×4×4 Cube", type: "big" },
  { id: "555", name: "5×5×5 Cube", type: "big" },
  { id: "666", name: "6×6×6 Cube", type: "big" },
  { id: "777", name: "7×7×7 Cube", type: "big" },
  { id: "333bf", name: "3×3×3 Blindfolded", type: "333" },
  { id: "333fm", name: "3×3×3 Fewest Moves", type: "333" },
  { id: "333oh", name: "3×3×3 One-Handed", type: "333" },
  { id: "clock", name: "Clock", type: "clock" },
  { id: "minx", name: "Megaminx", type: "minx" },
  { id: "pyram", name: "Pyraminx", type: "pyram" },
  { id: "skewb", name: "Skewb", type: "skewb" },
  { id: "sq1", name: "Square-1", type: "sq1" },
  { id: "444bf", name: "4×4×4 Blindfolded", type: "big" },
  { id: "555bf", name: "5×5×5 Blindfolded", type: "big" },
  { id: "333mbf", name: "3×3×3 Multi-Blind", type: "333" }
];

const STORAGE_KEY = "cubetime-data-v2";
const HOLD_MS = 300;
const INSPECTION_MS = 15000;
const INSPECTION_DNF_MS = 17000;

// =====================================================
// 2. ELEMENTOS HTML
// =====================================================

const $ = id => document.getElementById(id);

const eventSelect = $("eventSelect");
const timerEl = $("timer");
const timerHint = $("timerHint");
const inspectionLabel = $("inspectionLabel");
const scrambleEl = $("scramble");
const scrambleHint = $("scrambleHint");
const historyEl = $("history");
const timerArea = $("timerArea");

// =====================================================
// 3. ESTADO DO SITE
// =====================================================

let db = loadDatabase();

let currentEvent = db.currentEvent || "333";
let currentSessionId = null;

let phase = "idle";
// idle | inspection | holding | running

let startTime = 0;
let inspectionStart = 0;
let inspectionElapsed = 0;
let holdStarted = 0;
let holdReady = false;

let inspectionPenalty = false;

let rafId = 0;
let holdTimeout = null;
let toastTimeout = null;

let currentScramble = "";
let selectedSolveId = null;

let spaceDown = false;
let pointerDown = false;
let pointerIsTouch = false;

// =====================================================
// 4. ARMAZENAMENTO E RECUPERAÇÃO DOS DADOS
// =====================================================

function createDefaultDatabase() {
  const sessions = {};
  const solves = {};

  EVENTS.forEach(event => {
    const firstSession = {
      id: "session-1",
      name: "Sessão principal",
      created: Date.now()
    };

    sessions[event.id] = {
      active: firstSession.id,
      list: [firstSession]
    };

    solves[event.id] = {
      [firstSession.id]: []
    };
  });

  return {
    version: 2,
    currentEvent: "333",
    sessions,
    solves,
    inspection: true,
    theme: "dark"
  };
}

function loadDatabase() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      saved &&
      saved.sessions &&
      saved.solves &&
      typeof saved.sessions === "object" &&
      typeof saved.solves === "object"
    ) {
      // Garante que todos os eventos tenham dados.
      EVENTS.forEach(event => {
        if (!saved.sessions[event.id]) {
          saved.sessions[event.id] = {
            active: "session-1",
            list: [{
              id: "session-1",
              name: "Sessão principal",
              created: Date.now()
            }]
          };
        }

        if (!Array.isArray(saved.sessions[event.id].list)) {
          saved.sessions[event.id].list = [{
            id: "session-1",
            name: "Sessão principal",
            created: Date.now()
          }];
        }

        if (!saved.solves[event.id]) {
          saved.solves[event.id] = {};
        }

        saved.sessions[event.id].list.forEach(session => {
          if (!Array.isArray(saved.solves[event.id][session.id])) {
            saved.solves[event.id][session.id] = [];
          }
        });

        const sessionData = saved.sessions[event.id];

        if (!sessionData.list.some(s => s.id === sessionData.active)) {
          sessionData.active = sessionData.list[0].id;
        }
      });

      if (!EVENTS.some(e => e.id === saved.currentEvent)) {
        saved.currentEvent = "333";
      }

      return saved;
    }
  } catch (error) {
    console.warn("Erro ao carregar os dados salvos:", error);
  }

  return createDefaultDatabase();
}

function saveDatabase() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error("Erro ao salvar os dados:", error);
    showToast("Não foi possível salvar os dados.");
    return false;
  }
}

function ensureEventData(eventId) {
  if (!db.sessions[eventId]) {
    const session = {
      id: "session-1",
      name: "Sessão principal",
      created: Date.now()
    };

    db.sessions[eventId] = {
      active: session.id,
      list: [session]
    };
  }

  if (!db.solves[eventId]) {
    db.solves[eventId] = {};
  }

  db.sessions[eventId].list.forEach(session => {
    if (!Array.isArray(db.solves[eventId][session.id])) {
      db.solves[eventId][session.id] = [];
    }
  });
}

function activeSession() {
  ensureEventData(currentEvent);

  const data = db.sessions[currentEvent];

  return (
    data.list.find(session => session.id === data.active) ||
    data.list[0]
  );
}

function currentSolves() {
  const session = activeSession();

  return db.solves[currentEvent][session.id];
}

// =====================================================
// 5. GERADORES DE SCRAMBLES PARA TREINO
// =====================================================

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function pick(array) {
  return array[randomInt(array.length)];
}

function generate333(length = 20) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];
  const moves = [];

  let previousFace = "";

  while (moves.length < length) {
    const face = pick(faces);

    if (face === previousFace) continue;

    moves.push(face + pick(suffixes));
    previousFace = face;
  }

  return moves.join(" ");
}

function generate222() {
  const faces = ["R", "U", "F"];
  const suffixes = ["", "'", "2"];
  const moves = [];

  let previousFace = "";

  while (moves.length < 11) {
    const face = pick(faces);

    if (face === previousFace) continue;

    moves.push(face + pick(suffixes));
    previousFace = face;
  }

  return moves.join(" ");
}

function generateBig(size) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];
  const moves = [];

  let previousFace = "";
  const length = size * 10 + 10;

  while (moves.length < length) {
    const face = pick(faces);

    if (face === previousFace) continue;

    let prefix = "";

    if (Math.random() < 0.45) {
      prefix = size >= 6
        ? pick(["2", "3"]) + "w"
        : "w";
    }

    moves.push(prefix + face + pick(suffixes));
    previousFace = face;
  }

  return moves.join(" ");
}

function generatePyraminx() {
  const faces = ["U", "L", "R", "B"];
  const suffixes = ["", "'"];
  const moves = [];

  let previousFace = "";

  while (moves.length < 11) {
    const face = pick(faces);

    if (face === previousFace) continue;

    moves.push(face + pick(suffixes));
    previousFace = face;
  }

  ["u", "l", "r", "b"].forEach(face => {
    if (Math.random() < 0.65) {
      moves.push(face + pick(suffixes));
    }
  });

  return moves.join(" ");
}

function generateSkewb() {
  const faces = ["R", "L", "U", "B"];
  const suffixes = ["", "'"];
  const moves = [];

  let previousFace = "";

  while (moves.length < 11) {
    const face = pick(faces);

    if (face === previousFace) continue;

    moves.push(face + pick(suffixes));
    previousFace = face;
  }

  return moves.join(" ");
}

function generateMinx() {
  const rounds = [];

  for (let i = 0; i < 7; i++) {
    const row = [];

    for (let j = 0; j < 10; j++) {
      row.push(
        pick(["R++", "R--"]) + " " +
        pick(["D++", "D--"])
      );
    }

    row.push(pick(["U", "U'"]));
    rounds.push(row.join(" "));
  }

  return rounds.join("\n");
}

function generateClock() {
  const positions = [
    "UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"
  ];

  const moves = [];

  positions.forEach(position => {
    moves.push(
      position +
      pick(["+", "-"]) +
      (randomInt(6) + 1)
    );
  });

  moves.push("y2");

  ["U", "R", "D", "L"].forEach(position => {
    moves.push(
      position +
      pick(["+", "-"]) +
      (randomInt(6) + 1)
    );
  });

  return moves.join(" ");
}

function generateSquare1() {
  const moves = [];

  for (let i = 0; i < 12; i++) {
    let a = randomInt(12) - 5;
    let b = randomInt(12) - 5;

    if (a === 0 && b === 0) a = 1;

    moves.push(`(${a},${b})`);

    if (i < 11) moves.push("/");
  }

  return moves.join(" ");
}

function generateScramble(eventId) {
  const event = EVENTS.find(item => item.id === eventId);

  if (!event) return generate333();

  switch (event.type) {
    case "222":
      return generate222();

    case "333":
      return generate333();

    case "big":
      return generateBig(Number(eventId[0]) || 4);

    case "pyram":
      return generatePyraminx();

    case "skewb":
      return generateSkewb();

    case "minx":
      return generateMinx();

    case "clock":
      return generateClock();

    case "sq1":
      return generateSquare1();

    default:
      return generate333();
  }
}

function newScramble() {
  if (phase === "running" || phase === "holding") {
    showToast("Pare o cronômetro antes de trocar o scramble.");
    return;
  }

  currentScramble = generateScramble(currentEvent);

  scrambleEl.textContent = currentScramble;

  scrambleHint.textContent =
    "Scramble de treino · não validado pela WCA";
}

// =====================================================
// 6. FORMATAÇÃO DE TEMPO
// =====================================================

function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "DNF";

  const centiseconds = Math.floor(milliseconds / 10);
  const cs = centiseconds % 100;
  const totalSeconds = Math.floor(centiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const secText = String(seconds).padStart(2, "0");
  const csText = String(cs).padStart(2, "0");

  if (minutes > 0) {
    return `${minutes}:${secText}.${csText}`;
  }

  return `${totalSeconds}.${csText}`;
}

function effectiveTime(solve) {
  if (solve.penalty === "DNF") return Infinity;

  return solve.time + (solve.penalty === "+2" ? 2000 : 0);
}

function displaySolve(solve) {
  if (solve.penalty === "DNF") return "DNF";

  const formatted = formatTime(solve.time);

  return solve.penalty === "+2"
    ? `${formatted}+`
    : formatted;
}

// =====================================================
// 7. MÉDIAS E ESTATÍSTICAS
// =====================================================

function calculateMean(solves) {
  const valid = solves.filter(solve => solve.penalty !== "DNF");

  if (!valid.length) return null;

  const total = valid.reduce(
    (sum, solve) => sum + effectiveTime(solve),
    0
  );

  return total / valid.length;
}

function calculateAverage(solves, size) {
  if (solves.length < size) return null;

  const recent = solves.slice(-size);

  const values = recent
    .map(effectiveTime)
    .sort((a, b) => a - b);

  const trim = size === 5 ? 1 : 2;

  // Remove os piores e os melhores resultados.
  const remaining = values.slice(trim, size - trim);

  if (remaining.some(value => !Number.isFinite(value))) {
    return Infinity;
  }

  return remaining.reduce((sum, value) => sum + value, 0) /
    remaining.length;
}

function formatAverage(value) {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return "DNF";

  return formatTime(value);
}

function renderStats() {
  const solves = currentSolves();

  const valid = solves.filter(solve => solve.penalty !== "DNF");

  const best = valid.length
    ? Math.min(...valid.map(effectiveTime))
    : null;

  $("bestTime").textContent =
    best === null ? "—" : formatTime(best);

  $("ao5").textContent =
    formatAverage(calculateAverage(solves, 5));

  $("ao12").textContent =
    formatAverage(calculateAverage(solves, 12));

  $("meanTime").textContent =
    formatAverage(calculateMean(solves));

  $("solveCount").textContent = solves.length;

  $("sessionName").textContent = activeSession().name;

  $("eventTitle").textContent =
    EVENTS.find(event => event.id === currentEvent)?.name || "Cube";
}

// =====================================================
// 8. HISTÓRICO DE RESOLUÇÕES
// =====================================================

function renderHistory() {
  const solves = currentSolves();

  if (!solves.length) {
    historyEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <strong>Nenhuma resolução ainda</strong>
        <p>Seu primeiro tempo aparecerá aqui.</p>
      </div>
    `;

    updateHistoryButtons();
    return;
  }

  historyEl.innerHTML = "";

  [...solves].reverse().forEach((solve, reverseIndex) => {
    const originalIndex = solves.length - 1 - reverseIndex;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "solve-item";

    const isSelected = solve.id === selectedSolveId;

    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-pressed", String(isSelected));

    const number = document.createElement("span");
    number.className = "solve-number";
    number.textContent = `#${originalIndex + 1}`;

    const time = document.createElement("span");
    time.className = "solve-time";
    time.textContent = displaySolve(solve);

    if (solve.penalty) {
      time.classList.add("penalty");
    }

    item.append(number, time);

    item.addEventListener("click", () => {
      selectedSolveId = solve.id;
      renderHistory();
    });

    historyEl.appendChild(item);
  });

  updateHistoryButtons();
}

function updateHistoryButtons() {
  const solves = currentSolves();

  const selected = solves.find(
    solve => solve.id === selectedSolveId
  );

  $("plusTwoBtn").disabled = !selected;
  $("dnfBtn").disabled = !selected;
  $("deleteBtn").disabled = !selected;
}

function renderAll() {
  renderStats();
  renderHistory();
}

// =====================================================
// 9. CRONÔMETRO
// =====================================================

function displayTimer(milliseconds) {
  timerEl.textContent = formatTime(milliseconds);
}

function cancelAnimation() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function startInspection() {
  cancelAnimation();
  inspectionElapsed = 0;
  inspectionPenalty = false;

  timerEl.classList.remove("running", "ready");

  if (!db.inspection) {
    phase = "holding";
    timerHint.textContent = "Segure e solte para iniciar";
    inspectionLabel.textContent = "";
    return;
  }

  phase = "inspection";
  inspectionStart = performance.now();

  timerEl.textContent = "15";
  timerHint.textContent = "Inspeção: prepare seu cubo";

  updateInspection();
}

function updateInspection() {
  if (phase !== "inspection") return;

  const elapsed = performance.now() - inspectionStart;

  inspectionElapsed = elapsed;

  if (elapsed >= INSPECTION_DNF_MS) {
    stopInspectionAndRecordDNF();
    return;
  }

  if (elapsed >= INSPECTION_MS) {
    inspectionLabel.textContent = "+2";
    timerEl.textContent = "0";
    timerEl.classList.add("ready");
  } else {
    const remaining = INSPECTION_MS - elapsed;
    const seconds = Math.ceil(remaining / 1000);

    inspectionLabel.textContent = `${seconds}s`;
    timerEl.textContent = String(seconds);

    if (remaining <= 2000) {
      timerEl.classList.add("ready");
    } else {
      timerEl.classList.remove("ready");
    }
  }

  rafId = requestAnimationFrame(updateInspection);
}

function beginTimer() {
  cancelAnimation();

  if (phase === "inspection") {
    inspectionElapsed = performance.now() - inspectionStart;

    if (inspectionElapsed >= INSPECTION_DNF_MS) {
      stopInspectionAndRecordDNF();
      return;
    }

    inspectionPenalty = inspectionElapsed >= INSPECTION_MS;
  } else {
    inspectionElapsed = 0;
    inspectionPenalty = false;
  }

  phase = "running";
  startTime = performance.now();

  timerEl.classList.remove("ready");
  timerEl.classList.add("running");

  timerHint.textContent = "Resolvendo…";
  inspectionLabel.textContent = "";

  updateRunningTimer();
}

function updateRunningTimer() {
  if (phase !== "running") return;

  displayTimer(performance.now() - startTime);

  rafId = requestAnimationFrame(updateRunningTimer);
}

function stopTimer() {
  if (phase !== "running") return;

  const elapsed = performance.now() - startTime;

  cancelAnimation();
  phase = "idle";

  timerEl.classList.remove("running", "ready");
  timerHint.textContent = "Pressione espaço para começar";

  recordSolve(elapsed, inspectionPenalty ? "+2" : "");

  displayTimer(elapsed);
}

function stopInspectionAndRecordDNF() {
  if (phase !== "inspection") return;

  cancelAnimation();
  clearTimeout(holdTimeout);

  phase = "idle";

  timerEl.classList.remove("running", "ready");
  timerEl.textContent = "DNF";

  inspectionLabel.textContent = "";
  timerHint.textContent = "Inspeção excedida";

  recordSolve(0, "DNF");
}

function resetTimerDisplay() {
  cancelAnimation();
  clearTimeout(holdTimeout);

  phase = "idle";
  holdReady = false;
  holdStarted = 0;
  inspectionElapsed = 0;
  inspectionPenalty = false;

  timerEl.classList.remove("running", "ready");

  timerEl.textContent = "0.00";
  inspectionLabel.textContent = "";
  timerHint.textContent = "Pressione espaço para começar";
}

// =====================================================
// 10. SEGURAR PARA INICIAR
// =====================================================

function startHold() {
  if (phase === "running" || phase === "holding") return;

  // Primeira pressão: começa a inspeção.
  if (phase === "idle") {
    startInspection();

    if (phase === "inspection") return;
  }

  if (phase !== "inspection" && phase !== "holding") return;

  phase = "holding";
  holdReady = false;
  holdStarted = performance.now();

  timerEl.classList.remove("running");
  timerEl.classList.add("ready");

  timerHint.textContent = "Solte para iniciar";

  clearTimeout(holdTimeout);

  holdTimeout = setTimeout(() => {
    if (phase === "holding") {
      holdReady = true;
      timerHint.textContent = "PRONTO";
    }
  }, HOLD_MS);
}

function releaseHold() {
  if (phase !== "holding") return;

  clearTimeout(holdTimeout);

  if (holdReady) {
    beginTimer();
    return;
  }

  timerEl.classList.remove("ready");

  if (db.inspection) {
    phase = "inspection";
    timerHint.textContent = "Inspeção: prepare seu cubo";
    updateInspection();
  } else {
    phase = "idle";
    timerEl.textContent = "0.00";
    timerHint.textContent = "Segure por 0,3s para iniciar";
  }
}

// =====================================================
// 11. TECLADO
// =====================================================

document.addEventListener("keydown", event => {
  if (event.code === "Space") {
    event.preventDefault();

    if (event.repeat || spaceDown) return;

    // Evita que o teclado interfira com o uso por toque.
    if (pointerIsTouch) return;

    spaceDown = true;

    if (phase === "running") {
      stopTimer();
    } else {
      startHold();
    }

    return;
  }

  const activeTag = document.activeElement?.tagName;

  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(activeTag)
  ) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "r") {
    newScramble();
  }

  if (key === "escape") {
    if (phase !== "running") resetTimerDisplay();
  }

  if (key === "+" || key === "=") {
    applyPenalty("+2");
  }

  if (key === "d") {
    applyPenalty("DNF");
  }

  if (key === "delete" || key === "backspace") {
    deleteSelectedSolve();
  }
});

document.addEventListener("keyup", event => {
  if (event.code !== "Space") return;

  event.preventDefault();

  if (!spaceDown) return;

  spaceDown = false;
  releaseHold();
});

// =====================================================
// 12. TOQUE E MOUSE
// =====================================================

timerArea.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (pointerDown) return;

  event.preventDefault();

  pointerDown = true;
  pointerIsTouch = event.pointerType !== "mouse";

  if (phase === "running") {
    stopTimer();
  } else {
    startHold();
  }
});

document.addEventListener("pointerup", () => {
  if (!pointerDown) return;

  pointerDown = false;
  releaseHold();

  if (pointerIsTouch) {
    setTimeout(() => {
      pointerIsTouch = false;
    }, 150);
  }
});

timerArea.addEventListener("pointercancel", () => {
  pointerDown = false;
  releaseHold();
});

timerArea.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// =====================================================
// 13. REGISTRAR TEMPOS
// =====================================================

function recordSolve(milliseconds, penalty = "") {
  const solve = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    time: Math.max(0, Math.round(milliseconds / 10) * 10),
    penalty,
    scramble: currentScramble,
    date: new Date().toISOString()
  };

  currentSolves().push(solve);

  selectedSolveId = solve.id;

  saveDatabase();
  renderAll();
  newScramble();
}

// =====================================================
// 14. PENALIDADES E EXCLUSÃO
// =====================================================

function applyPenalty(penalty) {
  if (phase !== "idle") {
    showToast("Pare o cronômetro primeiro.");
    return;
  }

  const solves = currentSolves();

  const solve = solves.find(
    item => item.id === selectedSolveId
  );

  if (!solve) {
    showToast("Selecione uma resolução no histórico.");
    return;
  }

  solve.penalty = solve.penalty === penalty ? "" : penalty;

  saveDatabase();
  renderAll();
}

function deleteSelectedSolve() {
  if (phase !== "idle") {
    showToast("Pare o cronômetro primeiro.");
    return;
  }

  const solves = currentSolves();

  const index = solves.findIndex(
    item => item.id === selectedSolveId
  );

  if (index === -1) return;

  solves.splice(index, 1);

  selectedSolveId = solves.length
    ? solves[solves.length - 1].id
    : null;

  saveDatabase();
  renderAll();

  showToast("Resolução excluída.");
}

// =====================================================
// 15. EVENTOS E SESSÕES
// =====================================================

function populateEvents() {
  eventSelect.innerHTML = "";

  EVENTS.forEach(event => {
    const option = document.createElement("option");

    option.value = event.id;
    option.textContent = event.name;

    eventSelect.appendChild(option);
  });

  eventSelect.value = currentEvent;
}

function switchEvent(eventId) {
  if (phase === "running" || phase === "holding") {
    showToast("Pare o cronômetro antes de trocar de evento.");
    eventSelect.value = currentEvent;
    return;
  }

  cancelAnimation();
  clearTimeout(holdTimeout);

  phase = "idle";
  currentEvent = eventId;

  ensureEventData(currentEvent);

  currentSessionId = db.sessions[currentEvent].active;
  db.currentEvent = currentEvent;

  selectedSolveId = null;

  saveDatabase();
  resetTimerDisplay();
  populateEvents();
  renderAll();
  newScramble();
}

function createSession() {
  if (phase !== "idle") {
    showToast("Pare o cronômetro antes de criar uma sessão.");
    return;
  }

  const sessionData = db.sessions[currentEvent];

  const number = sessionData.list.length + 1;

  const session = {
    id: `session-${Date.now()}`,
    name: `Sessão ${number}`,
    created: Date.now()
  };

  sessionData.list.push(session);
  sessionData.active = session.id;

  db.solves[currentEvent][session.id] = [];

  currentSessionId = session.id;
  selectedSolveId = null;

  saveDatabase();
  renderAll();

  showToast("Nova sessão criada.");
}

// =====================================================
// 16. TEMA
// =====================================================

function applyTheme() {
  document.body.classList.toggle(
    "light",
    db.theme === "light"
  );

  $("themeBtn").textContent =
    db.theme === "light" ? "☾" : "☼";
}

function toggleTheme() {
  db.theme = db.theme === "light" ? "dark" : "light";

  applyTheme();
  saveDatabase();
}

// =====================================================
// 17. NOTIFICAÇÕES
// =====================================================

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2400);
}

// =====================================================
// 18. BOTÕES
// =====================================================

$("nextScrambleBtn").addEventListener("click", newScramble);

$("copyScrambleBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentScramble);
    showToast("Scramble copiado!");
  } catch (error) {
    showToast("Não foi possível copiar automaticamente.");
  }
});

$("plusTwoBtn").addEventListener("click", () => {
  applyPenalty("+2");
});

$("dnfBtn").addEventListener("click", () => {
  applyPenalty("DNF");
});

$("deleteBtn").addEventListener("click", deleteSelectedSolve);

$("newSessionBtn").addEventListener("click", createSession);

$("themeBtn").addEventListener("click", toggleTheme);

eventSelect.addEventListener("change", () => {
  switchEvent(eventSelect.value);
});

$("inspectionToggle").checked = db.inspection !== false;

$("inspectionToggle").addEventListener("change", event => {
  db.inspection = event.target.checked;
  saveDatabase();
});

// =====================================================
// 19. SEGURANÇA AO TROCAR DE ABA
// =====================================================

document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase === "running") {
    stopTimer();
  }
});

// =====================================================
// 20. INICIALIZAÇÃO
// =====================================================

ensureEventData(currentEvent);

currentSessionId = db.sessions[currentEvent].active;

populateEvents();
applyTheme();

$("inspectionToggle").checked = db.inspection !== false;

renderAll();
resetTimerDisplay();
newScramble();

saveDatabase();
