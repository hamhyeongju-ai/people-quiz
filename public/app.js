import { firebaseConfig, firebaseEnabled } from "./firebase-config.js";
import { games, packs } from "./game-data.js?v=27";

const isHost = document.body.classList.contains("host");
const hostRoot = document.querySelector("#hostRoot");
const screenRoot = document.querySelector("#screenRoot");
const hostTitle = document.querySelector("#hostTitle");
const timerLabel = document.querySelector("#timer");
const scoreLabel = document.querySelector("#scoreLabel");
const roomLabel = document.querySelector("#roomLabel");
const homeButton = document.querySelector("#homeButton");

const params = new URLSearchParams(window.location.search);
const room = params.get("room") || "family";
const shouldResetRoom = params.get("reset") === "1";
if (roomLabel) roomLabel.textContent = `방: ${room}`;

const APP_VERSION = 27;
let firebase = {};
let roomRef = null;
let currentState = null;
let people = [];
let tickTimer = null;
let quietMeter = null;
let catchmindSnapshot = null;
let catchmindHasInk = false;
let audioContext = null;
let timingBeatTimer = null;
let lastWarningSecond = null;

const gameRules = {
  person: {
    title: "제한시간 인물퀴즈",
    lines: ["갤럭시탭에는 사진만 보입니다.", "진행자 화면에는 사진과 정답이 함께 보입니다.", "제한시간 안에 많이 맞히는 팀이 유리합니다."],
  },
  charades: {
    title: "제한시간 몸으로 말해요",
    lines: ["말 없이 몸짓으로만 설명합니다.", "제한시간 안에 맞힌 개수만큼 점수를 얻습니다.", "패스는 진행자가 필요할 때 눌러도 됩니다."],
  },
  chain: {
    title: "한 주제 줄줄이 말해요",
    lines: ["카테고리를 고르면 한 가지 주제만 나옵니다.", "진행자가 팀원을 한 명씩 지목하고 3초 안에 답하면 계속 진행합니다.", "막히거나 중복 답이 나오면 실패로 처리합니다."],
  },
  goldenbell: {
    title: "개인전 골든벨",
    lines: ["골든벨은 무조건 개인전입니다.", "틀린 사람은 탈락하고 최후의 1인이 나올 때까지 진행합니다.", "진행자가 정답 공개 버튼을 누르면 갤럭시탭에도 정답이 보입니다."],
  },
  catchmind: {
    title: "팀 릴레이 캐치마인드",
    lines: ["한 명은 정답을 맞히고, 나머지 팀원이 순서대로 그림을 이어 그립니다.", "그림 제한시간이 끝나면 맞히는 사람이 정답을 말합니다.", "정답을 맞히면 성공 점수를 줍니다."],
  },
  quiet: {
    title: "대표자 조용히 먹기",
    lines: ["팀별 대표가 과자를 먹으며 데시벨을 측정합니다.", "측정 시작 후 3초 카운트다운이 끝나면 기록이 시작됩니다.", "가장 낮은 최고 데시벨을 기록한 팀이 유리합니다."],
  },
  timing: {
    title: "목표 시간 맞추기",
    lines: ["목표 시간을 정하고 참가자가 감으로 STOP을 누릅니다.", "목표 시간과 오차가 가장 작은 사람이 승리합니다.", "배경음은 박자를 맞추기 어렵게 불규칙하게 재생됩니다."],
  },
  initials: {
    title: "문제 수 초성퀴즈",
    lines: ["타이머 없이 정해진 문제 수만큼 진행합니다.", "초성을 보고 먼저 맞힌 팀이 점수를 얻습니다.", "진행자가 맞힌 팀 점수를 누르고 다음 문제로 넘깁니다."],
  },
  song: {
    title: "노래맞추기 점수판",
    lines: ["노래는 다른 휴대폰이나 스피커로 틀면 됩니다.", "이 화면은 팀 점수만 관리합니다.", "맞힌 팀의 점수 버튼을 눌러 점수를 누적합니다."],
  },
};

const defaultState = {
  appVersion: APP_VERSION,
  view: "menu",
  game: null,
  category: null,
  duration: 60,
  currentItem: null,
  score: 0,
  pass: 0,
  playMode: "team",
  teamCount: 2,
  teams: [
    { name: "A팀", score: 0 },
    { name: "B팀", score: 0 },
  ],
  questionLimit: 10,
  questionNumber: 0,
  revealAnswer: false,
  feedback: null,
  endAt: null,
  countdownEndAt: null,
  teamSize: 4,
  relaySeconds: 5,
  relayStartedAt: null,
  relayTotal: 3,
  relayPhase: "waiting",
  relayIndex: 1,
  relaySegmentEndAt: null,
  usedIds: {},
  rouletteOptions: [],
  rouletteSpinning: false,
  rouletteRotation: 0,
  rouletteStartRotation: 0,
  quietName: "",
  quietCurrentLevel: 0,
  quietPeakLevel: 0,
  quietResults: [],
  quietError: null,
  timingTarget: 7.77,
  timingName: "",
  timingStartedAt: null,
  timingElapsed: null,
  timingResults: [],
  updatedAt: Date.now(),
};

const personCategoryMap = {
  "한국 유명인": ["유재석", "강호동", "김종국"],
  "세계 스타": ["알베르트 아인슈타인", "오프라 윈프리", "스티븐 호킹", "마리 퀴리", "아이작 뉴턴", "찰스 다윈", "니콜라 테슬라", "토머스 에디슨", "레오나르도 다 빈치", "빈센트 반 고흐", "파블로 피카소"],
  "스포츠": ["손흥민", "김연아", "박지성", "마이클 조던", "리오넬 메시", "크리스티아누 호날두", "르브론 제임스", "우사인 볼트", "코비 브라이언트", "타이거 우즈", "세리나 윌리엄스", "로저 페더러", "라파엘 나달", "노바크 조코비치", "네이마르", "킬리안 음바페", "스테판 커리", "샤킬 오닐", "무하마드 알리", "마이크 타이슨", "박세리", "스즈키 이치로", "오타니 쇼헤이"],
  "기업인": ["일론 머스크", "빌 게이츠", "스티브 잡스", "제프 베이조스", "마크 저커버그", "워런 버핏", "팀 쿡", "젠슨 황"],
  "정치/역사": ["이순신", "버락 오바마", "도널드 트럼프", "넬슨 만델라", "마하트마 간디", "윈스턴 처칠", "조 바이든", "힐러리 클린턴", "앙겔라 메르켈", "에마뉘엘 마크롱", "시진핑", "블라디미르 푸틴", "볼로디미르 젤렌스키", "존 F. 케네디", "에이브러햄 링컨", "마틴 루터 킹 주니어"],
  "문화예술": ["봉준호", "싸이", "이정재", "정호연", "송중기", "박찬욱", "마릴린 먼로", "테일러 스위프트", "비욘세", "마이클 잭슨", "성룡", "레오나르도 디카프리오", "브래드 피트", "톰 크루즈", "윌 스미스", "로버트 다우니 주니어", "드웨인 존슨", "엠마 왓슨", "안젤리나 졸리", "스칼릿 조핸슨", "메릴 스트립", "아델", "에드 시런", "브루노 마스", "저스틴 비버", "레이디 가가", "리아나", "아리아나 그란데", "셀레나 고메즈", "마돈나", "엘비스 프레슬리"],
  "아이돌": ["아이유", "지드래곤", "태연", "BTS", "BLACKPINK", "IVE", "aespa", "NewJeans", "LE SSERAFIM", "SEVENTEEN", "TWICE", "소녀시대", "카라", "god", "젝스키스", "S.E.S.", "브브걸", "리센느", "키키", "ITZY", "NMIXX", "마마무", "레드벨벳", "2NE1", "빅뱅", "원더걸스", "SHINee", "슈퍼주니어", "티아라", "씨스타"],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, start, duration, options = {}) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.slideTo) oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playEffect(name) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;

  if (name === "correct") {
    tone(523, now, 0.1, { volume: 0.14 });
    tone(659, now + 0.09, 0.1, { volume: 0.14 });
    tone(784, now + 0.18, 0.16, { volume: 0.16 });
  } else if (name === "pass") {
    tone(220, now, 0.14, { type: "square", slideTo: 140, volume: 0.1 });
  } else if (name === "start") {
    tone(392, now, 0.08, { type: "triangle", volume: 0.12 });
    tone(523, now + 0.1, 0.12, { type: "triangle", volume: 0.14 });
  } else if (name === "stop") {
    tone(784, now, 0.08, { type: "square", volume: 0.12 });
    tone(392, now + 0.08, 0.18, { type: "square", volume: 0.11 });
  } else if (name === "reveal") {
    tone(440, now, 0.08, { volume: 0.11 });
    tone(660, now + 0.08, 0.14, { volume: 0.13 });
  } else if (name === "finish") {
    tone(659, now, 0.1, { volume: 0.12 });
    tone(523, now + 0.1, 0.1, { volume: 0.12 });
    tone(330, now + 0.2, 0.22, { volume: 0.13 });
  } else if (name === "draw") {
    tone(330, now, 0.07, { type: "triangle", volume: 0.1 });
    tone(494, now + 0.07, 0.08, { type: "triangle", volume: 0.12 });
  } else if (name === "tick") {
    tone(880, now, 0.045, { type: "square", volume: 0.075 });
  } else if (name === "select") {
    tone(660, now, 0.055, { type: "triangle", volume: 0.08 });
  } else if (name === "next") {
    tone(392, now, 0.055, { type: "sawtooth", volume: 0.08 });
    tone(587, now + 0.045, 0.065, { type: "sawtooth", volume: 0.08 });
  } else if (name === "reset") {
    tone(262, now, 0.08, { type: "triangle", volume: 0.08 });
    tone(196, now + 0.08, 0.1, { type: "triangle", volume: 0.075 });
  } else if (name === "warning") {
    tone(988, now, 0.04, { type: "square", volume: 0.06 });
  }
}

function startTimingMusic() {
  if (timingBeatTimer) return;
  playEffect("start");
  const schedule = () => {
    const context = getAudioContext();
    if (!context || !timingBeatTimer) return;
    const base = 220 + Math.random() * 520;
    const burst = Math.random() > 0.62 ? 2 : 1;
    for (let index = 0; index < burst; index += 1) {
      const start = context.currentTime + index * (0.055 + Math.random() * 0.08);
      tone(260 + Math.random() * 620, start, 0.045 + Math.random() * 0.07, {
        type: Math.random() > 0.5 ? "sawtooth" : "triangle",
        volume: 0.055 + Math.random() * 0.035,
      });
    }
    timingBeatTimer = setTimeout(schedule, base);
  };
  timingBeatTimer = setTimeout(schedule, 260);
}

function stopTimingMusic() {
  if (!timingBeatTimer) return;
  clearTimeout(timingBeatTimer);
  timingBeatTimer = null;
}

function syncAudio(state) {
  if (state.game === "timing" && state.view === "playing" && screenRoot) return;
  stopTimingMusic();
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
  if (game === "quiet" || game === "timing" || game === "song") return [];

  if (game === "person") {
    if (!category || category === "전체") return people;
    const names = personCategoryMap[category] || [];
    return people.filter((person) => names.includes(person.name));
  }

  if (game === "goldenbell") {
    return (packs.goldenbell?.["전체"] || []).map((item) => ({ ...item, name: item.question }));
  }

  if (game === "initials") {
    const categoryPack = packs.initials?.[category] || [];
    return categoryPack.map((item) => ({ ...item, word: item.initials, name: item.answer }));
  }

  const categoryPack = packs[game]?.[category] || [];
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

async function resetRoom() {
  playEffect("reset");
  await saveState(clone(defaultState));
}

function buildTeams(count = 2, existing = []) {
  return Array.from({ length: count }, (_, index) => ({
    name: existing[index]?.name || `${String.fromCharCode(65 + index)}팀`,
    score: Number(existing[index]?.score || 0),
  }));
}

async function setPlayMode(mode) {
  playEffect("select");
  await saveState({
    playMode: mode,
    teamCount: mode === "team" ? currentState.teamCount || 2 : 0,
    teams: mode === "team" ? buildTeams(currentState.teamCount || 2, currentState.teams) : [],
  });
}

async function setTeamCount(count) {
  playEffect("select");
  await saveState({
    playMode: "team",
    teamCount: count,
    teams: buildTeams(count, currentState.teams),
  });
}

async function resetTeamScores() {
  playEffect("reset");
  await saveState({
    teams: buildTeams(currentState.teamCount || 2, currentState.teams).map((team) => ({ ...team, score: 0 })),
  });
}

async function awardTeam(index, amount = 1) {
  if (currentState.game === "goldenbell" || currentState.playMode !== "team") return;
  playEffect("correct");
  const teams = buildTeams(currentState.teamCount || 2, currentState.teams);
  if (!teams[index]) return;
  teams[index] = { ...teams[index], score: Number(teams[index].score || 0) + amount };
  await saveState({ teams });

  if (currentState.game === "initials") {
    await nextQuestion();
  }
}

async function resetAllGameData() {
  const confirmed = window.confirm("테스트 기록과 사용한 문제 기록을 모두 지우고 처음 화면으로 돌아갈까요?");
  if (!confirmed) return;
  await resetRoom();
}

async function chooseGame(game) {
  playEffect("select");
  await saveState({
    view: "instructions",
    game,
    category: games[game].categories[0],
    duration: games[game].defaultSeconds,
    currentItem: null,
    score: 0,
    pass: 0,
    questionNumber: 0,
    revealAnswer: false,
    feedback: null,
    endAt: null,
    countdownEndAt: null,
    rouletteOptions: [],
    rouletteSpinning: false,
    relayStartedAt: null,
    relayPhase: "waiting",
    relayIndex: 1,
    relaySegmentEndAt: null,
    quietName: "",
    quietCurrentLevel: 0,
    quietPeakLevel: 0,
    quietError: null,
    timingName: "",
    timingStartedAt: null,
    timingElapsed: null,
  });
}

async function chooseCategory(category) {
  playEffect("select");
  await saveState({ category });
}

async function openRoulette() {
  playEffect("select");
  const categories = getCategoryOptions(currentState.game);
  await saveState({
    view: "roulette",
    rouletteOptions: categories,
    rouletteSpinning: false,
    rouletteStartRotation: currentState.rouletteRotation || 0,
  });
}

async function spinRoulette() {
  playEffect("draw");
  const categories = currentState.rouletteOptions?.length
    ? currentState.rouletteOptions
    : getCategoryOptions(currentState.game);
  const chosen = categories[Math.floor(Math.random() * categories.length)];
  const chosenIndex = categories.indexOf(chosen);
  const segment = 360 / categories.length;
  const targetAngle = 360 - (chosenIndex * segment + segment / 2);
  const startRotation = currentState.rouletteRotation || 0;
  const rotation = startRotation + 1800 + targetAngle + Math.floor(Math.random() * 16);

  await saveState({
    category: chosen,
    rouletteOptions: categories,
    rouletteStartRotation: startRotation,
    rouletteRotation: rotation,
    rouletteSpinning: true,
  });

  setTimeout(() => {
    saveState({
      view: "drawResult",
      category: chosen,
      rouletteSpinning: false,
    });
  }, 2600);

  setTimeout(() => {
    saveState({
      view: "setup",
      category: chosen,
      rouletteSpinning: false,
    });
  }, 4200);
}

async function startRound() {
  playEffect("start");
  if (currentState.game === "song") {
    await saveState({
      view: "playing",
      currentItem: null,
      score: 0,
      pass: 0,
      revealAnswer: false,
      feedback: null,
      endAt: null,
    });
    return;
  }
  if (currentState.game === "timing") {
    await saveState({
      view: "ready",
      currentItem: null,
      timingName: "",
      timingStartedAt: null,
      timingElapsed: null,
      endAt: null,
    });
    return;
  }

  const { item, usedIds } = getUnusedItem(currentState);
  await saveState({
    view: "ready",
    currentItem: item,
    score: 0,
    pass: 0,
    questionNumber: item ? 1 : 0,
    revealAnswer: false,
    feedback: null,
    usedIds,
    countdownEndAt: null,
    endAt: null,
    relayStartedAt: null,
    relayTotal: Math.max(1, Number(currentState.teamSize || 4) - 1),
    relaySeconds: Math.max(1, Number(currentState.relaySeconds || 5)),
    relayPhase: "waiting",
    relayIndex: 1,
    relaySegmentEndAt: null,
  });
}

async function beginPlaying() {
  playEffect("start");
  const now = Date.now();
  const duration = Number(currentState.duration || games[currentState.game].defaultSeconds) * 1000;
  const relayTotal = Math.max(1, Number(currentState.teamSize || 4) - 1);

  await saveState({
    view: "playing",
    countdownEndAt: null,
    revealAnswer: false,
    relayStartedAt: null,
    relayTotal,
    relaySeconds: Math.max(1, Number(currentState.relaySeconds || 5)),
    relayPhase: currentState.game === "catchmind" ? "waiting" : null,
    relayIndex: 1,
    relaySegmentEndAt: null,
    endAt: currentState.game === "catchmind" || currentState.game === "initials" || currentState.game === "chain" ? null : now + duration,
  });
}

async function finishRound() {
  playEffect("finish");
  await saveState({ view: "result", endAt: null });
}

async function markResult(kind) {
  if (!currentState?.currentItem) return;
  playEffect(kind === "correct" ? "correct" : "pass");

  const usedIds = clone(currentState.usedIds || {});
  const gameUsed = new Set(usedIds[currentState.game] || []);
  gameUsed.add(itemId(currentState.game, currentState.currentItem));
  usedIds[currentState.game] = Array.from(gameUsed);

  if (currentState.game === "chain") {
    await saveState({
      usedIds,
      revealAnswer: false,
      feedback: kind === "correct" ? "성공!" : "실패",
      score: currentState.score + (kind === "correct" ? 1 : 0),
      pass: currentState.pass + (kind === "pass" ? 1 : 0),
    });
    return;
  }

  const { item, usedIds: nextUsedIds } = getUnusedItem({ ...currentState, usedIds });
  const nextQuestionNumber = currentState.questionNumber + 1;
  await saveState({
    currentItem: item,
    usedIds: nextUsedIds,
    revealAnswer: false,
    feedback: kind === "correct" ? "정답!" : "패스",
    score: currentState.score + (kind === "correct" ? 1 : 0),
    pass: currentState.pass + (kind === "pass" ? 1 : 0),
    questionNumber: item ? nextQuestionNumber : currentState.questionNumber,
  });

  if (currentState.game === "initials" && nextQuestionNumber > Number(currentState.questionLimit || 10)) {
    await finishRound();
    return;
  }

  setTimeout(() => {
    if (currentState?.feedback) saveState({ feedback: null });
  }, 900);
}

async function nextQuestion() {
  if (!currentState?.currentItem) return;
  playEffect("next");

  const usedIds = clone(currentState.usedIds || {});
  const gameUsed = new Set(usedIds[currentState.game] || []);
  gameUsed.add(itemId(currentState.game, currentState.currentItem));
  usedIds[currentState.game] = Array.from(gameUsed);

  const { item, usedIds: nextUsedIds } = getUnusedItem({ ...currentState, usedIds });
  const nextQuestionNumber = currentState.questionNumber + 1;
  if (currentState.game === "initials" && nextQuestionNumber > Number(currentState.questionLimit || 10)) {
    await saveState({
      usedIds: nextUsedIds,
      revealAnswer: false,
      feedback: null,
    });
    await finishRound();
    return;
  }
  await saveState({
    currentItem: item,
    usedIds: nextUsedIds,
    revealAnswer: false,
    feedback: null,
    questionNumber: item ? nextQuestionNumber : currentState.questionNumber,
  });
}

async function toggleRevealAnswer() {
  playEffect("reveal");
  await saveState({ revealAnswer: !currentState.revealAnswer });
}

async function revivalQuestion() {
  playEffect("draw");
  const items = (packs.goldenbell?.["패자부활전"] || []).map((item) => ({
    ...item,
    name: item.question,
    revival: true,
  }));
  const item = items[Math.floor(Math.random() * items.length)] || null;
  await saveState({
    currentItem: item,
    revealAnswer: false,
    feedback: "패자부활전",
  });
}

async function resetUsed() {
  playEffect("reset");
  const usedIds = clone(currentState.usedIds || {});
  usedIds[currentState.game] = [];
  await saveState({ usedIds });
}

async function resetQuietResults() {
  playEffect("reset");
  await saveState({
    quietResults: [],
    quietCurrentLevel: 0,
    quietPeakLevel: 0,
    quietName: "",
    quietError: null,
    countdownEndAt: null,
  });
}

function stopQuietMeterStream() {
  if (!quietMeter) return;
  if (quietMeter.animationId) cancelAnimationFrame(quietMeter.animationId);
  quietMeter.stream?.getTracks().forEach((track) => track.stop());
  quietMeter.audioContext?.close();
  quietMeter = null;
}

async function startQuietMeter() {
  if (!screenRoot) return;
  playEffect("start");
  const input = document.querySelector("#quietNameInput");
  const name = (input?.value || currentState.quietName || "").trim() || `도전자 ${(currentState.quietResults || []).length + 1}`;

  stopQuietMeterStream();

  if (!navigator.mediaDevices?.getUserMedia) {
    await saveState({ quietError: "이 브라우저에서는 마이크 측정을 사용할 수 없습니다." });
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 1024;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    quietMeter = {
      stream,
      audioContext,
      analyser,
      data,
      peak: 0,
      lastPush: 0,
      animationId: null,
      measuring: false,
    };

    await saveState({
      view: "quietCountdown",
      quietName: name,
      quietCurrentLevel: 0,
      quietPeakLevel: 0,
      quietError: null,
      countdownEndAt: Date.now() + 3000,
      endAt: null,
    });

    setTimeout(beginQuietMeasurement, 3100);
  } catch (error) {
    await saveState({
      quietError: "마이크 권한이 필요합니다. 허용 후 다시 시작해주세요.",
    });
  }
}

async function beginQuietMeasurement() {
  if (!screenRoot || !quietMeter || quietMeter.measuring) return;
  if (currentState?.game !== "quiet" || currentState?.view !== "quietCountdown") return;

  quietMeter.measuring = true;
  quietMeter.peak = 0;
  quietMeter.lastPush = 0;
  playEffect("start");

  await saveState({
    view: "playing",
    quietCurrentLevel: 0,
    quietPeakLevel: 0,
    countdownEndAt: null,
  });

  const measure = async () => {
    if (!quietMeter || currentState?.game !== "quiet" || currentState?.view !== "playing") {
      stopQuietMeterStream();
      return;
    }

    quietMeter.analyser.getByteTimeDomainData(quietMeter.data);
    let sum = 0;
    for (const value of quietMeter.data) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / quietMeter.data.length);
    const level = Math.max(0, Math.min(100, 20 * Math.log10(rms || 0.00001) + 100));
    quietMeter.peak = Math.max(quietMeter.peak, level);

    const now = Date.now();
    if (now - quietMeter.lastPush > 220) {
      quietMeter.lastPush = now;
      await saveState({
        quietCurrentLevel: Number(level.toFixed(1)),
        quietPeakLevel: Number(quietMeter.peak.toFixed(1)),
      });
    }

    if (quietMeter) quietMeter.animationId = requestAnimationFrame(measure);
  };

  quietMeter.animationId = requestAnimationFrame(measure);
}

async function stopQuietMeter() {
  const peak = Number(currentState.quietPeakLevel || quietMeter?.peak || 0);
  const name = currentState.quietName || `도전자 ${(currentState.quietResults || []).length + 1}`;
  const results = clone(currentState.quietResults || []);
  results.push({
    name,
    peak,
    at: Date.now(),
  });
  stopQuietMeterStream();
  await saveState({
    view: "result",
    quietResults: results,
    quietCurrentLevel: 0,
    quietPeakLevel: peak,
    quietError: null,
    countdownEndAt: null,
  });
}

async function finishQuietByHost() {
  playEffect("stop");
  const peak = Number(currentState.quietPeakLevel || 0);
  const name = currentState.quietName || `도전자 ${(currentState.quietResults || []).length + 1}`;
  const results = clone(currentState.quietResults || []);
  results.push({
    name,
    peak,
    at: Date.now(),
  });
  await saveState({
    view: "result",
    quietResults: results,
    quietCurrentLevel: 0,
    quietPeakLevel: peak,
    quietError: null,
    countdownEndAt: null,
  });
}

function timingRankings(results = []) {
  return [...results].sort((a, b) => a.diff - b.diff);
}

async function startTimingChallenge() {
  if (!screenRoot) return;
  startTimingMusic();
  const input = document.querySelector("#timingNameInput");
  const name = (input?.value || currentState.timingName || "").trim() || `도전자 ${(currentState.timingResults || []).length + 1}`;

  await saveState({
    view: "playing",
    timingName: name,
    timingStartedAt: Date.now(),
    timingElapsed: null,
    endAt: null,
  });
}

async function stopTimingChallenge() {
  if (!screenRoot || !currentState?.timingStartedAt) return;
  stopTimingMusic();
  playEffect("stop");
  const elapsed = (Date.now() - currentState.timingStartedAt) / 1000;
  const target = Number(currentState.timingTarget || 7.77);
  const diff = Math.abs(elapsed - target);
  const name = currentState.timingName || `도전자 ${(currentState.timingResults || []).length + 1}`;
  const results = clone(currentState.timingResults || []);
  results.push({
    name,
    elapsed: Number(elapsed.toFixed(2)),
    target: Number(target.toFixed(2)),
    diff: Number(diff.toFixed(2)),
    at: Date.now(),
  });

  await saveState({
    view: "result",
    timingElapsed: Number(elapsed.toFixed(2)),
    timingResults: results,
    timingStartedAt: null,
  });
}

async function resetTimingResults() {
  playEffect("reset");
  await saveState({
    timingResults: [],
    timingName: "",
    timingStartedAt: null,
    timingElapsed: null,
  });
}

async function startCatchmindTurn() {
  if (currentState?.game !== "catchmind" || currentState?.view !== "playing") return;
  if (currentState.relayPhase === "drawing" || currentState.relayPhase === "guess") return;
  playEffect("start");

  const now = Date.now();
  const relayTotal = Math.max(1, Number(currentState.relayTotal || Math.max(1, Number(currentState.teamSize || 4) - 1)));
  const currentIndex = Math.max(1, Number(currentState.relayIndex || 1));
  const nextIndex = currentState.relayPhase === "locked" ? Math.min(relayTotal, currentIndex + 1) : currentIndex;
  const seconds = Math.max(1, Number(currentState.relaySeconds || 5));

  await saveState({
    relayPhase: "drawing",
    relayIndex: nextIndex,
    relayStartedAt: now,
    relaySegmentEndAt: now + seconds * 1000,
    endAt: null,
  });
}

async function finishCatchmindTurn() {
  if (currentState?.game !== "catchmind" || currentState?.view !== "playing" || currentState.relayPhase !== "drawing") return;
  playEffect("stop");

  const relayTotal = Math.max(1, Number(currentState.relayTotal || 3));
  const currentIndex = Math.max(1, Number(currentState.relayIndex || 1));

  if (currentIndex >= relayTotal) {
    await saveState({
      relayPhase: "guess",
      relaySegmentEndAt: null,
      endAt: Date.now() + Number(currentState.duration || games.catchmind.defaultSeconds) * 1000,
    });
    return;
  }

  await saveState({
    relayPhase: "locked",
    relaySegmentEndAt: null,
    endAt: null,
  });
}

function renderTimer() {
  const state = currentState || defaultState;
  const catchmindInfo = getCatchmindRelayInfo(state);
  const quietCountdownRemaining = state.game === "quiet" && state.view === "quietCountdown"
    ? Math.max(0, (state.countdownEndAt || 0) - Date.now())
    : 0;
  const remaining = catchmindInfo?.phase === "draw"
    ? Math.max(0, (state.relaySegmentEndAt || 0) - Date.now())
    : state.endAt
      ? state.endAt - Date.now()
      : 0;
  if (timerLabel) {
    if (state.view === "quietCountdown") timerLabel.textContent = String(Math.max(1, Math.ceil(quietCountdownRemaining / 1000)));
    else if (state.view === "ready") timerLabel.textContent = "READY";
    else timerLabel.textContent = state.view === "playing" && (state.endAt || catchmindInfo?.phase === "draw") ? formatTime(remaining) : "--:--";
  }

  const screenTimer = document.querySelector("#screenTimer");
  if (screenTimer) {
    screenTimer.textContent = state.view === "playing" && (state.endAt || catchmindInfo?.phase === "draw") ? formatTime(remaining) : "";
  }
  document.querySelectorAll("[data-quiet-countdown]").forEach((item) => {
    item.textContent = quietCountdownRemaining <= 0 ? "START!" : String(Math.ceil(quietCountdownRemaining / 1000));
  });
  if (scoreLabel) {
    scoreLabel.textContent = state.game === "goldenbell"
      ? "생존형 골든벨"
      : state.game === "quiet"
        ? `기록 ${state.quietResults?.length || 0}명`
        : state.game === "timing"
          ? `기록 ${state.timingResults?.length || 0}명`
          : `정답 ${state.score || 0} · 패스 ${state.pass || 0}`;
  }

  updateCatchmindRelayLabels(state);

  const warningSecond = Math.ceil(remaining / 1000);
  if (state.view === "playing" && state.endAt && warningSecond > 0 && warningSecond <= 5) {
    if (lastWarningSecond !== warningSecond) {
      lastWarningSecond = warningSecond;
      playEffect("warning");
    }
  } else {
    lastWarningSecond = null;
  }

  if (isHost && state.game === "catchmind" && state.view === "playing" && state.relayPhase === "drawing" && remaining <= 0) {
    finishCatchmindTurn();
  }
  if (isHost && state.view === "playing" && state.endAt && remaining <= 0) finishRound();
  if (screenRoot && state.game === "quiet" && state.view === "quietCountdown" && quietCountdownRemaining <= 0) {
    beginQuietMeasurement();
  }
}

function getCatchmindRelayInfo(state) {
  if (state.game !== "catchmind" || state.view !== "playing") return null;
  const relayTotal = Math.max(1, Number(state.relayTotal || 3));
  const current = Math.max(1, Number(state.relayIndex || 1));

  if (state.relayPhase === "drawing") {
    return {
      phase: "draw",
      current: Math.min(relayTotal, current),
      total: relayTotal,
      seconds: Math.max(0, Math.ceil(((state.relaySegmentEndAt || Date.now()) - Date.now()) / 1000)),
    };
  }

  return {
    phase: state.relayPhase || "waiting",
    current: Math.min(relayTotal, current),
    total: relayTotal,
    seconds: 0,
  };
}

function updateCatchmindRelayLabels(state) {
  const info = getCatchmindRelayInfo(state);
  let text = "";
  if (info?.phase === "draw") {
    text = `${info.current}번 그림 담당 · ${info.seconds}초`;
  } else if (info?.phase === "locked") {
    text = `${info.current}번 그림 완료 · 다음 사람이 START`;
  } else if (info?.phase === "guess") {
    text = "그림 완성 · 이제 정답을 맞혀요";
  } else if (info?.phase === "waiting") {
    text = "1번 그림 담당 준비 · START를 누르세요";
  }

  document.querySelectorAll("[data-relay-status]").forEach((item) => {
    item.textContent = text;
  });
}

function button(label, className, action) {
  return `<button type="button" class="${className}" data-action="${action}">${label}</button>`;
}

function isTeamScoredGame(game) {
  return currentState?.playMode === "team" && !["goldenbell", "quiet", "timing"].includes(game);
}

function renderTeamSetup(state) {
  const teams = buildTeams(state.teamCount || 2, state.teams);
  return `
    <section class="notice-panel team-panel">
      <p class="label">운영 방식</p>
      <div class="chip-row">
        <button type="button" class="chip ${state.playMode === "team" ? "active" : ""}" data-action="mode:team">팀전</button>
        <button type="button" class="chip ${state.playMode === "solo" ? "active" : ""}" data-action="mode:solo">개인전</button>
      </div>
      ${
        state.playMode === "team"
          ? `<div class="chip-row">
              <button type="button" class="chip ${state.teamCount === 2 ? "active" : ""}" data-action="teamCount:2">2팀</button>
              <button type="button" class="chip ${state.teamCount === 3 ? "active" : ""}" data-action="teamCount:3">3팀</button>
            </div>
            <div class="team-name-grid">
              ${teams
                .map(
                  (team, index) => `
                    <label class="field">
                      <span>${index + 1}팀 이름</span>
                      <input id="teamName-${index}" type="text" maxlength="12" value="${escapeHtml(team.name)}" />
                    </label>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="helper-text">개인전에서는 팀 점수판을 숨깁니다. 골든벨은 항상 개인전으로 진행됩니다.</p>`
      }
    </section>
  `;
}

function renderScoreboard(state, includeButtons = true) {
  if (state.playMode !== "team" || state.game === "goldenbell") return "";
  const teams = buildTeams(state.teamCount || 2, state.teams);
  return `
    <section class="scoreboard">
      <div class="scoreboard-head">
        <p class="label">팀 점수판</p>
        ${includeButtons ? button("점수 초기화", "mini-button", "teamReset") : ""}
      </div>
      <div class="score-grid">
        ${teams
          .map(
            (team, index) => `
              <div class="score-card">
                <strong>${escapeHtml(team.name)}</strong>
                <span>${Number(team.score || 0)}점</span>
                ${includeButtons && isTeamScoredGame(state.game) ? `<button type="button" class="primary" data-action="teamScore:${index}">+1</button>` : ""}
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRules(game) {
  const rule = gameRules[game];
  if (!rule) return "";
  return `
    <section class="notice-panel rule-panel">
      <p class="label">게임 설명</p>
      <h1>${rule.title}</h1>
      <ul>
        ${rule.lines.map((line) => `<li>${line}</li>`).join("")}
      </ul>
      <div class="controls">
        ${button("설정으로", "primary", "setup")}
        ${button("게임 선택", "secondary", "menu")}
      </div>
    </section>
  `;
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

  return `${categoryList}<button type="button" class="chip random-chip" data-action="roulette">카테고리 랜덤 추첨</button>`;
}

function renderCategoryDraw(state, includeButton) {
  const options = state.rouletteOptions || [];
  const displayOptions = state.rouletteSpinning || !state.category
    ? options.concat(options, options)
    : [state.category];

  return `
    <div class="draw-box ${state.rouletteSpinning ? "drawing" : ""}">
      <div class="draw-strip">
        ${displayOptions
          .map((category) => `<span class="${category === state.category ? "selected" : ""}">${category}</span>`)
          .join("")}
      </div>
    </div>
    <div class="draw-actions">
      <p class="answer small-answer">${state.rouletteSpinning ? "추첨 중..." : state.category || "랜덤 선택"}</p>
      ${
        includeButton
          ? `<button type="button" class="start-button draw-button" data-action="spinRoulette" ${state.rouletteSpinning ? "disabled" : ""}>START</button>`
          : ""
      }
    </div>
  `;
}

function quietRankings(results = []) {
  return [...results].sort((a, b) => a.peak - b.peak);
}

function renderQuietLeaderboard(results = []) {
  if (!results.length) return `<p class="helper-text">아직 기록이 없습니다.</p>`;
  return `
    <ol class="quiet-list">
      ${quietRankings(results)
        .map(
          (result, index) => `
            <li>
              <span>${index + 1}. ${escapeHtml(result.name)}</span>
              <strong>${result.peak.toFixed(1)} dB</strong>
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function renderTimingLeaderboard(results = []) {
  if (!results.length) return `<p class="helper-text">아직 기록이 없습니다.</p>`;
  return `
    <ol class="quiet-list">
      ${timingRankings(results)
        .map(
          (result, index) => `
            <li>
              <span>${index + 1}. ${escapeHtml(result.name)}</span>
              <strong>${Number(result.elapsed).toFixed(2)}초 · 오차 ${Number(result.diff).toFixed(2)}초</strong>
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function renderQuietGauge(level = 0, peak = 0) {
  const capped = Math.min(100, Math.max(0, peak));
  return `
    <div class="quiet-meter">
      <div class="quiet-meter-fill" style="width: ${capped}%"></div>
    </div>
    <div class="quiet-numbers">
      <div>
        <span>현재</span>
        <strong>${Number(level || 0).toFixed(1)} dB</strong>
      </div>
      <div>
        <span>최고</span>
        <strong>${Number(peak || 0).toFixed(1)} dB</strong>
      </div>
    </div>
  `;
}

function renderHost() {
  const state = currentState || defaultState;
  if (!hostRoot) return;
  if (hostTitle) hostTitle.textContent = state.game ? games[state.game].title : "종합게임패키지";

  if (state.view === "menu") {
    hostRoot.innerHTML = `
      ${renderTeamSetup(state)}
      ${renderScoreboard(state, false)}
      <section class="notice-panel">
        <p class="label">게임 선택 대기</p>
        <p class="helper-text">갤럭시탭 참가자 화면에서 게임을 고르면 이 화면도 같이 넘어갑니다.</p>
      </section>
      <section class="game-grid">${gameCards("host")}</section>
    `;
    return;
  }

  if (state.view === "instructions") {
    hostRoot.innerHTML = `
      ${renderScoreboard(state, false)}
      ${renderRules(state.game)}
    `;
    return;
  }

  if (state.view === "roulette") {
    hostRoot.innerHTML = `
      <section class="roulette-panel">
        <p class="label">랜덤 카테고리 추첨</p>
        ${renderCategoryDraw(state, true)}
      </section>
    `;
    return;
  }

  if (state.view === "drawResult") {
    hostRoot.innerHTML = `
      <section class="draw-result-panel">
        <p class="label">카테고리 결정</p>
        <p class="draw-result-word">${state.category}</p>
        <p class="helper-text">이 카테고리로 게임을 준비합니다.</p>
      </section>
    `;
    return;
  }

  if (state.view === "setup") {
    if (state.game === "song") {
      hostRoot.innerHTML = `
        ${renderScoreboard(state)}
        <section class="setup-panel">
          <div class="setup-head">
            <button type="button" class="secondary" data-action="menu">← 게임 선택</button>
          </div>
          <p class="label">노래맞추기</p>
          <h1>노래는 다른 기기로 틀고, 맞힌 팀에 점수만 주세요</h1>
          <p class="helper-text">갤럭시탭에는 점수판이 크게 표시됩니다.</p>
          <div class="controls">
            ${button("점수판 시작", "primary", "start")}
          </div>
        </section>
      `;
      return;
    }
    if (state.game === "quiet") {
      hostRoot.innerHTML = `
        ${renderScoreboard(state, false)}
        <section class="setup-panel quiet-panel">
          <div class="setup-head">
            <button type="button" class="secondary" data-action="menu">← 게임 선택</button>
            ${button("기록 초기화", "danger", "quietReset")}
          </div>
          <p class="label">조용히 먹기 준비</p>
          <h1>갤럭시탭에서 도전자 이름을 입력하고 측정 시작</h1>
          <p class="helper-text">마이크 권한이 필요해서 측정 시작은 갤럭시탭 참가자 화면에서 누릅니다. 최고 소리 기록이 낮은 사람이 이깁니다.</p>
          <h2 class="section-title">현재 순위</h2>
          ${renderQuietLeaderboard(state.quietResults)}
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      hostRoot.innerHTML = `
        ${renderScoreboard(state, false)}
        <section class="setup-panel quiet-panel">
          <div class="setup-head">
            <button type="button" class="secondary" data-action="menu">← 게임 선택</button>
            ${button("기록 초기화", "danger", "timingReset")}
          </div>
          <p class="label">시간맞추기 준비</p>
          <label class="field">
            <span>목표 시간(초)</span>
            <input id="timingTargetInput" type="number" min="1" max="60" step="0.01" value="${Number(state.timingTarget || 7.77).toFixed(2)}" />
          </label>
          <p class="helper-text">갤럭시탭에서 도전자 이름을 입력하고 시작합니다. 목표 시간과 오차가 가장 작은 사람이 1등입니다.</p>
          <h2 class="section-title">현재 순위</h2>
          ${renderTimingLeaderboard(state.timingResults)}
          <div class="controls">
            ${button("게임 시작", "primary", "start")}
          </div>
        </section>
      `;
      return;
    }

    const game = games[state.game];
    const items = getItems(state.game, state.category);
    const usedCount = (state.usedIds?.[state.game] || []).length;
    const isGoldenbell = state.game === "goldenbell";
    hostRoot.innerHTML = `
      ${renderScoreboard(state)}
      <section class="setup-panel">
        <div class="setup-head">
          <button type="button" class="secondary" data-action="menu">← 게임 선택</button>
          ${isGoldenbell ? "" : button("카테고리 랜덤 추첨", "primary", "roulette")}
        </div>
        ${
          isGoldenbell
            ? `<p class="label">골든벨 전체 문제</p>
               <p class="helper-text">카테고리 없이 전체 문제에서 랜덤으로 진행합니다.</p>`
            : `<p class="label">카테고리</p>
               <div class="chip-row">
                 ${categoryButtons(state.game, state.category)}
               </div>`
        }
        ${
          state.game === "initials"
            ? `<label class="field">
                <span>진행할 문제 수</span>
                <input id="questionLimitInput" type="number" min="1" max="50" step="1" value="${state.questionLimit || 10}" />
              </label>`
            : state.game === "chain"
              ? `<p class="helper-text">주제 하나를 뽑아 성공/실패만 판단합니다. 타이머는 사용하지 않습니다.</p>`
              : `<label class="field">
                  <span>타이머 초</span>
                  <input id="durationInput" type="number" min="10" max="600" step="10" value="${state.duration}" />
                </label>`
        }
        ${
          state.game === "catchmind"
            ? `<label class="field">
                <span>팀원 수</span>
                <input id="teamSizeInput" type="number" min="2" max="10" step="1" value="${state.teamSize || 4}" />
              </label>
              <label class="field">
                <span>1인당 그림 초</span>
                <input id="relaySecondsInput" type="number" min="1" max="30" step="1" value="${state.relaySeconds || 5}" />
              </label>
              <p class="helper-text">한 명은 맞히는 사람, 나머지 ${Math.max(1, Number(state.teamSize || 4) - 1)}명이 ${Math.max(1, Number(state.relaySeconds || 5))}초씩 이어서 그립니다.</p>`
            : ""
        }
        <p class="helper-text">이 카테고리 문제 ${items.length}개 · 이미 사용 ${usedCount}개</p>
        <div class="controls">
          ${button("사용 기록 초기화", "secondary", "resetUsed")}
          ${button("게임 시작", "primary", "start")}
        </div>
      </section>
    `;
    return;
  }

  if (state.view === "ready") {
    if (state.game === "quiet") {
      hostRoot.innerHTML = `
        <section class="result-panel quiet-panel">
          <p class="label">조용히 먹기</p>
          <h1>갤럭시탭에서 측정을 시작하세요</h1>
          <p class="helper-text">도전자 이름을 입력하고 과자를 먹기 직전에 측정 시작을 누르면 됩니다.</p>
          ${renderQuietLeaderboard(state.quietResults)}
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      hostRoot.innerHTML = `
        <section class="result-panel quiet-panel">
          <p class="label">시간맞추기</p>
          <h1>목표 ${Number(state.timingTarget || 7.77).toFixed(2)}초</h1>
          <p class="helper-text">갤럭시탭에서 도전자 이름을 입력하고 START를 누르면 화면이 검게 바뀝니다.</p>
          ${renderTimingLeaderboard(state.timingResults)}
        </section>
      `;
      return;
    }

    hostRoot.innerHTML = `
      ${renderScoreboard(state)}
      <section class="result-panel">
        <p class="label">문제 준비 완료</p>
        <p class="helper-text">갤럭시탭에는 READY가 표시됩니다. START를 누르면 타이머가 시작됩니다.</p>
        <button type="button" class="start-button" data-action="begin">START</button>
      </section>
    `;
    return;
  }

  if (state.view === "quietCountdown") {
    hostRoot.innerHTML = `
      <section class="answer-panel quiet-panel">
        <p class="label">조용히 먹기</p>
        <h1>${escapeHtml(state.quietName || "도전자")}</h1>
        <p class="quiet-countdown" data-quiet-countdown>${Math.max(1, Math.ceil(((state.countdownEndAt || Date.now()) - Date.now()) / 1000))}</p>
        <p class="helper-text">카운트다운이 끝나면 갤럭시탭에서 데시벨 측정이 시작됩니다.</p>
      </section>
    `;
    return;
  }

  if (state.view === "playing") {
    if (state.game === "song") {
      hostRoot.innerHTML = `
        ${renderScoreboard(state)}
        <section class="answer-panel">
          <p class="label">노래맞추기 진행 중</p>
          <p class="answer">맞힌 팀에 +1</p>
          <p class="helper-text">노래는 다른 기기로 틀고, 진행자 화면에서 점수만 누르면 됩니다.</p>
          <div class="controls">
            ${button("종료", "danger", "finish")}
          </div>
        </section>
      `;
      return;
    }
    if (state.game === "quiet") {
      hostRoot.innerHTML = `
        <section class="answer-panel quiet-panel">
          <p class="label">측정 중</p>
          <h1>${escapeHtml(state.quietName || "도전자")}</h1>
          ${renderQuietGauge(state.quietCurrentLevel, state.quietPeakLevel)}
          <p class="helper-text">과자를 다 먹은 걸 확인한 뒤 측정 종료를 누르면 기록이 순위표에 저장됩니다.</p>
          <div class="controls">
            ${button("측정 종료", "danger", "quietStop")}
          </div>
        </section>
        <section class="result-panel quiet-panel">
          <h2 class="section-title">현재 순위</h2>
          ${renderQuietLeaderboard(state.quietResults)}
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      hostRoot.innerHTML = `
        <section class="answer-panel quiet-panel">
          <p class="label">도전 중</p>
          <h1>${escapeHtml(state.timingName || "도전자")}</h1>
          <p class="helper-text">참가자가 목표 시간에 가깝다고 느끼는 순간 STOP을 누릅니다.</p>
        </section>
        <section class="result-panel quiet-panel">
          <h2 class="section-title">현재 순위</h2>
          ${renderTimingLeaderboard(state.timingResults)}
        </section>
      `;
      return;
    }

    hostRoot.innerHTML = `
      ${renderScoreboard(state)}
      <section class="stage">${renderHostItem(state.game, state.currentItem)}</section>
      ${renderHostControls(state)}
    `;
    return;
  }

  if (state.view === "result") {
    if (state.game === "quiet") {
      hostRoot.innerHTML = `
        <section class="result-panel quiet-panel">
          <p class="label">조용히 먹기 결과</p>
          <h1>순위표</h1>
          ${renderQuietLeaderboard(state.quietResults)}
          <div class="controls">
            ${button("다음 도전자", "primary", "setup")}
            ${button("기록 초기화", "danger", "quietReset")}
            ${button("게임 선택", "secondary", "menu")}
          </div>
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      const last = state.timingElapsed == null ? "" : `${Number(state.timingElapsed).toFixed(2)}초`;
      const diff = state.timingElapsed == null ? "" : `오차 ${Math.abs(Number(state.timingElapsed) - Number(state.timingTarget || 7.77)).toFixed(2)}초`;
      hostRoot.innerHTML = `
        <section class="result-panel quiet-panel">
          <p class="label">시간맞추기 결과</p>
          <h1>${last || "순위표"}</h1>
          <p class="helper-text">${diff}</p>
          ${renderTimingLeaderboard(state.timingResults)}
          <div class="controls">
            ${button("다음 도전자", "primary", "setup")}
            ${button("기록 초기화", "danger", "timingReset")}
            ${button("게임 선택", "secondary", "menu")}
          </div>
        </section>
      `;
      return;
    }

    hostRoot.innerHTML = `
      ${renderScoreboard(state, false)}
      <section class="result-panel">
        <p class="label">게임 종료</p>
        <p class="answer">${state.game === "goldenbell" ? "골든벨 종료" : `${state.score || 0}개 정답`}</p>
        <p class="helper-text">${state.game === "goldenbell" ? "골든벨 종료" : `패스 ${state.pass || 0}개`}</p>
        <div class="controls">
          ${button("다시 하기", "primary", "start")}
          ${button("설정으로", "secondary", "setup")}
          ${button("게임 선택", "secondary", "menu")}
        </div>
      </section>
    `;
  }
}

function renderHostControls(state) {
  if (state.game === "song") return "";
  if (state.game === "goldenbell") {
    return `
      <nav class="controls">
        ${button(state.revealAnswer ? "정답 숨기기" : "정답 공개", "primary", "reveal")}
        ${button("다음 문제", "secondary", "nextQuestion")}
        ${button("패자부활전", "secondary", "revival")}
        ${button("종료", "danger", "finish")}
      </nav>
    `;
  }

  if (state.game === "chain") {
    return `
      <nav class="controls">
        ${button("성공", "primary", "correct")}
        ${button("실패", "danger", "pass")}
        ${button("다음 주제", "secondary", "nextQuestion")}
        ${button("종료", "danger", "finish")}
      </nav>
    `;
  }

  if (state.game === "initials") {
    return `
      <nav class="controls">
        ${button("정답 공개/숨기기", "primary", "reveal")}
        ${button("다음 문제", "secondary", "nextQuestion")}
        ${button("종료", "danger", "finish")}
      </nav>
    `;
  }

  return `
    <nav class="controls">
      ${button("정답", "primary", "correct")}
      ${button("패스", "secondary", "pass")}
      ${button("종료", "danger", "finish")}
    </nav>
  `;
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
        <p class="label">${item.revival ? "패자부활전" : "문제"}</p>
        <p class="question">${item.question}</p>
        <p class="label">정답</p>
        <p class="answer small-answer">${item.answer}</p>
        <p class="helper-text">${currentState.revealAnswer ? "갤럭시탭에 정답 공개 중" : "아직 갤럭시탭에는 문제만 보입니다"}</p>
      </div>
    `;
  }
  if (game === "catchmind") {
    return `
      <div class="answer-panel">
        <p class="label">제시어</p>
        <p class="answer">${item.word}</p>
        <p class="helper-text" data-relay-status></p>
      </div>
    `;
  }
  if (game === "initials") {
    return `
      <div class="answer-panel">
        <p class="label">초성</p>
        <p class="answer initials-answer">${item.initials}</p>
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

  if (state.view === "instructions") {
    const rule = gameRules[state.game];
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-menu">
        <p class="eyebrow">게임 설명</p>
        <h1>${rule?.title || games[state.game].title}</h1>
        <div class="screen-rule-list">
          ${(rule?.lines || []).map((line) => `<p>${line}</p>`).join("")}
        </div>
        <p class="helper-text">아이폰 진행자 화면에서 설정을 이어갑니다.</p>
      </section>
    `;
    return;
  }

  if (state.view === "setup") {
    if (state.game === "song") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">노래맞추기</p>
          <h1>노래 준비</h1>
          <p class="screen-sub">진행자가 점수판을 시작합니다</p>
          ${renderScoreboard(state, false)}
        </section>
      `;
      return;
    }
    if (state.game === "quiet") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">조용히 먹기</p>
          <h1>과자 준비</h1>
          <label class="field quiet-name-field">
            <span>도전자 이름</span>
            <input id="quietNameInput" type="text" maxlength="12" value="${escapeHtml(state.quietName || "")}" placeholder="예: 1번 도전자" />
          </label>
          <button type="button" class="start-button" data-action="quietStart">측정 시작</button>
          <p class="screen-sub">마이크 권한을 허용해주세요</p>
          ${renderQuietLeaderboard(state.quietResults)}
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">시간맞추기</p>
          <h1>목표 ${Number(state.timingTarget || 7.77).toFixed(2)}초</h1>
          <p class="screen-sub">진행자가 게임 시작을 누르면 도전할 수 있습니다.</p>
          ${renderTimingLeaderboard(state.timingResults)}
        </section>
      `;
      return;
    }

    const isGoldenbell = state.game === "goldenbell";
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-menu">
        <p class="eyebrow">${isGoldenbell ? "골든벨 준비" : "카테고리 선택"}</p>
        <h1>${games[state.game].title}</h1>
        ${
          isGoldenbell
            ? `<p class="screen-sub">카테고리 없이 전체 문제로 진행합니다</p>`
            : `<p class="screen-sub">참가자들이 카테고리를 골라주세요</p>
               <div class="chip-row screen-chip-row">
                 ${categoryButtons(state.game, state.category)}
               </div>`
        }
        <p class="helper-text">아이폰 진행자 화면에서 타이머를 맞추고 시작하면 됩니다.</p>
      </section>
    `;
    return;
  }

  if (state.view === "roulette") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card">
        <p class="eyebrow">${games[state.game].title}</p>
        <h1>카테고리 추첨</h1>
        ${renderCategoryDraw(state, true)}
      </section>
    `;
    return;
  }

  if (state.view === "drawResult") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="draw-result-panel screen-draw-result">
        <p class="eyebrow">카테고리 결정</p>
        <h1>결정!</h1>
        <p class="draw-result-word">${state.category}</p>
      </section>
    `;
    return;
  }

  if (state.view === "ready") {
    if (state.game === "quiet") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">조용히 먹기</p>
          <h1>측정 준비</h1>
          <button type="button" class="start-button" data-action="quietStart">측정 시작</button>
          <p class="screen-sub">과자를 먹기 직전에 눌러주세요</p>
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">시간맞추기</p>
          <h1>${Number(state.timingTarget || 7.77).toFixed(2)}초 맞추기</h1>
          <label class="field quiet-name-field">
            <span>도전자 이름</span>
            <input id="timingNameInput" type="text" maxlength="12" value="${escapeHtml(state.timingName || "")}" placeholder="예: 1번 도전자" />
          </label>
          <button type="button" class="start-button" data-action="timingStart">START</button>
          ${renderTimingLeaderboard(state.timingResults)}
        </section>
      `;
      return;
    }

    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card ready-card">
        <p class="eyebrow">${games[state.game].title}</p>
        <h1>READY</h1>
        <p class="screen-sub">진행자가 START를 누르면 시작합니다</p>
      </section>
    `;
    return;
  }

  if (state.view === "quietCountdown") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card quiet-screen">
        <p class="eyebrow">조용히 먹기</p>
        <h1>${escapeHtml(state.quietName || "도전자")}</h1>
        <p class="quiet-countdown" data-quiet-countdown>${Math.max(1, Math.ceil(((state.countdownEndAt || Date.now()) - Date.now()) / 1000))}</p>
        <p class="screen-sub">카운트다운 후 측정 시작</p>
      </section>
    `;
    return;
  }

  if (state.view === "result") {
    if (state.game === "quiet") {
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">조용히 먹기 결과</p>
          <h1>순위표</h1>
          ${renderQuietLeaderboard(state.quietResults)}
          <button type="button" class="primary" data-action="setup">다음 도전자</button>
        </section>
      `;
      return;
    }
    if (state.game === "timing") {
      const elapsed = Number(state.timingElapsed || 0);
      const diff = Math.abs(elapsed - Number(state.timingTarget || 7.77));
      screenRoot.innerHTML = `
        <div class="screen-room">방: ${room}</div>
        <section class="screen-card quiet-screen">
          <p class="eyebrow">시간맞추기 결과</p>
          <h1>${elapsed.toFixed(2)}초</h1>
          <p class="screen-sub">목표 ${Number(state.timingTarget || 7.77).toFixed(2)}초 · 오차 ${diff.toFixed(2)}초</p>
          ${renderTimingLeaderboard(state.timingResults)}
          <button type="button" class="primary" data-action="setup">다음 도전자</button>
        </section>
      `;
      return;
    }

    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card">
        <p class="eyebrow">게임 종료</p>
        <h1>${state.game === "goldenbell" ? "골든벨 종료" : `${state.score || 0}개 정답`}</h1>
        <p class="screen-sub">${state.game === "goldenbell" ? "수고하셨습니다" : `패스 ${state.pass || 0}개`}</p>
      </section>
    `;
    return;
  }

  if (state.game === "song" && state.view === "playing") {
    screenRoot.innerHTML = `
      <div class="screen-room">방: ${room}</div>
      <section class="screen-card quiet-screen">
        <p class="eyebrow">노래맞추기</p>
        <h1>맞힌 팀에 점수!</h1>
        ${renderScoreboard(state, false)}
      </section>
    `;
    return;
  }

  screenRoot.innerHTML = `
    <div class="screen-room">방: ${room}</div>
    <div id="screenTimer" class="screen-counter"></div>
    ${state.feedback ? `<div class="feedback-badge">${state.feedback}</div>` : ""}
    ${renderScreenItem(state.game, state.currentItem)}
  `;
  setupCatchmindCanvas();
}

function renderScreenItem(game, item) {
  if (game === "quiet") {
    return `
      <section class="screen-card quiet-screen">
        <p class="eyebrow">측정 중</p>
        <h1>${escapeHtml(currentState.quietName || "도전자")}</h1>
        ${renderQuietGauge(currentState.quietCurrentLevel, currentState.quietPeakLevel)}
        <p class="screen-sub">${currentState.quietError || "진행자가 확인 후 종료합니다."}</p>
      </section>
    `;
  }
  if (game === "timing") {
    return `
      <section class="timing-stage">
        <p>${escapeHtml(currentState.timingName || "도전자")}</p>
        <button type="button" class="timing-stop-button" data-action="timingStop">STOP</button>
      </section>
    `;
  }

  if (!item) return `<section class="screen-card"><h1>문제가 없습니다</h1></section>`;
  if (game === "person") return `<img class="screen-image" src="${item.image}" alt="문제 인물 사진" />`;
  if (game === "goldenbell") {
    return `
      <section class="screen-card">
        <p class="eyebrow">${item.revival ? "패자부활전" : "골든벨"}</p>
        <h1>${item.question}</h1>
        ${currentState.revealAnswer ? `<p class="answer reveal-answer">${item.answer}</p>` : ""}
      </section>
    `;
  }
  if (game === "catchmind") {
    const relayInfo = getCatchmindRelayInfo(currentState);
    const locked = relayInfo?.phase !== "draw";
    const lockText = relayInfo?.phase === "guess"
      ? "그림 완성 · 정답 맞히기"
      : relayInfo?.phase === "locked"
        ? "다음 그림 담당자 준비"
        : "1번 그림 담당자 준비";
    return `
      <section class="catchmind-stage">
        <p class="eyebrow">캐치마인드</p>
        <h1 class="catchmind-prompt">제시어: ${escapeHtml(item.word)}</h1>
        <p class="screen-sub" data-relay-status></p>
        <div class="catchmind-board">
          <canvas id="catchmindCanvas" class="draw-canvas" width="1100" height="620"></canvas>
          ${
            locked
              ? `<div class="canvas-lock">
                  <strong>${lockText}</strong>
                  ${relayInfo?.phase === "guess" ? "" : `<button type="button" class="start-button" data-action="relayStart">START</button>`}
                </div>`
              : ""
          }
        </div>
        <div class="canvas-tools">
          <button type="button" class="secondary" data-action="clearCanvas">그림 지우기</button>
        </div>
      </section>
    `;
  }
  if (game === "initials") {
    return `
      <section class="screen-card initials-screen">
        <p class="eyebrow">${games[game].title}</p>
        <h1>${item.initials}</h1>
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
  if ((currentState?.game !== "quiet" || !["playing", "quietCountdown"].includes(currentState?.view)) && quietMeter) {
    stopQuietMeterStream();
  }
  syncAudio(currentState || defaultState);
  if (isHost) renderHost();
  else {
    if (currentState?.game === "catchmind" && currentState?.view === "playing") captureCatchmindCanvas();
    else catchmindSnapshot = null;
    renderScreen();
  }
  renderTimer();
}

function captureCatchmindCanvas() {
  const canvas = document.querySelector("#catchmindCanvas");
  if (!canvas) return;
  if (isCanvasBlank(canvas) && catchmindSnapshot) return;
  catchmindSnapshot = canvas.toDataURL("image/png");
  catchmindHasInk = !isCanvasBlank(canvas);
}

function isCanvasBlank(canvas) {
  const context = canvas.getContext("2d");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return false;
  }
  return true;
}

function setupCatchmindCanvas() {
  const canvas = document.querySelector("#catchmindCanvas");
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = "true";
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 8;
  context.strokeStyle = "#172033";

  if (catchmindSnapshot) {
    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      catchmindHasInk = true;
    };
    image.src = catchmindSnapshot;
  }

  let drawing = false;

  function canDraw() {
    return currentState?.game === "catchmind" && currentState?.view === "playing" && currentState?.relayPhase === "drawing";
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!canDraw()) return;
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !canDraw()) return;
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
    catchmindHasInk = true;
  });

  canvas.addEventListener("pointerup", () => {
    drawing = false;
    if (catchmindHasInk) catchmindSnapshot = canvas.toDataURL("image/png");
  });

  canvas.addEventListener("pointercancel", () => {
    drawing = false;
    if (catchmindHasInk) catchmindSnapshot = canvas.toDataURL("image/png");
  });
}

function clearCatchmindCanvas() {
  const canvas = document.querySelector("#catchmindCanvas");
  if (!canvas) return;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  catchmindSnapshot = null;
  catchmindHasInk = false;
}

function bindActions(root) {
  if (!root) return;

  root.addEventListener("input", (event) => {
    if (event.target.id === "durationInput") {
      currentState.duration = Number(event.target.value || 60);
    }
    if (event.target.id === "teamSizeInput") {
      currentState.teamSize = Number(event.target.value || 4);
    }
    if (event.target.id === "relaySecondsInput") {
      currentState.relaySeconds = Number(event.target.value || 5);
    }
    if (event.target.id === "timingTargetInput") {
      currentState.timingTarget = Number(event.target.value || 7.77);
    }
    if (event.target.id === "questionLimitInput") {
      currentState.questionLimit = Number(event.target.value || 10);
    }
    if (event.target.id?.startsWith("teamName-")) {
      const index = Number(event.target.id.slice("teamName-".length));
      const teams = buildTeams(currentState.teamCount || 2, currentState.teams);
      if (teams[index]) teams[index].name = event.target.value || `${String.fromCharCode(65 + index)}팀`;
      currentState.teams = teams;
    }
    if (event.target.id === "quietNameInput") {
      currentState.quietName = event.target.value;
    }
    if (event.target.id === "timingNameInput") {
      currentState.timingName = event.target.value;
    }
  });

  root.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action.startsWith("game:")) return chooseGame(action.slice(5));
    if (action.startsWith("category:")) return chooseCategory(action.slice(9));
    if (action.startsWith("mode:")) return setPlayMode(action.slice(5));
    if (action.startsWith("teamCount:")) return setTeamCount(Number(action.slice(10)));
    if (action.startsWith("teamScore:")) return awardTeam(Number(action.slice(10)));
    if (action === "teamReset") return resetTeamScores();
    if (action === "roulette") return openRoulette();
    if (action === "spinRoulette" && !currentState.rouletteSpinning) return spinRoulette();
    if (action === "clearCanvas") return clearCatchmindCanvas();
    if (action === "quietStart") return startQuietMeter();
    if (action === "timingStart") return startTimingChallenge();
    if (action === "timingStop") return stopTimingChallenge();
    if (action === "relayStart") return startCatchmindTurn();
    if (!isHost && currentState?.game === "quiet" && action === "setup") {
      stopQuietMeterStream();
      return saveState({
        view: "setup",
        quietName: "",
        quietCurrentLevel: 0,
        quietPeakLevel: 0,
        quietError: null,
      });
    }
    if (!isHost && currentState?.game === "timing" && action === "setup") {
      return saveState({
        view: "setup",
        timingName: "",
        timingStartedAt: null,
        timingElapsed: null,
      });
    }
    if (!isHost) return;

    if (action === "menu") return saveState({ ...defaultState, usedIds: currentState?.usedIds || {} });
    if (action === "setup") {
      stopQuietMeterStream();
      return saveState({
        view: "setup",
        endAt: null,
        quietName: currentState?.game === "quiet" ? "" : currentState?.quietName,
        quietCurrentLevel: 0,
        quietPeakLevel: currentState?.game === "quiet" ? 0 : currentState?.quietPeakLevel,
        quietError: null,
        timingName: currentState?.game === "timing" ? "" : currentState?.timingName,
        timingStartedAt: null,
        timingElapsed: currentState?.game === "timing" ? null : currentState?.timingElapsed,
      });
    }
    if (action === "start") return startRound();
    if (action === "begin") return beginPlaying();
    if (action === "reveal") return toggleRevealAnswer();
    if (action === "revival") return revivalQuestion();
    if (action === "nextQuestion") return nextQuestion();
    if (action === "correct") return markResult("correct");
    if (action === "pass") return markResult("pass");
    if (action === "finish") return finishRound();
    if (action === "resetUsed") return resetUsed();
    if (action === "quietReset") return resetQuietResults();
    if (action === "timingReset") return resetTimingResults();
    if (action === "quietStop") return finishQuietByHost();
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
  if (shouldResetRoom) {
    currentState = clone(defaultState);
    await saveState(currentState);
  } else if (!snapshot.exists()) {
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
if (homeButton) homeButton.addEventListener("click", resetAllGameData);
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
  stopQuietMeterStream();
  stopTimingMusic();
});
