import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------------------------
   Quotes (Opción A: por fecha)
---------------------------- */
const quotes = [
  "You're doing great. One day at a time.",
  "Take a deep breath. You're doing amazing.",
  "You are enough, just as you are.",
  "Tiny steps still move you forward.",
  "Breathe in. Breathe out. Keep going.",

  "Stay steady. You’ve got this.",
  "Show up with purpose today.",
  "Do the next right thing.",
  "Let discipline carry you.",
  "Move with calm confidence.",
  "Focus. Execute. Repeat.",
  "Protect your peace and handle your priorities.",
  "Make it happen—quietly and consistently.",
  "Strong mind. Steady pace.",
  "You’re in control of your effort.",
  "Today is yours to lead.",
  "Keep your energy clean and your goals clear.",
  "Stay present. Stay sharp.",
  "Your habits are your power.",
  "You’re built for this.",
  "Take action. Build momentum.",
  "Do it with intention.",
  "Less stress. More focus.",
  "Trust yourself. Then prove it."
];

/* ---------------------------
   DOM
---------------------------- */
const authCard = document.getElementById("authCard");
const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logoutBtn");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const authMsg = document.getElementById("authMsg");

const datePill = document.getElementById("datePill");
const streakPill = document.getElementById("streakPill");
const quoteText = document.getElementById("quoteText");

const morningStatus = document.getElementById("morningStatus");
const nightStatus = document.getElementById("nightStatus");
const nightLock = document.getElementById("nightLock");
const nightBody = document.getElementById("nightBody");

const morningMsg = document.getElementById("morningMsg");
const nightMsg = document.getElementById("nightMsg");

const saveMorningBtn = document.getElementById("saveMorningBtn");
const saveNightBtn = document.getElementById("saveNightBtn");

// Morning inputs
const m1 = document.getElementById("m1");
const m2 = document.getElementById("m2");
const g1 = document.getElementById("g1");
const g2 = document.getElementById("g2");
const g3 = document.getElementById("g3");
const m4 = document.getElementById("m4");
const m5 = document.getElementById("m5");

// Night inputs (según tu index actual)
const n1 = document.getElementById("n1");
const n2 = document.getElementById("n2");
const n3 = document.getElementById("n3");
const n6 = document.getElementById("n6");

const c1 = document.getElementById("c1");
const c2 = document.getElementById("c2");
const c3 = document.getElementById("c3");
const cg1 = document.getElementById("cg1");
const cg2 = document.getElementById("cg2");
const cg3 = document.getElementById("cg3");

// Calendar/history
const calendarEl = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");

const viewTitle = document.getElementById("viewTitle");
const viewSubtitle = document.getElementById("viewSubtitle");
const roMorning = document.getElementById("roMorning");
const roNight = document.getElementById("roNight");

const topbar = document.getElementById("topbar");

/* ---------------------------
   Helpers
---------------------------- */
function pad(n){ return String(n).padStart(2,"0"); }

function toISODate(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatDateLong(d){
  return d.toLocaleDateString(undefined, { weekday:"short", year:"numeric", month:"short", day:"numeric" });
}

function formatMDY(d){
  return d.toLocaleDateString("en-US", { year:"numeric", month:"2-digit", day:"2-digit" });
}

function dayNumberUTC(d){
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utc / 86400000);
}

function quoteForDate(d){
  const idx = ((dayNumberUTC(d) % quotes.length) + quotes.length) % quotes.length;
  return { idx, text: quotes[idx] };
}

/* ---------------------------
   Firestore paths
---------------------------- */
function entryRef(uid, isoDate){
  return doc(db, "users", uid, "entries", isoDate);
}

/* ---------------------------
   Auth actions
---------------------------- */
loginBtn.addEventListener("click", async () => {
  authMsg.textContent = "";
  try{
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  }catch(e){
    authMsg.textContent = e.message;
  }
});

signupBtn.addEventListener("click", async () => {
  authMsg.textContent = "";
  try{
    await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  }catch(e){
    authMsg.textContent = e.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

/* ---------------------------
   State
---------------------------- */
let currentUser = null;

// OJO: estos valores se “congelan” si no los refrescamos.
// Este es el bug que te dejaba el streak en 1.
let today = new Date();
let currentISO = toISODate(today);
let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

let selectedISO = null;
let calendarRenderToken = 0;

/* ---------------------------
   ✅ FIX STREAK: refrescar día + sincronizar cuando cambia el día
---------------------------- */
function refreshDayVars(){
  today = new Date();
  currentISO = toISODate(today);
}

async function syncToTodayIfNeeded(){
  if(!currentUser) return;

  const newISO = toISODate(new Date());
  if(newISO === currentISO) return; // mismo día, no hagas nada

  // Cambió el día (o la app estuvo abierta en background)
  refreshDayVars();

  // UI date + quote
  datePill.textContent = formatDateLong(today);
  const q = quoteForDate(today);
  quoteText.textContent = q.text;

  // Asegurar doc de hoy y cargar
  await ensureTodayDoc(q.idx);
  await loadTodayIntoForm();
  await computeAndShowStreak();
  await renderCalendar();
}

/* ---------------------------
   Auth state → init UI
---------------------------- */
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  refreshDayVars();

  if(!currentUser){
    if(topbar) topbar.style.display = "none";
    authCard.style.display = "";
    dashboard.style.display = "none";
    logoutBtn.style.display = "none";
    return;
  }

  if(topbar) topbar.style.display = "";
  authCard.style.display = "none";
  dashboard.style.display = "";
  logoutBtn.style.display = "";

  datePill.textContent = formatDateLong(today);

  const q = quoteForDate(today);
  quoteText.textContent = q.text;

  await ensureTodayDoc(q.idx);
  await loadTodayIntoForm();
  await computeAndShowStreak();
  await renderCalendar();
});

/* ---------------------------
   Ensure today doc exists
---------------------------- */
async function ensureTodayDoc(quoteIndex){
  const ref = entryRef(currentUser.uid, currentISO);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      date: currentISO,
      quoteIndex,
      morningCompleted: false,
      nightCompleted: false,
      morning: { answers: {}, goals: ["","",""] },
      night: { answers: {}, goalsDone: [false,false,false] },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function setNightLocked(locked){
  if(locked){
    nightStatus.textContent = "Locked";
    nightLock.style.display = "";
    nightBody.style.display = "none";
  }else{
    nightStatus.textContent = "Unlocked";
    nightLock.style.display = "none";
    nightBody.style.display = "";
  }
}

function paintStatus(el, done){
  el.textContent = done ? "Completed" : (el === nightStatus ? el.textContent : "Not completed");
  el.style.borderColor = done ? "rgba(92,225,166,0.35)" : "rgba(255,255,255,0.12)";
  el.style.background = done ? "rgba(92,225,166,0.10)" : "rgba(255,255,255,0.03)";
}

async function loadTodayIntoForm(){
  const ref = entryRef(currentUser.uid, currentISO);
  const snap = await getDoc(ref);
  const data = snap.data();

  // Quote estable
  const qi = typeof data.quoteIndex === "number" ? data.quoteIndex : quoteForDate(today).idx;
  quoteText.textContent = quotes[qi] || quoteForDate(today).text;

  // Morning
  const ma = data.morning?.answers || {};
  const goals = data.morning?.goals || ["","",""];

  m1.value = ma.m1 || "";
  m2.value = ma.m2 || "";
  g1.value = goals[0] || "";
  g2.value = goals[1] || "";
  g3.value = goals[2] || "";
  m4.value = ma.m4 || "";
  m5.value = ma.m5 || "";

  // Night
  const na = data.night?.answers || {};
  const gd = data.night?.goalsDone || [false,false,false];

  n1.value = na.n1 || "";
  n2.value = na.n2 || "";
  n3.value = na.n3 || "";
  n6.value = na.n6 || "";

  c1.checked = !!gd[0];
  c2.checked = !!gd[1];
  c3.checked = !!gd[2];

  // Goals labels en night
  cg1.textContent = goals[0] ? goals[0] : "Goal 1";
  cg2.textContent = goals[1] ? goals[1] : "Goal 2";
  cg3.textContent = goals[2] ? goals[2] : "Goal 3";

  const morningDone = !!data.morningCompleted;
  const nightDone = !!data.nightCompleted;

  paintStatus(morningStatus, morningDone);
  setNightLocked(!morningDone);

  if(nightDone){
    nightStatus.textContent = "Completed";
    paintStatus(nightStatus, true);
  }else{
    nightStatus.textContent = morningDone ? "Unlocked" : "Locked";
    paintStatus(nightStatus, false);
  }
}

/* ---------------------------
   Save Morning / Night
---------------------------- */
saveMorningBtn.addEventListener("click", async () => {
  morningMsg.textContent = "";
  if(!currentUser) return;

  // ✅ FIX: si cambió el día, sincroniza antes de guardar
  await syncToTodayIfNeeded();

  const ref = entryRef(currentUser.uid, currentISO);
  const goals = [g1.value.trim(), g2.value.trim(), g3.value.trim()];

  await updateDoc(ref, {
    "morning.answers": {
      m1: m1.value.trim(),
      m2: m2.value.trim(),
      m4: m4.value.trim(),
      m5: m5.value.trim(),
    },
    "morning.goals": goals,
    morningCompleted: true,
    updatedAt: serverTimestamp()
  });

  morningMsg.textContent = "Saved.";
  cg1.textContent = goals[0] || "Goal 1";
  cg2.textContent = goals[1] || "Goal 2";
  cg3.textContent = goals[2] || "Goal 3";

  await loadTodayIntoForm();
  await renderCalendar();
});

saveNightBtn.addEventListener("click", async () => {
  nightMsg.textContent = "";
  if(!currentUser) return;

  // ✅ FIX: si cambió el día, sincroniza antes de guardar
  await syncToTodayIfNeeded();

  const ref = entryRef(currentUser.uid, currentISO);
  const snap = await getDoc(ref);
  const data = snap.data();

  if(!data.morningCompleted){
    nightMsg.textContent = "Complete Morning first.";
    return;
  }

  await updateDoc(ref, {
    "night.answers": {
      n1: n1.value.trim(),
      n2: n2.value.trim(),
      n3: n3.value.trim(),
      n6: n6.value.trim(),
    },
    "night.goalsDone": [c1.checked, c2.checked, c3.checked],
    nightCompleted: true,
    updatedAt: serverTimestamp()
  });

  nightMsg.textContent = "Saved.";
  await loadTodayIntoForm();
  await computeAndShowStreak();
  await renderCalendar();
});

/* ---------------------------
   ✅ STREAK (cuenta días consecutivos con NIGHT completo)
   FIX: siempre usa la fecha real “hoy” (refresca antes de contar)
---------------------------- */
async function computeAndShowStreak(){
  if(!currentUser) return;

  // ✅ FIX: refresh para que no use un “hoy” viejo
  refreshDayVars();

  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while(true){
    const iso = toISODate(cursor);
    const snap = await getDoc(entryRef(currentUser.uid, iso));
    if(!snap.exists()) break;

    const data = snap.data();
    if(!data.nightCompleted) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);

    if(streak > 3650) break;
  }

  streakPill.textContent = `🔥 ${streak}-day streak`;
}

/* ---------------------------
   Calendar (month view) FIX
---------------------------- */
prevMonthBtn.addEventListener("click", async () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1);
  await renderCalendar();
});

nextMonthBtn.addEventListener("click", async () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1);
  await renderCalendar();
});

async function renderCalendar(){
  if(!currentUser) return;

  const token = ++calendarRenderToken;

  calendarEl.innerHTML = "";
  monthTitle.textContent = currentMonth.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 0);
  const startDow = first.getDay();

  const days = [];
  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = toISODate(d);
    days.push({ day, iso });
  }

  const snaps = await Promise.all(days.map(({ iso }) => getDoc(entryRef(currentUser.uid, iso))));
  if(token !== calendarRenderToken) return;

  const hasEntry = new Set();
  snaps.forEach((snap, i) => {
    if(snap.exists()) hasEntry.add(days[i].iso);
  });

  for(let i=0;i<startDow;i++){
    const div = document.createElement("div");
    div.className = "day mutedDay";
    calendarEl.appendChild(div);
  }

  for(const { day, iso } of days){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.textContent = String(day);

    if(hasEntry.has(iso)) btn.classList.add("hasEntry");
    if(iso === selectedISO) btn.classList.add("selected");

    btn.addEventListener("click", async () => {
      selectedISO = iso;
      await showReadOnlyDay(iso);
      await renderCalendar();
    });

    calendarEl.appendChild(btn);
  }
}

/* ---------------------------
   Read-only viewer (MM/DD/YYYY)
---------------------------- */
async function showReadOnlyDay(iso){
  if(!currentUser) return;
  const ref = entryRef(currentUser.uid, iso);
  const snap = await getDoc(ref);

  const dTitle = new Date(iso + "T00:00:00");
  viewTitle.textContent = formatMDY(dTitle);
  viewSubtitle.textContent = snap.exists() ? "Saved entry" : "No entry for this day";

  if(!snap.exists()){
    roMorning.textContent = "—";
    roNight.textContent = "—";
    return;
  }

  const data = snap.data();
  const d = new Date(iso + "T00:00:00");
  const qi = typeof data.quoteIndex === "number" ? data.quoteIndex : quoteForDate(d).idx;

  const ma = data.morning?.answers || {};
  const goals = data.morning?.goals || ["","",""];
  const na = data.night?.answers || {};
  const gd = data.night?.goalsDone || [false,false,false];

  roMorning.textContent =
`Quote: ${quotes[qi] || "—"}

Feel: ${ma.m1 || "—"}
Looking forward: ${ma.m2 || "—"}
Goals:
- ${goals[0] || "—"}
- ${goals[1] || "—"}
- ${goals[2] || "—"}
Keep in mind: ${ma.m4 || "—"}
Release: ${ma.m5 || "—"}`;

  roNight.textContent =
`Overall: ${na.n1 || "—"}
Good thing: ${na.n2 || "—"}
Challenge: ${na.n3 || "—"}
Carry into tomorrow: ${na.n6 || "—"}

Goals completed:
- ${goals[0] || "Goal 1"}: ${gd[0] ? "✅" : "—"}
- ${goals[1] || "Goal 2"}: ${gd[1] ? "✅" : "—"}
- ${goals[2] || "Goal 3"}: ${gd[2] ? "✅" : "—"}`;
}

/* ---------------------------
   ✅ FIX STREAK: cuando vuelves a la pestaña / app, sincroniza el día
---------------------------- */
window.addEventListener("focus", () => {
  if(currentUser) syncToTodayIfNeeded();
});

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && currentUser){
    syncToTodayIfNeeded();
  }
});

/* ---------------------------
   PWA (no cambia nada de tu app)
---------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}