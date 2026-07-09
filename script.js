import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseReady = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("PASTE_");
const googleReady = window.GOOGLE_CLIENT_ID && !window.GOOGLE_CLIENT_ID.includes("PASTE_");

let supabase = null;
let user = null;
let tasks = [];
let activeFilter = "all";
let parsedTasks = [];
let googleToken = null;
let tokenClient = null;

const authView = document.getElementById("authView");
const resetPasswordView = document.getElementById("resetPasswordView");
const appView = document.getElementById("appView");
const authMessage = document.getElementById("authMessage");

const views = {
  dashboard: document.getElementById("dashboardView"),
  brain: document.getElementById("brainView"),
  tasks: document.getElementById("tasksView"),
  planner: document.getElementById("plannerView"),
  summary: document.getElementById("summaryView"),
  settings: document.getElementById("settingsView")
};

document.getElementById("dateLine").textContent = new Date().toLocaleDateString("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

if (!supabaseReady) {
  authMessage.textContent = "צריך להדביק Supabase Publishable Key בקובץ config.js";
} else {
  supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  init();
}

async function init() {
  const { data } = await supabase.auth.getSession();
  user = data.session?.user || null;

  const hash = new URLSearchParams(window.location.hash.replace("#", ""));
  const type = hash.get("type");
  if (type === "recovery") {
    showResetPassword();
  } else {
    user ? await enterApp() : showAuth();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    user = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      showResetPassword();
      return;
    }
    user ? await enterApp() : showAuth();
  });

  initGoogle();
}

function showAuth() {
  authView.classList.remove("hidden");
  resetPasswordView.classList.add("hidden");
  appView.classList.add("hidden");
}

async function enterApp() {
  authView.classList.add("hidden");
  resetPasswordView.classList.add("hidden");
  appView.classList.remove("hidden");
  document.getElementById("userLabel").textContent = user.user_metadata?.name || user.email;
  document.getElementById("settingsEmail").textContent = user.email;
  await loadTasks();
}

function showResetPassword() {
  authView.classList.add("hidden");
  appView.classList.add("hidden");
  resetPasswordView.classList.remove("hidden");
}

function initGoogle() {
  const tryInit = () => {
    if (!googleReady || !window.google?.accounts?.oauth2) return false;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: window.GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (response) => {
        if (response.error) {
          alert("שגיאה בחיבור Google: " + response.error);
          return;
        }
        googleToken = response.access_token;
        document.getElementById("googleBtn").textContent = "Google Calendar מחובר";
        document.getElementById("googleStatusText").textContent = "מחובר";
      }
    });
    return true;
  };

  if (!tryInit()) {
    const timer = setInterval(() => {
      if (tryInit()) clearInterval(timer);
    }, 500);
  }
}

document.getElementById("loginTab").addEventListener("click", () => setAuthMode("login"));
document.getElementById("signupTab").addEventListener("click", () => setAuthMode("signup"));

function setAuthMode(mode) {
  const login = mode === "login";
  document.getElementById("loginForm").classList.toggle("hidden", !login);
  document.getElementById("signupForm").classList.toggle("hidden", login);
  document.getElementById("loginTab").classList.toggle("active", login);
  document.getElementById("signupTab").classList.toggle("active", !login);
  authMessage.textContent = "";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMessage.textContent = "נכנסת...";
  const { error } = await supabase.auth.signInWithPassword({
    email: document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginPassword").value
  });
  if (error) authMessage.textContent = translateAuthError(error.message);
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMessage.textContent = "יוצרת משתמש...";
  const { error } = await supabase.auth.signUp({
    email: document.getElementById("signupEmail").value.trim(),
    password: document.getElementById("signupPassword").value,
    options: { data: { name: document.getElementById("signupName").value.trim() } }
  });
  authMessage.textContent = error ? translateAuthError(error.message) : "נוצר משתמש. אם יש אימות מייל — צריך לאשר במייל.";
});

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim() || prompt("לאיזה אימייל לשלוח קישור לאיפוס סיסמה?");
  if (!email) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  authMessage.textContent = error ? translateAuthError(error.message) : "שלחתי לך מייל לאיפוס סיסמה.";
});

document.getElementById("resetPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("newPasswordInput").value;
  const confirm = document.getElementById("confirmPasswordInput").value;
  const message = document.getElementById("resetPasswordMessage");

  if (password.length < 6) {
    message.textContent = "הסיסמה צריכה להיות לפחות 6 תווים.";
    return;
  }
  if (password !== confirm) {
    message.textContent = "הסיסמאות לא זהות.";
    return;
  }

  message.textContent = "מעדכנת סיסמה...";
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    message.textContent = translateAuthError(error.message);
    return;
  }
  message.textContent = "הסיסמה עודכנה בהצלחה.";
  setTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    user = data.session?.user || user;
    await enterApp();
  }, 800);
});

document.getElementById("logoutBtn").addEventListener("click", () => supabase.auth.signOut());
document.getElementById("mobileLogoutBtn").addEventListener("click", () => supabase.auth.signOut());
document.getElementById("refreshBtn").addEventListener("click", loadTasks);

document.getElementById("googleBtn").addEventListener("click", connectGoogle);
document.getElementById("settingsGoogleBtn").addEventListener("click", connectGoogle);

function connectGoogle() {
  if (!googleReady) return alert("צריך להדביק GOOGLE_CLIENT_ID בקובץ config.js");
  if (!tokenClient) return alert("Google עדיין נטען. נסי שוב עוד רגע.");
  tokenClient.requestAccessToken({ prompt: googleToken ? "" : "consent" });
}

document.getElementById("notifyBtn").addEventListener("click", requestNotifications);
document.getElementById("settingsNotifyBtn").addEventListener("click", requestNotifications);

async function requestNotifications() {
  if (!("Notification" in window)) return alert("הדפדפן לא תומך בהתראות.");
  const permission = await Notification.requestPermission();
  alert(permission === "granted" ? "התראות הופעלו. האתר צריך להיות פתוח כדי לשלוח תזכורות." : "לא אושרו התראות.");
}

document.getElementById("changePasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const p1 = document.getElementById("settingsNewPassword").value;
  const p2 = document.getElementById("settingsConfirmPassword").value;
  const msg = document.getElementById("settingsPasswordMessage");

  if (p1.length < 6) {
    msg.textContent = "הסיסמה צריכה להיות לפחות 6 תווים.";
    return;
  }
  if (p1 !== p2) {
    msg.textContent = "הסיסמאות לא זהות.";
    return;
  }

  msg.textContent = "מעדכנת...";
  const { error } = await supabase.auth.updateUser({ password: p1 });
  msg.textContent = error ? translateAuthError(error.message) : "הסיסמה עודכנה בהצלחה.";
  if (!error) event.target.reset();
});

async function loadTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) return alert("שגיאה בטעינת משימות: " + error.message);
  tasks = data || [];
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderPlanner();
  renderSummary();
  renderAiCoach();
}

document.querySelectorAll(".nav, .mobile-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.action === "add") {
      switchView("dashboard");
      syncMobileActive("dashboard");
      document.getElementById("newTaskCard").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => document.getElementById("homeTitle").focus(), 300);
      return;
    }
    if (btn.dataset.view) switchView(btn.dataset.view);
  });
});

function switchView(view) {
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  Object.entries(views).forEach(([name, el]) => el.classList.toggle("hidden", name !== view));
  syncMobileActive(view);
  if (view === "summary") renderSummary();
  if (window.innerWidth <= 820) window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncMobileActive(view) {
  document.querySelectorAll(".mobile-nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function renderDashboard() {
  const open = tasks.filter(t => !isDone(t));
  const today = open.filter(isToday);
  const late = open.filter(isLate);
  const week = open.filter(isThisWeek);

  document.getElementById("openLine").textContent = `${open.length} פתוחות`;
  document.getElementById("todayLine").textContent = `${today.length} להיום`;
  document.getElementById("lateLine").textContent = `${late.length} באיחור`;
  document.getElementById("weekLine").textContent = `${week.length} השבוע`;

  const heroTitle = document.getElementById("heroTitle");
  const heroSubtitle = document.getElementById("heroSubtitle");

  if (late.length) {
    heroTitle.textContent = `יש ${late.length} דברים באיחור. לא נבהלות.`;
    heroSubtitle.textContent = "נבחר אחד, נעשה צעד ראשון, ונחזיר שליטה.";
  } else if (today.length) {
    heroTitle.textContent = `יש ${today.length} משימות להיום.`;
    heroSubtitle.textContent = "לא הכל יחד. רק מה שחשוב עכשיו.";
  } else if (open.length) {
    heroTitle.textContent = "אין משהו בוער להיום.";
    heroSubtitle.textContent = "זמן טוב לקדם משהו קטן לפני שהוא נהיה דחוף.";
  } else {
    heroTitle.textContent = "הכל נקי. נדיר.";
    heroSubtitle.textContent = "אפשר להוסיף Brain Dump כשדברים קופצים.";
  }

  const next = chooseNextTask();
  document.getElementById("nextAction").innerHTML = next
    ? `<h4>${escapeHtml(next.title)}</h4><p>${nextReason(next)}</p><button class="primary" onclick="window.openEdit('${next.id}')">לפתוח</button>`
    : `<h4>אין משימה דחופה כרגע ✨</h4><p>אפשר להוסיף משימה חדשה או פשוט לנשום רגע.</p>`;

  document.getElementById("todayList").innerHTML = today.length
    ? today.slice(0, 5).map(cleanItem).join("")
    : `<div class="empty">אין משימות להיום. חלום.</div>`;
}

function cleanItem(task) {
  return `<div class="clean-item"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.category)} · ${formatDate(task.deadline)}</span></div>`;
}

function chooseNextTask() {
  const open = tasks.filter(t => !isDone(t));
  return open.find(isLate)
    || open.find(isToday)
    || open.filter(t => t.priority === "גבוהה").sort(sortByDeadline)[0]
    || open.filter(t => t.complexity === "קטנה").sort(sortByDeadline)[0]
    || open.sort(sortByDeadline)[0];
}

function nextReason(task) {
  if (isLate(task)) return "זו המשימה הכי דחופה כי היא כבר עברה את הדדליין.";
  if (isToday(task)) return "זו משימה להיום, אז כדאי לתת לה יחס עכשיו.";
  if (task.priority === "גבוהה") return "היא מסומנת בדחיפות גבוהה.";
  if (task.complexity === "קטנה") return "זו משימה קטנה יחסית — טובה למומנטום.";
  return "זו נראית כמו המשימה הבאה הכי נכונה לפי הדדליין והסטטוס.";
}

function renderAiCoach() {
  const box = document.getElementById("aiCoachContent");
  const open = tasks.filter(t => !isDone(t));
  const noDate = open.filter(t => !t.deadline);

  if (!open.length) {
    box.innerHTML = `<div class="ai-main-pick"><h4>הכל נקי כרגע ✨</h4><p>אין משימות פתוחות. אם משהו קופץ לך לראש, תוסיפי אותו בטופס מתחת.</p></div>`;
    return;
  }

  const pick = chooseNextTask();
  const topThree = [...open].sort((a, b) => aiTaskScore(b) - aiTaskScore(a)).slice(0, 3);
  const postpone = noDate.filter(t => t.id !== pick?.id).slice(0, 3);

  box.innerHTML = `
    <div class="ai-main-pick">
      <h4>${escapeHtml(pick.title)}</h4>
      <p>${aiCoachReason(pick)}</p>
      <button class="primary" onclick="window.openEdit('${pick.id}')">לפתוח משימה</button>
    </div>
    <div class="ai-mini-row">
      <div class="ai-mini-box">
        <strong>היום הייתי מתמקדת ב־</strong>
        <ul>${topThree.map(task => `<li>${escapeHtml(task.title)} · ${task.estimate_minutes || 30} דק׳</li>`).join("")}</ul>
      </div>
      <div class="ai-mini-box">
        <strong>אפשר לא להילחץ מזה עכשיו</strong>
        <ul>${postpone.length ? postpone.map(task => `<li>${escapeHtml(task.title)}</li>`).join("") : `<li>אין הרבה דברים שאפשר לדחות כרגע.</li>`}</ul>
      </div>
    </div>`;
}

function aiTaskScore(task) {
  let score = 0;
  if (isLate(task)) score += 120;
  if (isToday(task)) score += 90;
  if (isThisWeek(task)) score += 40;
  if (task.priority === "גבוהה") score += 45;
  if (task.priority === "בינונית") score += 15;
  if (task.complexity === "קטנה") score += 12;
  if (Number(task.estimate_minutes || 30) <= 30) score += 8;
  return score;
}

function aiCoachReason(task) {
  if (isLate(task)) return "הייתי מתחילה מזה כי זו משימה באיחור. לא צריך לפתור הכל עכשיו — רק לפתוח אותה ולעשות צעד ראשון.";
  if (isToday(task)) return "זו משימה להיום, ולכן היא מקבלת עדיפות. אם תסיימי אותה, ירד הרבה רעש מהראש.";
  if (task.priority === "גבוהה") return "היא מסומנת כדחופה, ולכן הייתי מקדמת אותה לפני משימות קטנות ופחות חשובות.";
  if (Number(task.estimate_minutes || 30) <= 30) return "זו משימה יחסית קצרה, אז היא טובה להתחלה וליצירת מומנטום בלי להיכנס להצפה.";
  return "בחרתי בה לפי שילוב של דדליין, דחיפות וזמן משוער.";
}

document.getElementById("refreshAiCoachBtn").addEventListener("click", renderAiCoach);

function initHomeTaskForm() {
  document.querySelectorAll(".home-choice-row").forEach(row => {
    const target = document.getElementById(row.dataset.target);
    row.querySelectorAll(".home-choice").forEach(button => {
      button.addEventListener("click", () => {
        target.value = button.dataset.value;
        syncHomeChoices();
      });
    });
  });

  document.querySelectorAll(".quick-date").forEach(button => {
    button.addEventListener("click", () => {
      setHomeDate(button.dataset.date);
      document.querySelectorAll(".quick-date").forEach(b => b.classList.toggle("active", b === button));
    });
  });

  document.getElementById("homeTitle").addEventListener("input", () => {
    const raw = document.getElementById("homeTitle").value.trim();
    if (raw.length < 3) {
      document.getElementById("homePreview").classList.add("hidden");
      return;
    }
    showHomePreview(parseLineToTask(raw));
  });

  document.getElementById("homeSmartBtn").addEventListener("click", () => {
    const raw = document.getElementById("homeTitle").value.trim();
    if (!raw) return alert("כתבי קודם את המשימה ואז אלחצי סדר לי.");
    applyParsedToHomeForm(parseLineToTask(raw));
  });

  document.getElementById("homeTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = document.getElementById("homeTitle").value.trim();
    if (!raw) return;

    const payload = {
      title: raw,
      category: document.getElementById("homeCategory").value || "אחר",
      deadline: inputDateToIso(document.getElementById("homeDeadline").value),
      priority: document.getElementById("homePriority").value || "בינונית",
      complexity: document.getElementById("homeComplexity").value || "בינונית",
      status: "פתוחה",
      estimate_minutes: Number(document.getElementById("homeEstimate").value || 30),
      notes: document.getElementById("homeNotes").value.trim()
    };

    const sync = document.getElementById("homeSyncCalendar").checked;
    await createTask(payload, sync);

    event.target.reset();
    document.getElementById("homeCategory").value = "לימודים";
    document.getElementById("homePriority").value = "בינונית";
    document.getElementById("homeEstimate").value = "30";
    document.getElementById("homeComplexity").value = "בינונית";
    document.getElementById("homePreview").classList.add("hidden");
    document.querySelectorAll(".quick-date").forEach(b => b.classList.remove("active"));
    syncHomeChoices();
  });
}

function syncHomeChoices() {
  document.querySelectorAll(".home-choice-row").forEach(row => {
    const target = document.getElementById(row.dataset.target);
    row.querySelectorAll(".home-choice").forEach(button => {
      button.classList.toggle("selected", String(target.value) === String(button.dataset.value));
    });
  });
}

function applyParsedToHomeForm(parsed) {
  document.getElementById("homeCategory").value = parsed.category || "אחר";
  document.getElementById("homePriority").value = parsed.priority || "בינונית";
  document.getElementById("homeComplexity").value = parsed.complexity || "בינונית";
  document.getElementById("homeEstimate").value = String(parsed.estimate_minutes || 30);
  if (parsed.deadline) document.getElementById("homeDeadline").value = isoToInput(parsed.deadline);
  syncHomeChoices();
  showHomePreview(parsed);
}

function showHomePreview(task) {
  const box = document.getElementById("homePreview");
  box.innerHTML = `
    <span>🏷 ${escapeHtml(task.category || "אחר")}</span>
    <span>📅 ${formatDate(task.deadline)}</span>
    <span>🔥 ${priorityLabel(task.priority)}</span>
    <span>⏱ ${task.estimate_minutes || 30} דק׳</span>`;
  box.classList.remove("hidden");
}

function setHomeDate(type) {
  const input = document.getElementById("homeDeadline");
  if (type === "none") {
    input.value = "";
    return;
  }
  const d = new Date();
  if (type === "tomorrow") d.setDate(d.getDate() + 1);
  if (type === "week") d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  input.value = d.toISOString().slice(0, 16);
}

async function createTask(task, syncCalendar = false) {
  const payload = {
    user_id: user.id,
    title: task.title,
    category: task.category || "אחר",
    deadline: task.deadline || null,
    priority: task.priority || "בינונית",
    complexity: task.complexity || "בינונית",
    status: task.status || "פתוחה",
    estimate_minutes: task.estimate_minutes || 30,
    notes: task.notes || "",
    google_event_id: task.google_event_id || null,
    parent_task_id: task.parent_task_id || null,
    reminder_sent: false
  };

  if (syncCalendar) {
    const eventId = await upsertGoogleCalendarEvent(payload);
    if (eventId) payload.google_event_id = eventId;
  }

  const { error } = await supabase.from("tasks").insert(payload);
  if (error) return alert("שגיאה בהוספה: " + error.message);
  await loadTasks();
}

async function updateTask(id, payload) {
  const { error } = await supabase
    .from("tasks")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return alert("שגיאה בעדכון: " + error.message);
  await loadTasks();
}

async function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task?.google_event_id && googleToken) await deleteGoogleCalendarEvent(task.google_event_id);
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return alert("שגיאה במחיקה: " + error.message);
  await loadTasks();
}

async function upsertGoogleCalendarEvent(task, eventId = null) {
  if (!task.deadline) {
    alert("כדי להוסיף ליומן צריך דדליין.");
    return null;
  }
  if (!googleToken) {
    if (!googleReady || !tokenClient) {
      alert("צריך לחבר Google Calendar קודם.");
      return null;
    }
    tokenClient.requestAccessToken({ prompt: "consent" });
    alert("חיברתי את Google. לחצי שוב שמירה כדי לשלוח ליומן.");
    return null;
  }

  const start = new Date(task.deadline);
  const minutes = Number(task.estimate_minutes || 30);
  const end = new Date(start.getTime() + minutes * 60000);

  const event = {
    summary: task.title,
    description: `${task.notes || ""}\n\nנוצר מתוך MindFlow`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] }
  };

  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const method = eventId ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${googleToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });

  if (!res.ok) {
    alert("שגיאה מול Google Calendar. נסי להתחבר שוב.");
    return null;
  }

  const data = await res.json();
  return data.id;
}

async function deleteGoogleCalendarEvent(eventId) {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${googleToken}` }
  });
}

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === btn));
    renderTasks();
  });
});

document.getElementById("searchInput").addEventListener("input", renderTasks);

function renderTasks() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = tasks
    .filter(t => filterTask(t, activeFilter))
    .filter(t => !search || `${t.title} ${t.category} ${t.notes || ""}`.toLowerCase().includes(search))
    .sort(taskSort);

  document.getElementById("taskList").innerHTML = filtered.length
    ? filtered.map(taskCard).join("")
    : `<div class="empty">אין משימות שמתאימות לסינון הזה.</div>`;
}

function taskCard(task) {
  const late = isLate(task);
  const done = isDone(task);
  return `
    <article class="task-card ${late ? "late" : ""} ${done ? "done" : ""}">
      <button class="check" onclick="window.toggleDone('${task.id}')"></button>
      <div class="task-body">
        <h4>${escapeHtml(task.title)}</h4>
        <div class="meta">
          <span class="pill">${escapeHtml(task.category)}</span>
          <span class="pill ${task.priority === "גבוהה" ? "hot" : ""}">${priorityLabel(task.priority)}</span>
          <span class="pill">${escapeHtml(task.complexity)}</span>
          <span class="pill ${done ? "done" : ""}">${escapeHtml(task.status)}</span>
          <span class="pill ${late ? "late" : ""}">${formatDate(task.deadline)}</span>
          <span class="pill">${task.estimate_minutes || 30} דק׳</span>
          ${task.google_event_id ? `<span class="pill">ביומן</span>` : ""}
          ${task.parent_task_id ? `<span class="pill parent-pill">תת־משימה</span>` : ""}
        </div>
        ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ""}
        ${renderSubtasks(task.id)}
      </div>
      <div class="actions">
        <button class="icon-btn" onclick="window.openEdit('${task.id}')">עריכה</button>
        <button class="icon-btn" onclick="window.openSplit('${task.id}')">פצל</button>
        <button class="icon-btn calendar" onclick="window.quickCalendar('${task.id}')">יומן</button>
        <button class="icon-btn delete" onclick="window.askDelete('${task.id}')">מחיקה</button>
      </div>
    </article>`;
}

function filterTask(task, filter) {
  if (filter === "today") return isToday(task);
  if (filter === "week") return isThisWeek(task);
  if (filter === "late") return isLate(task);
  if (filter === "quick") return task.complexity === "קטנה" && !isDone(task);
  if (filter === "no-date") return !task.deadline && !isDone(task);
  if (filter === "done") return isDone(task);
  return true;
}

window.toggleDone = async (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  await updateTask(id, { status: isDone(task) ? "פתוחה" : "בוצע" });
};

window.quickCalendar = async (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const eventId = await upsertGoogleCalendarEvent(task, task.google_event_id);
  if (eventId) await updateTask(id, { google_event_id: eventId });
};

window.openEdit = (id) => openModal(tasks.find(t => t.id === id));
window.askDelete = async (id) => {
  if (!confirm("למחוק את המשימה?")) return;
  await deleteTask(id);
};

function openModal(task = null) {
  document.getElementById("taskId").value = task?.id || "";
  document.getElementById("title").value = task?.title || "";
  document.getElementById("category").value = task?.category || "אחר";
  document.getElementById("deadline").value = isoToInput(task?.deadline);
  document.getElementById("priority").value = task?.priority || "בינונית";
  document.getElementById("complexity").value = task?.complexity || "בינונית";
  document.getElementById("status").value = task?.status || "פתוחה";
  document.getElementById("estimate").value = String(task?.estimate_minutes || 30);
  document.getElementById("notes").value = task?.notes || "";
  document.getElementById("syncCalendar").checked = Boolean(task?.google_event_id);
  document.getElementById("deleteBtn").classList.toggle("hidden", !task);
  document.getElementById("taskModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("taskModal").classList.add("hidden");
  document.getElementById("taskForm").reset();
}

document.getElementById("closeModalBtn").addEventListener("click", closeModal);
document.getElementById("taskModal").addEventListener("click", e => {
  if (e.target.id === "taskModal") closeModal();
});
document.getElementById("deleteBtn").addEventListener("click", async () => {
  const id = document.getElementById("taskId").value;
  if (!id || !confirm("למחוק את המשימה?")) return;
  await deleteTask(id);
  closeModal();
});

document.getElementById("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("taskId").value;
  const sync = document.getElementById("syncCalendar").checked;
  const payload = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    deadline: inputDateToIso(document.getElementById("deadline").value),
    priority: document.getElementById("priority").value,
    complexity: document.getElementById("complexity").value,
    status: document.getElementById("status").value,
    estimate_minutes: Number(document.getElementById("estimate").value),
    notes: document.getElementById("notes").value.trim()
  };

  if (sync) {
    const existing = tasks.find(t => t.id === id);
    const eventId = await upsertGoogleCalendarEvent(payload, existing?.google_event_id);
    if (eventId) payload.google_event_id = eventId;
  }

  await updateTask(id, payload);
  closeModal();
});

document.getElementById("parseBrainBtn").addEventListener("click", () => {
  const text = document.getElementById("brainInput").value.trim();
  if (!text) return;
  parsedTasks = text.split("\n").map(x => x.trim()).filter(Boolean).map(parseLineToTask);
  document.getElementById("previewPanel").classList.remove("hidden");
  document.getElementById("previewList").innerHTML = parsedTasks.map(t => `
    <div class="preview-item">
      <strong>${escapeHtml(t.title)}</strong>
      <div class="meta">
        <span class="pill">${escapeHtml(t.category)}</span>
        <span class="pill">${priorityLabel(t.priority)}</span>
        <span class="pill">${escapeHtml(t.complexity)}</span>
        <span class="pill">${formatDate(t.deadline)}</span>
      </div>
    </div>`).join("");
});

document.getElementById("savePreviewBtn").addEventListener("click", async () => {
  for (const task of parsedTasks) await createTask(task, false);
  parsedTasks = [];
  document.getElementById("brainInput").value = "";
  document.getElementById("previewPanel").classList.add("hidden");
  switchView("tasks");
});

document.getElementById("clearBrainBtn").addEventListener("click", () => {
  document.getElementById("brainInput").value = "";
  document.getElementById("previewPanel").classList.add("hidden");
});

document.querySelectorAll(".time-option").forEach(button => {
  button.addEventListener("click", () => suggestTasksForTime(Number(button.dataset.minutes)));
});

function suggestTasksForTime(minutes) {
  const open = tasks.filter(t => !isDone(t));
  const fitting = open
    .filter(t => Number(t.estimate_minutes || 30) <= minutes)
    .sort((a, b) => scoreForFreeTime(b, minutes) - scoreForFreeTime(a, minutes))
    .slice(0, 4);

  const panel = document.getElementById("timeSuggestionPanel");
  const list = document.getElementById("timeSuggestionList");
  const title = document.getElementById("timeSuggestionTitle");

  title.textContent = `יש לך ${minutes} דקות? אלה המשימות שמתאימות`;

  if (!fitting.length) {
    list.innerHTML = `<div class="empty">לא מצאתי משימה שמתאימה לזמן הזה. אפשר להוסיף משימה קטנה חדשה.</div>`;
  } else {
    list.innerHTML = fitting.map((task, index) => `
      <article class="plan-step">
        <div class="plan-number">${index + 1}</div>
        <div>
          <h4>${escapeHtml(task.title)}</h4>
          <p>${freeTimeReason(task)}<br><strong>${task.estimate_minutes || 30} דק׳</strong> · ${formatDate(task.deadline)} · ${priorityLabel(task.priority)}</p>
          <button class="icon-btn" onclick="window.openEdit('${task.id}')">לפתוח</button>
        </div>
      </article>`).join("");
  }

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scoreForFreeTime(task, minutes) {
  let score = 0;
  const estimate = Number(task.estimate_minutes || 30);
  score += Math.max(0, 40 - Math.abs(minutes - estimate));
  if (isLate(task)) score += 120;
  if (isToday(task)) score += 90;
  if (isThisWeek(task)) score += 35;
  if (task.priority === "גבוהה") score += 45;
  if (task.complexity === "קטנה") score += 15;
  return score;
}

function freeTimeReason(task) {
  if (isLate(task)) return "היא באיחור ומתאימה לחלון הזמן שבחרת.";
  if (isToday(task)) return "היא להיום, והזמן המשוער מתאים למה שיש לך עכשיו.";
  if (task.priority === "גבוהה") return "היא דחופה ומתאימה לזמן שבחרת.";
  return "זו משימה שמתאימה לזמן הפנוי שהגדרת.";
}

function parseLineToTask(line) {
  const lower = line.toLowerCase();
  let category = "אחר";
  if (/מבחן|קורס|שיעור|סיכום|תואר|פסיכולוגיה|תקשורת|שיבוש|מטלה|עבודה/.test(lower)) category = "לימודים";
  else if (/לקוח|קאבר|רילס|עריכה|צילום|פוסט|סטורי|אינסטגרם|עיצוב|עסק/.test(lower)) category = "עסק";
  else if (/צבא|יחידה|מפקד|משרד/.test(lower)) category = "עבודה";
  else if (/לקנות|להתקשר|רופא|בית|אישי/.test(lower)) category = "אישי";

  const deadline = inferDeadline(lower);
  const priority = /דחוף|חשוב|היום|מחר|עד /.test(lower) ? "גבוהה" : "בינונית";
  const complexity = /קטן|זריז|לשלוח|להתקשר|לקנות/.test(lower) ? "קטנה" : /עבודה|מצגת|פרויקט|ללמוד|מבחן/.test(lower) ? "מורכבת" : "בינונית";
  const estimate_minutes = complexity === "קטנה" ? 15 : complexity === "מורכבת" ? 60 : 30;

  return { title: line, category, deadline, priority, complexity, estimate_minutes, status: "פתוחה", notes: "" };
}

function inferDeadline(text) {
  const now = new Date();
  let d = null;
  if (text.includes("היום")) d = new Date(now);
  else if (text.includes("מחר")) { d = new Date(now); d.setDate(now.getDate() + 1); }
  else if (text.includes("ראשון")) d = nextWeekday(0);
  else if (text.includes("שני")) d = nextWeekday(1);
  else if (text.includes("שלישי")) d = nextWeekday(2);
  else if (text.includes("רביעי")) d = nextWeekday(3);
  else if (text.includes("חמישי")) d = nextWeekday(4);
  else if (text.includes("שישי")) d = nextWeekday(5);
  else if (text.includes("שבת")) d = nextWeekday(6);
  if (!d) return null;
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function nextWeekday(day) {
  const now = new Date();
  const d = new Date(now);
  const diff = (day + 7 - now.getDay()) % 7 || 7;
  d.setDate(now.getDate() + diff);
  return d;
}

function renderPlanner() {
  const planner = document.getElementById("weekPlanner");
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  planner.innerHTML = days.map(day => {
    const list = tasks.filter(t => t.deadline && sameDay(new Date(t.deadline), day) && !isDone(t));
    return `<article class="day-card"><h4>${day.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })}</h4>${list.length ? list.map(t => `<div class="day-task">${escapeHtml(t.title)}</div>`).join("") : `<p>ריק</p>`}</article>`;
  }).join("");
}

function renderSummary() {
  const open = tasks.filter(t => !isDone(t));
  const late = open.filter(isLate);
  const today = open.filter(isToday);
  const week = open.filter(isThisWeek);
  const quick = open.filter(t => t.complexity === "קטנה");
  const noDate = open.filter(t => !t.deadline);
  const next = chooseNextTask();

  let text = "סיכום MindFlow ✨\n\n";
  text += `פתוחות: ${open.length}\nלהיום: ${today.length}\nהשבוע: ${week.length}\nבאיחור: ${late.length}\nבלי תאריך: ${noDate.length}\n\n`;
  text += section("🔥 קודם כל", late.length ? late : today);
  text += section("🗓️ השבוע", week);
  text += section("⚡ זריזים", quick.slice(0, 6));
  text += section("🌙 בלי תאריך", noDate);
  text += "הצעד הבא:\n";
  text += next ? `להתחיל מ: ${next.title}\n` : "אין כרגע משימה פתוחה.\n";
  document.getElementById("summaryText").textContent = text;
}

function section(title, list) {
  if (!list.length) return `${title}\nאין כרגע.\n\n`;
  return `${title}\n` + list.map(t => `• ${t.title} | ${t.category} | ${formatDate(t.deadline)} | ${priorityLabel(t.priority)}`).join("\n") + "\n\n";
}

document.getElementById("copySummaryBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("summaryText").textContent);
  alert("הסיכום הועתק");
});

function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  tasks.forEach(task => {
    if (!task.deadline || isDone(task) || task.reminder_sent) return;
    const diff = (new Date(task.deadline) - now) / 60000;
    if (diff <= 30 && diff > 0) {
      new Notification("MindFlow", { body: `${task.title} בעוד פחות מ-30 דקות` });
      supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
    }
  });
}
setInterval(checkReminders, 60000);

function isDone(task) { return task.status === "בוצע"; }
function isLate(task) { return task.deadline && !isDone(task) && new Date(task.deadline) < new Date(); }
function isToday(task) { return task.deadline && !isDone(task) && sameDay(new Date(task.deadline), new Date()); }
function isThisWeek(task) {
  if (!task.deadline || isDone(task)) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + 7);
  const d = new Date(task.deadline);
  return d >= now && d <= end;
}
function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
function sortByDeadline(a, b) {
  if (!a.deadline && b.deadline) return 1;
  if (a.deadline && !b.deadline) return -1;
  if (!a.deadline && !b.deadline) return 0;
  return new Date(a.deadline) - new Date(b.deadline);
}
function taskSort(a, b) {
  if (isDone(a) && !isDone(b)) return 1;
  if (!isDone(a) && isDone(b)) return -1;
  if (isLate(a) && !isLate(b)) return -1;
  if (!isLate(a) && isLate(b)) return 1;
  return sortByDeadline(a, b);
}
function formatDate(value) {
  if (!value) return "בלי תאריך";
  return new Date(value).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function inputDateToIso(value) { return value ? new Date(value).toISOString() : null; }
function isoToInput(value) {
  if (!value) return "";
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function priorityLabel(priority) {
  if (priority === "גבוהה") return "דחוף";
  if (priority === "נמוכה") return "רגוע";
  return "רגיל";
}
function translateAuthError(message) {
  if (message.includes("Invalid login credentials")) return "האימייל או הסיסמה לא נכונים.";
  if (message.includes("Password should be")) return "הסיסמה צריכה להיות לפחות 6 תווים.";
  return message;
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* === Split task / subtasks === */

function renderSubtasks(parentId) {
  const children = tasks
    .filter(t => t.parent_task_id === parentId)
    .sort(taskSort);

  if (!children.length) return "";

  return `
    <div class="subtask-list">
      ${children.map(child => `
        <div class="subtask-row ${isDone(child) ? "done" : ""}">
          <button class="check" onclick="window.toggleDone('${child.id}')"></button>
          <span class="subtask-title">${escapeHtml(child.title)}</span>
          <span class="subtask-meta">${formatDate(child.deadline)} · ${child.estimate_minutes || 30} דק׳</span>
        </div>
      `).join("")}
    </div>
  `;
}

window.openSplit = (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById("splitParentId").value = task.id;
  document.getElementById("splitParentTitle").value = task.title;
  document.getElementById("splitFinalDeadline").value = isoToInput(task.deadline);
  document.getElementById("splitTemplate").value = detectSplitTemplate(task);
  document.getElementById("splitCount").value = document.getElementById("splitTemplate").value === "videos" ? 11 : 5;
  toggleSplitCustom();
  renderSplitPreview();
  document.getElementById("splitTaskModal").classList.remove("hidden");
};

function detectSplitTemplate(task) {
  const text = `${task.title} ${task.category}`.toLowerCase();
  if (/וידאו|וידאוים|סרטון|סרטונים|ריל|רילס|עריכה|לקוח/.test(text)) return "videos";
  if (/מבחן|ללמוד|למידה|קורס|שיעור|סיכום/.test(text)) return "study";
  return "custom";
}

function closeSplitModal() {
  document.getElementById("splitTaskModal").classList.add("hidden");
}

document.getElementById("closeSplitModalBtn")?.addEventListener("click", closeSplitModal);
document.getElementById("splitTaskModal")?.addEventListener("click", (event) => {
  if (event.target.id === "splitTaskModal") closeSplitModal();
});

document.getElementById("splitTemplate")?.addEventListener("change", () => {
  toggleSplitCustom();
  renderSplitPreview();
});

document.getElementById("splitCount")?.addEventListener("input", renderSplitPreview);
document.getElementById("splitCustomLines")?.addEventListener("input", renderSplitPreview);

function toggleSplitCustom() {
  const isCustom = document.getElementById("splitTemplate").value === "custom";
  document.getElementById("splitCustomWrap").classList.toggle("hidden", !isCustom);
}

function getSplitTitles() {
  const template = document.getElementById("splitTemplate").value;
  const count = Math.max(1, Math.min(50, Number(document.getElementById("splitCount").value || 1)));
  const parentTitle = document.getElementById("splitParentTitle").value;

  if (template === "videos") {
    return Array.from({ length: count }, (_, i) => `סרטון ${i + 1} — ${parentTitle}`);
  }

  if (template === "study") {
    const base = [
      "מיפוי החומר למבחן",
      "ללמוד נושא 1",
      "ללמוד נושא 2",
      "לתרגל שאלות",
      "מבחן לדוגמה",
      "חזרה אחרונה"
    ];
    if (count <= base.length) return base.slice(0, count);
    return [...base, ...Array.from({ length: count - base.length }, (_, i) => `חזרה נוספת ${i + 1}`)];
  }

  const custom = document.getElementById("splitCustomLines").value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(x => x.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return custom.length ? custom : ["תת־משימה 1", "תת־משימה 2", "תת־משימה 3"];
}

function renderSplitPreview() {
  const preview = document.getElementById("splitPreview");
  if (!preview) return;

  const titles = getSplitTitles();
  preview.innerHTML = titles
    .slice(0, 12)
    .map(title => `<div class="split-preview-item">${escapeHtml(title)}</div>`)
    .join("");

  if (titles.length > 12) {
    preview.innerHTML += `<div class="split-preview-item">ועוד ${titles.length - 12}...</div>`;
  }
}

document.getElementById("splitTaskForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const parentId = document.getElementById("splitParentId").value;
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;

  const titles = getSplitTitles();
  const finalDeadline = inputDateToIso(document.getElementById("splitFinalDeadline").value);
  const spread = document.getElementById("splitSpreadDates").checked;

  const subtasks = titles.map((title, index) => ({
    title,
    category: parent.category || "אחר",
    priority: parent.priority || "בינונית",
    complexity: "קטנה",
    status: "פתוחה",
    estimate_minutes: parent.category === "לימודים" ? 45 : 30,
    notes: `חלק מתוך: ${parent.title}`,
    parent_task_id: parentId,
    deadline: spread ? distributedDeadline(finalDeadline, index, titles.length) : finalDeadline
  }));

  for (const subtask of subtasks) {
    await createTask(subtask, false);
  }

  closeSplitModal();
  switchView("tasks");
});

function distributedDeadline(finalDeadline, index, total) {
  if (!finalDeadline) return null;

  const end = new Date(finalDeadline);
  const now = new Date();
  const step = (end.getTime() - now.getTime()) / Math.max(total, 1);
  const d = new Date(now.getTime() + step * (index + 1));
  d.setHours(18, 0, 0, 0);

  if (d > end) return end.toISOString();
  return d.toISOString();
}

initHomeTaskForm();
