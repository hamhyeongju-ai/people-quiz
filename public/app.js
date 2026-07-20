import { firebaseConfig, firebaseEnabled } from "./firebase-config.js";
import { games, packs } from "./game-data.js";

const isHost = document.body.classList.contains("host");
const hostRoot = document.querySelector("#hostRoot");
const screenRoot = document.querySelector("#screenRoot");
const hostTitle = document.querySelector("#hostTitle");
const timerLabel = document.querySelector("#timer");
const scoreLabel = document.querySelector("#scoreLabel");
const roomLabel = document.querySelector("#roomLabel");

const params = new URLSearchParams(window.location.search);
const room = params.get("room") || "family";
if (roomLabel) roomLabel.textContent = `방: ${room}`;

const APP_VERSION = 3;
let firebase = {};
let roomRef = null;
let currentState = null;
let people = [];
let tickTimer = null;

const defaultState = {
  appVersion: APP_VERSION,
  view: "menu",
  game: null,
  category: null,
  duration: 60,
  currentItem: null,
  score: 0,
  pass: 0,
  endAt: null,
  usedIds: {},
  rouletteOptions: [],
  rouletteSpinning: false,
  rouletteRotation: 0,
  updatedAt: Date.now(),
};

const personCategoryMap = {
  "한국 유명인": ["손흥민", "김연아", "유재석", "봉준호", "박지성", "싸이", "이정재", "정호연", "강호동", "김종국", "송중기", "박찬욱", "박세리"],
  "세계 스타": ["마이클 조던", "리오넬 메시", "크리스티아누 호날두", "르브론 제임스", "우사인 볼트", "버락 오바마", "도널드 트럼프", "마릴린 먼로", "찰리 채플린", "테일러 스위프트", "비욘세", "마이클 잭슨", "성룡"],
  "스포츠": ["손흥민", "김연아", "박지성", "마이클 조던", "리오넬 메시", "크리스티아누 호날두", "르브론 제임스", "우사인 볼트", "코비 브라이언트", "타이거 우즈", "세리나 윌리엄스", "로저 페더러", "라파엘 나달", "노바크 조코비치", "네이마르", "킬리안 음바페", "스테판 커리", "샤킬 오닐", "톰 브래디", "무하마드 알리", "마이크 타이슨", "박세리", "스즈키 이치로", "오타니 쇼헤이"],
  "기업인": ["일론 머스크", "빌 게이츠", "스티브 잡스", "제프 베이조스", "마크 저커버그", "워런 버핏", "팀 쿡", "젠슨 황", "순다르 피차이", "사티아 나델라", "잭 마", "리처드 브랜슨", "오프라 윈프리"],
  "정치/역사": ["이순신", "버락 오바마", "도널드 트럼프", "넬슨 만델라", "마하트마 간디", "윈스턴 처칠", "조 바이든", "힐러리 클린턴", "앙겔라 메르켈", "에마뉘엘 마크롱", "저스틴 트뤼도", "시진핑", "블라디미르 푸틴", "볼로디미르 젤렌스키", "마거릿 대처", "존 F. 케네디", "에이브러햄 링컨", "마틴 루터 킹 주니어"],
  "문화예술": ["봉준호", "싸이", "이정재", "정호연", "송중기", "박찬욱", "마릴린 먼로", "찰리 채플린", "테일러 스위프트", "비욘세", "마이클 잭슨", "성룡", "레오나르도 디카프리오", "브래드 피트", "톰 크루즈", "윌 스미스", "로버트 다우니 주니어", "드웨인 존슨", "엠마 왓슨", "안젤리나 졸리", "스칼릿 조핸슨", "메릴 스트립", "아델", "에드 시런", "브루노 마스", "저스틴 비버", "레이디 가가", "리아나", "아리아나 그란데", "셀레나 고메즈", "마돈나", "엘비스 프레슬리", "스티븐 호킹", "마리 퀴리", "아이작 뉴턴", "찰스 다윈", "니콜라 테슬라", "토머스 에디슨", "레오나르도 다 빈치", "빈센트 반 고흐", "파블로 피카소"],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function itemId(game, item) {
  return `${game}:${item.name || item.word || item.question}`;
}

function getCategoryOptions(game) {
  const categories = games[game]?.categories || [];
  const filtered = categories.filter((category) => category !== "전체");
  return filtered.length ? filtered : categories;
}

function getItems(game, category) {
  if (game === "person") {
    if (!category || category === "전체") return people;
    const names = personCategoryMap[category] || [];
    return people.filter((person) => names.includes(person.name));
  }

  const categoryPack = packs[game]?.[category] || [];
  if (game === "goldenbell") return categoryPack.map((item) => ({ ...item, name: item.question }));
  return categoryPack.map((word) => ({ word, name: word }));
}

function getUnusedItem(state) {
  const items = getItems(state.game, state.category);
  const used = new Set(state.usedIds?.[state.game] || []);
  let available = items.filter((item) => !used.has(itemId(state.game, item)));
  const nextUsedIds = clone(state.usedIds || {});

  if (available.length === 0) {
    nextUsedIds[state.game] = [];
    available = items;
  }

  const item = available[Math.floor(Math.random() * available.length)] || null;
  return { item, usedIds: nextUsedIds };
}

async function saveState(nextState) {
  currentState = { ...currentState, ...nextState, updatedAt: Date.now() };
  render();

  if (roomRef && firebase.set) {
    await firebase.set(roomRef, currentState);
    return;
  }

  localStorage.setItem(`party-games:${room}`, JSON.stringify(currentState));
}

async function chooseGame(game) {
  await saveState({
    view: "setup",
    game,
    category: games[game].categories[0],
    duration: games[game].defaultSeconds,
    currentItem: null,
    score: 0,
    pass: 0,
    endAt: null,
    rouletteOptions: [],
    rouletteSpinning: false,
  });
}

async function chooseCategory(category) {
  await saveState({ category });
}

async function openRoulette() {
  const categories = getCategoryOptions(currentState.game);
  await saveState({
    view: "roulette",
    rouletteOptions: categories,
    rouletteSpinning: false,
  });
}

async function spinRoulette() {
  const categories = currentState.rouletteOptions?.length
    ? currentState.rouletteOptions
    : getCategoryOptions(currentState.game);
  const chosen = categories[Math.floor(Math.random() * categories.length)];
  const chosenIndex = categories.indexOf(chosen);
  const segment = 360 / categories.length;
  const targetAngle = 360 - (chosenIndex * segment + segment / 2);
  const rotation = (currentState.rouletteRotation || 0) + 1440 + targetAngle + Math.floor(Math.random() * 16);

  await saveState({
    category: chosen,
    rouletteOptions: categories,
    rouletteRotation: rotation,
    rouletteSpinning: true,
  });

  setTimeout(() => {
    saveState({
      view: "setup",
      category: chosen,
      rouletteSpinning: false,
    });
  }, 2900);
}

async function startRound() {
  const { item, usedIds } = getUnusedItem(currentState);
  await saveState({
    view: "playing",
    currentItem: item,
    score: 0,
    pass: 0,
    usedIds,
    endAt: Date.now() + Number(currentState.duration || games[currentState.game].defaultSeconds) * 1000,
  });
}

async function finishRound() {
  await saveState({ view: "result", endAt: null });
}

async function markResult(kind) {
  if (!currentState?.currentItem) return;

  const usedIds = clone(currentState.usedIds || {});
  const gameUsed = new Set(usedIds[currentState.game] || []);
  gameUsed.add(itemId(currentState.game, currentState.currentItem));
  usedIds[currentState.game] = Array.from(gameUsed);

  const { item, usedIds: nextUsedIds } = getUnusedItem({ ...currentState, usedIds });
  await saveState({
    currentItem: item,
    usedIds: nextUsedIds,
    score: currentState.score + (kind === "correct" ? 1 : 0),
    pass: currentState.pass + (kind === "pass" ? 1 : 0),
  });
}

async function resetUsed() {
  const usedIds = clone(currentState.usedIds || {});
  usedIds[currentState.game] = [];
  await saveState({ usedIds });
}

function renderTimer() {
  const state = currentState || defaultState;
  const remaining = state.endAt ? state.endAt - Date.now() : 0;
  if (timerLabel) timerLabel.textContent = state.view === "playing" ? formatTime(remaining) : "--:--";

  const screenTimer = document.querySelector("#screenTimer");
  if (screenTimer) screenTimer.textContent = state.view === "playing" ? formatTime(remaining) : "";
  if (scoreLabel) scoreLabel.textContent = `정답 ${state.score || 0} · 패스 ${state.pass || 0}`;

  if (isHost && state.view === "playing" && remaining <= 0) finishRound();
}

function button(label, className, action) {
  return `<button type="button" class="${className}" data-action="${action}">${label}</button>`;
}

function gameCards(mode) {
  return Object.entries(games)
    .map(
      ([key, game]) => `
        <button type="button" class="game-card" data-action="game:${key}">
          <span>${game.title}</span>
          <strong>${game.description}</strong>
          ${mode === "screen" ? "<em>눌러서 선택</em>" : ""}
        </button>
      `,
    )
    .join("");
}

function categoryButtons(game, selected) {
  const categoryList = games[game].categories
    .map((category) => {
      const active = category === selected ? "active" : "";
      return `<button type="button" class="chip ${active}" data-action="category:${category}">${category}</button>`;
    })
    .join("");

  return `${categoryList}<button type="button" class="chip random-chip" data-action="roulette">랜덤으로 돌리기</button>`;
}

function renderRouletteWheel(state, includeButton) {
  const options = state.rouletteOptions || [];
  const style = `--count:${options.length}; --rotation:${state.rouletteRotation || 0}deg;`;

  return `
    <div class="wheel-wrap">
      <div class="wheel-pointer"></div>
      <div class="wheel ${state.rouletteSpinning ? "spinning" : ""}" style="${style}">
        ${options
          .map((category, index) => {
            const angle = (360 / options.length) * index;
            return `<span style="--angle:${angle}deg">${category}</span>`;
          })
          .join("")}
      </div>
    </div>
    <p class="answer small-answer">${state.rouletteSpinning ? "돌아가는 중..." : state.category || "랜덤 선택"}</p>
    ${
      includeButton
        ? `<button type="button" class="start-button wheel-button" data-action="spinRoulette" ${state.rouletteSpinning ? "disabled" : ""}>START</button>`
        : ""
    }
  `;
}

function renderHost() {
  const state = currentState || defaultState;
  if (!hostRoot) return;
  if (hostTitle) hostTitle.textContent = state.game ? games[state.game].title : "종합게임패키지";

  if (state.view === "menu") {
    hostRoot.innerHTML = `
      <section class="notice-panel">
        <p class="label">게임 선택 대기</p>
        <p class="helper-text">갤럭시탭 참가자 화면에서 게임을 고르면 이 화면도 같이 넘어갑니다.</p>
      </section>
      <section class="game-grid">${gameCards("host")}</section>
    `;
    return;
  }

  if (state.view === "roulette") {
    hostRoot.innerHTML = `
      <section class="roulette-panel">
        <p class="label">랜덤 카테고리 회전판</p>
        ${renderRouletteWheel(state, true)}
      </section>
    `;
    return;
  }

  if (state.view === "setup") {
    const game = games[state.game];
    const items = getItems(state.game, state.category);
    const usedCount = (state.usedIds?.[state.game] || []).length;
    hostRoot.innerHTML = `
      <section class="setup-panel">
        <div class="setup-head">
          <button type="button" class="secondary" data-action="menu">← 게임 선택</button>
          ${button("랜덤 회전판", "primary", "roulette")}
        </div>
        <p class="label">카테고리</p>
        <div class="chip-row">
          ${categoryButtons(state.game, state.category)}
        </div>
        <label class="field">
          <span>타이머 초</span>
          <input id="durationInput" type="number" min="10" max="600" step="10" value="${state.duration}" />
        </label>
        <p class="helper-text">이 카테고리 문제 ${items.length}개 · 이미 사용 ${usedCount}개</p>
        <div class="controls">
          ${button("사용 기록 초기화", "secondary", "resetUsed")}
          ${button("게임 시작", "primary", "start")}
        </div>
      </section>
    `;
    return;
  }

  if (state.view === "playing") {
    hostRoot.innerHTML = `
      <section class="stage">${renderHostItem(state.game, state.currentItem)}</section>
      <nav class="controls">
        ${button("정답", "primary", "correct")}
        ${button("패스", "secondary", "pass")}
        ${button("종료", "danger", "finish")}
      </nav>
    `;
    return;
  }

  if (state.view === "result") {
    hostRoot.innerHTML = `
      <section class="result-panel">
        <p class="label">게임 종료</p>
        <p class="answer">${state.score || 0}개 정답</p>
        <p class="helper-text">패스 ${state.pass || 0}개</p>
        <div class="controls">
          ${button("다시 하기", "primary", "start")}
          ${button("설정으로", "secondary", "setup")}
          ${button("게임 선택", "secondary", "menu")}
        </div>
      </section>
    `;
  }
}

function renderHostItem(game, item) {
  if (!item) return `<div class="answer-panel"><p class="answer">문제가 없습니다</p></div>`;
  if (game === "person") {
    return `
      <img class="person-image" src="${item.image}" alt="${item.name} 사진" />
      <div class="answer-panel">
        <p class="label">정답</p>
        <p class="answer">${item.name}</p>
      </div>
    `;
  }
  if (game === "goldenbell") {
    return `
      <div class="answer-panel">
        <p class="label">문제</p>
        <p class="question">${item.question}</p>
        <p class="label">정답</p>
        <p class="answer small-answer">${item.answer}</p>
      </div>
    `;
  }
  return `
    <div class="answer-panel">
      <p class="label">제시어</p>
      <p class="answer">${item.word}</p>
    </div>
  `;
}

function renderScreen() {
  const state = currentState || defaultState;
  if (!screenRoot) return;

  if (state.view === "menu") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-menu">
        <p class="eyebrow">종합게임패키지</p>
        <h1>어떤 게임을 할까요?</h1>
        <div class="game-grid screen-game-grid">${gameCards("screen")}</div>
      </section>
    `;
    return;
  }

  if (state.view === "setup") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-menu">
        <p class="eyebrow">카테고리 선택</p>
        <h1>${games[state.game].title}</h1>
        <p class="screen-sub">참가자들이 카테고리를 골라주세요</p>
        <div class="chip-row screen-chip-row">
          ${categoryButtons(state.game, state.category)}
        </div>
        <p class="helper-text">선택 후 아이폰 진행자 화면에서 타이머를 맞추고 시작하면 됩니다.</p>
      </section>
    `;
    return;
  }

  if (state.view === "roulette") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card">
        <p class="eyebrow">${games[state.game].title}</p>
        <h1>돌려돌려 회전판</h1>
        ${renderRouletteWheel(state, true)}
      </section>
    `;
    return;
  }

  if (state.view === "result") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card">
        <p class="eyebrow">게임 종료</p>
        <h1>${state.score || 0}개 정답</h1>
        <p class="screen-sub">패스 ${state.pass || 0}개</p>
      </section>
    `;
    return;
  }

  screenRoot.innerHTML = `
    <div class="screen-room">방: ${room}</div>
    <div id="screenTimer" class="screen-counter"></div>
    ${renderScreenItem(state.game, state.currentItem)}
  `;
}

function renderScreenItem(game, item) {
  if (!item) return `<section class="screen-card"><h1>문제가 없습니다</h1></section>`;
  if (game === "person") return `<img class="screen-image" src="${item.image}" alt="문제 인물 사진" />`;
  if (game === "goldenbell") {
    return `
      <section class="screen-card">
        <p class="eyebrow">골든벨</p>
        <h1>${item.question}</h1>
      </section>
    `;
  }
  if (game === "catchmind") {
    return `
      <section class="screen-card">
        <p class="eyebrow">캐치마인드</p>
        <h1>그림을 맞혀보세요</h1>
        <p class="screen-sub">${currentState.category}</p>
      </section>
    `;
  }
  return `
    <section class="screen-card">
      <p class="eyebrow">${games[game].title}</p>
      <h1>${item.word}</h1>
    </section>
  `;
}

function render() {
  if (isHost) renderHost();
  else renderScreen();
  renderTimer();
}

function bindActions(root) {
  if (!root) return;

  root.addEventListener("input", (event) => {
    if (event.target.id === "durationInput") {
      currentState.duration = Number(event.target.value || 60);
    }
  });

  root.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action.startsWith("game:")) return chooseGame(action.slice(5));
    if (action.startsWith("category:")) return chooseCategory(action.slice(9));
    if (action === "roulette") return openRoulette();
    if (action === "spinRoulette" && !currentState.rouletteSpinning) return spinRoulette();
    if (!isHost) return;

    if (action === "menu") return saveState({ ...defaultState, usedIds: currentState?.usedIds || {} });
    if (action === "setup") return saveState({ view: "setup", endAt: null });
    if (action === "start") return startRound();
    if (action === "correct") return markResult("correct");
    if (action === "pass") return markResult("pass");
    if (action === "finish") return finishRound();
    if (action === "resetUsed") return resetUsed();
  });
}

async function loadPeople() {
  const response = await fetch("/people.json", { cache: "no-store" });
  people = await response.json();
}

async function setupRealtime() {
  if (!firebaseEnabled) {
    const saved = localStorage.getItem(`party-games:${room}`);
    currentState = saved ? JSON.parse(saved) : clone(defaultState);
    render();
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { get, getDatabase, onValue, ref, set } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");

  firebase = { set };
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  roomRef = ref(db, `rooms/${room}`);

  const snapshot = await get(roomRef);
  if (!snapshot.exists()) {
    currentState = clone(defaultState);
    await saveState(currentState);
  }

  onValue(roomRef, (snapshotValue) => {
    const incomingState = snapshotValue.val() || {};
    if (incomingState.appVersion !== APP_VERSION) {
      currentState = clone(defaultState);
      saveState(currentState);
      return;
    }

    currentState = { ...clone(defaultState), ...incomingState };
    render();
  });
}

bindActions(hostRoot || screenRoot);
loadPeople()
  .then(setupRealtime)
  .then(() => {
    tickTimer = setInterval(renderTimer, 300);
  })
  .catch((error) => {
    console.error(error);
    const target = hostRoot || screenRoot;
    if (target) target.innerHTML = `<section class="screen-card"><h1>앱을 불러오지 못했습니다</h1></section>`;
  });

window.addEventListener("beforeunload", () => {
  if (tickTimer) clearInterval(tickTimer);
});
