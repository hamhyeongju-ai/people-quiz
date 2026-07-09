import { firebaseConfig, firebaseEnabled } from "./firebase-config.js";

const image = document.querySelector("#personImage");
const answer = document.querySelector("#answer");
const counter = document.querySelector("#counter");
const nextButton = document.querySelector("#nextButton");
const prevButton = document.querySelector("#prevButton");
const resetButton = document.querySelector("#resetButton");

const params = new URLSearchParams(window.location.search);
const room = params.get("room") || localStorage.getItem("quizRoom") || "main";
localStorage.setItem("quizRoom", room);

let people = [];
let currentIndex = 0;
let roomRef = null;
let firebaseSet = null;

function render() {
  const person = people[currentIndex] || null;
  const number = people.length ? currentIndex + 1 : 0;

  if (counter) counter.textContent = `${number} / ${people.length}`;

  if (!person) {
    if (image) image.removeAttribute("src");
    if (answer) answer.textContent = "문제가 없습니다";
    return;
  }

  if (image) {
    image.src = person.image;
    image.alt = `${person.name} 사진`;
  }

  if (answer) answer.textContent = person.name;
}

async function loadPeople() {
  const response = await fetch("/people.json", { cache: "no-store" });
  people = await response.json();
  render();
}

function normalizeIndex(index) {
  if (!people.length) return 0;
  return (index + people.length) % people.length;
}

async function move(delta) {
  currentIndex = normalizeIndex(currentIndex + delta);
  render();
  await saveIndex(currentIndex);
}

async function reset() {
  currentIndex = 0;
  render();
  await saveIndex(currentIndex);
}

async function saveIndex(index) {
  if (roomRef && firebaseSet) {
    await firebaseSet(roomRef, {
      currentIndex: index,
      updatedAt: Date.now(),
    });
    return;
  }

  localStorage.setItem(`quiz:${room}:currentIndex`, String(index));
}

async function setupRealtime() {
  if (!firebaseEnabled) {
    const saved = Number(localStorage.getItem(`quiz:${room}:currentIndex`) || 0);
    currentIndex = normalizeIndex(saved);
    render();
    return;
  }

  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"
  );
  const { get, getDatabase, onValue, ref, set } = await import(
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"
  );

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  roomRef = ref(db, `rooms/${room}`);
  firebaseSet = set;

  const snapshot = await get(roomRef);
  if (!snapshot.exists()) {
    await saveIndex(currentIndex);
  }

  onValue(roomRef, (snapshot) => {
    const state = snapshot.val();
    currentIndex = normalizeIndex(Number(state?.currentIndex || 0));
    render();
  });
}

if (nextButton) nextButton.addEventListener("click", () => move(1));
if (prevButton) prevButton.addEventListener("click", () => move(-1));
if (resetButton) resetButton.addEventListener("click", reset);

loadPeople()
  .then(setupRealtime)
  .catch(() => {
    if (answer) answer.textContent = "문제 목록을 불러오지 못했습니다";
  });
