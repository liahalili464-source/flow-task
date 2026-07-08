const STORAGE_KEY = "lishu_flow_tasks_v2";
let tasks = loadTasks();
let currentFilter = "all";

const filtersMeta = {
  all: ["כל המשימות", "הכל במקום אחד, בלי רעש."],
  today: ["מה להיום", "רק מה שצריך לקבל ממך יחס היום."],
  week: ["השבוע הקרוב", "מה שמתקרב ולא כדאי שיפול בין הכיסאות."],
  late: ["באיחור", "לא להיבהל. רק להחזיר שליטה."],
  quick: ["זריזים", "משימות קטנות שסוגרות פינות."],
  "no-date": ["בלי תאריך", "אלה שצריך להחליט עליהן לפני שהן מתנפחות."]
};

const taskForm = document.getElementById("taskForm");
const tasksList = document.getElementById("tasksList");
const searchInput = document.getElementById("searchInput");
const summaryBox = document.getElementById("summaryBox");
const summaryText = document.getElementById("summaryText");

document.getElementById("todayDate").textContent = new Date().toLocaleDateString("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function formatDate(value) {
  if (!value) return "בלי תאריך";
  const date = new Date(value);
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isDone(task) {
  return task.status === "בוצע";
}

function isLate(task) {
  if (!task.deadline || isDone(task)) return false;
  return new Date(task.deadline) < new Date();
}

function isToday(task) {
  if (!task.deadline || isDone(task)) return false;
  const d = new Date(task.deadline);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isThisWeek(task) {
  if (!task.deadline || isDone(task)) return false;
  const now = new Date();
  const d = new Date(task.deadline);
  const end = new Date();
  end.setDate(now.getDate() + 7);
  return d >= now && d <= end;
}

function getFilteredTasks() {
  const query = searchInput.value.trim().toLowerCase();

  return tasks
    .filter(task => {
      if (currentFilter === "today") return isToday(task);
      if (currentFilter === "week") return isThisWeek(task);
      if (currentFilter === "late") return isLate(task);
      if (currentFilter === "no-date") return !task.deadline && !isDone(task);
      if (currentFilter === "quick") return task.complexity === "קטנה" && !isDone(task);
      return true;
    })
    .filter(task => {
      if (!query) return true;
      return [
        task.title,
        task.category,
        task.priority,
        task.complexity,
        task.status,
        task.notes
      ].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (isDone(a) && !isDone(b)) return 1;
      if (!isDone(a) && isDone(b)) return -1;
      if (isLate(a) && !isLate(b)) return -1;
      if (!isLate(a) && isLate(b)) return 1;
      if (!a.deadline && b.deadline) return 1;
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && !b.deadline) return 0;
      return new Date(a.deadline) - new Date(b.deadline);
    });
}

function renderTasks() {
  const filtered = getFilteredTasks();
  const [title, subtitle] = filtersMeta[currentFilter];
  document.getElementById("listTitle").textContent = title;
  document.getElementById("listSubtitle").textContent = subtitle;
  updateCounts();

  if (!filtered.length) {
    tasksList.innerHTML = `<div class="empty">אין כאן משימות כרגע. איזה כיף רגע לנשום ✨</div>`;
    return;
  }

  tasksList.innerHTML = filtered.map(task => {
    const late = isLate(task);
    const done = isDone(task);

    return `
      <article class="task-card ${late ? "late" : ""} ${done ? "done" : ""}">
        <button class="check" title="סימון בוצע" onclick="toggleDone('${task.id}')"></button>

        <div class="task-body">
          <h4>${escapeHtml(task.title)}</h4>
          <div class="meta">
            <span class="pill">${escapeHtml(task.category)}</span>
            <span class="pill ${task.priority === "גבוהה" ? "hot" : ""}">${priorityLabel(task.priority)}</span>
            <span class="pill">${escapeHtml(task.complexity)}</span>
            <span class="pill">${escapeHtml(task.status)}</span>
            <span class="pill ${late ? "late" : ""}">${late ? "עבר: " : ""}${formatDate(task.deadline)}</span>
          </div>
          ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ""}
        </div>

        <div class="actions">
          <button class="icon-btn" title="שינוי סטטוס" onclick="cycleStatus('${task.id}')">↻</button>
          <button class="icon-btn" title="שכפול" onclick="duplicateTask('${task.id}')">＋</button>
          <button class="icon-btn delete" title="מחיקה" onclick="deleteTask('${task.id}')">×</button>
        </div>
      </article>
    `;
  }).join("");
}

function priorityLabel(priority) {
  if (priority === "גבוהה") return "דחוף";
  if (priority === "נמוכה") return "רגוע";
  return "רגיל";
}

function updateCounts() {
  const today = tasks.filter(isToday).length;
  const week = tasks.filter(isThisWeek).length;
  const late = tasks.filter(isLate).length;
  const open = tasks.filter(t => !isDone(t)).length;

  document.getElementById("todayCount").textContent = today;
  document.getElementById("weekCount").textContent = week;
  document.getElementById("lateCount").textContent = late;
  document.getElementById("openCount").textContent = open;

  const line = document.getElementById("dailyLine");
  if (late > 0) line.textContent = `יש ${late} דברים באיחור, אבל נסדר את זה אחד-אחד.`;
  else if (today > 0) line.textContent = `יש לך ${today} משימות להיום. בוחרות אחת ומתחילות.`;
  else if (open > 0) line.textContent = "אין לחץ להיום, אבל יש דברים שאפשר לקדם.";
  else line.textContent = "הכל נקי. נדיר. תשמרי את הרגע הזה.";
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = document.getElementById("title").value.trim();
  if (!title) return;

  const task = {
    id: crypto.randomUUID(),
    title,
    category: document.getElementById("category").value,
    deadline: document.getElementById("deadline").value,
    priority: document.getElementById("priority").value,
    complexity: document.getElementById("complexity").value,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value.trim(),
    createdAt: new Date().toISOString(),
    reminderSent: false,
    lateReminderSent: false
  };

  tasks.push(task);
  saveTasks();
  taskForm.reset();
  document.getElementById("advancedFields").classList.add("hidden");
  renderTasks();
});

document.getElementById("toggleAdvancedBtn").addEventListener("click", () => {
  document.getElementById("advancedFields").classList.toggle("hidden");
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

searchInput.addEventListener("input", renderTasks);

function toggleDone(id) {
  tasks = tasks.map(task => {
    if (task.id !== id) return task;
    return { ...task, status: isDone(task) ? "פתוחה" : "בוצע" };
  });

  saveTasks();
  renderTasks();
}

function cycleStatus(id) {
  const statuses = ["פתוחה", "בתהליך", "מחכה למישהו", "בוצע"];
  tasks = tasks.map(task => {
    if (task.id !== id) return task;
    const currentIndex = statuses.indexOf(task.status);
    return { ...task, status: statuses[(currentIndex + 1) % statuses.length] };
  });

  saveTasks();
  renderTasks();
}

function duplicateTask(id) {
  const original = tasks.find(task => task.id === id);
  if (!original) return;

  tasks.push({
    ...original,
    id: crypto.randomUUID(),
    title: original.title + " - עותק",
    status: "פתוחה",
    reminderSent: false,
    lateReminderSent: false,
    createdAt: new Date().toISOString()
  });

  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  if (!confirm("למחוק את המשימה?")) return;
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
}

document.getElementById("summaryBtn").addEventListener("click", () => {
  summaryText.textContent = buildSummary();
  summaryBox.classList.remove("hidden");
  summaryBox.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("copySummaryBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(summaryText.textContent);
  alert("הסיכום הועתק");
});

function buildSummary() {
  const open = tasks.filter(t => !isDone(t));
  const late = open.filter(isLate);
  const today = open.filter(isToday);
  const week = open.filter(isThisWeek);
  const noDate = open.filter(t => !t.deadline);
  const quick = open.filter(t => t.complexity === "קטנה");

  let text = "סיכום משימות 🫶\n\n";
  text += `פתוחות: ${open.length}\n`;
  text += `להיום: ${today.length}\n`;
  text += `השבוע: ${week.length}\n`;
  text += `באיחור: ${late.length}\n`;
  text += `בלי תאריך: ${noDate.length}\n\n`;

  text += sectionText("🔥 קודם כל לסגור / לקדם", late.length ? late : today);
  text += sectionText("🗓️ השבוע הקרוב", week);
  text += sectionText("⚡ קטנות וזריזות", quick.slice(0, 6));
  text += sectionText("🌙 צריך לתת להן תאריך", noDate);

  text += "מה הייתי עושה עכשיו:\n";
  if (late[0]) text += `1. פותחת את "${late[0].title}" ועושה רק צעד ראשון.\n`;
  else if (today[0]) text += `1. מתחילה מ"${today[0].title}" לפני שזה נהיה רעש.\n`;
  else if (quick[0]) text += `1. סוגרת את "${quick[0].title}" בשביל מומנטום.\n`;
  else text += "1. בוחרת משימה אחת ועושה עליה 25 דקות.\n";

  return text;
}

function sectionText(title, list) {
  if (!list.length) return `${title}\nאין כרגע.\n\n`;
  return `${title}\n` + list.map(task =>
    `• ${task.title} | ${task.category} | ${formatDate(task.deadline)} | ${priorityLabel(task.priority)}`
  ).join("\n") + "\n\n";
}

document.getElementById("enableNotificationsBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("הדפדפן הזה לא תומך בהתראות.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    alert("התראות הופעלו. בגרסה הזו האתר צריך להיות פתוח בדפדפן.");
  } else {
    alert("לא אושרו התראות.");
  }
});

function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();

  tasks = tasks.map(task => {
    if (!task.deadline || isDone(task)) return task;

    const deadline = new Date(task.deadline);
    const diffMinutes = (deadline - now) / 1000 / 60;

    if (diffMinutes <= 60 && diffMinutes > 0 && !task.reminderSent) {
      new Notification("תזכורת קטנה", {
        body: `${task.title} בעוד פחות משעה`,
      });
      return { ...task, reminderSent: true };
    }

    if (diffMinutes <= 0 && !task.lateReminderSent) {
      new Notification("משימה באיחור", {
        body: `${task.title} עברה את הדדליין`,
      });
      return { ...task, lateReminderSent: true };
    }

    return task;
  });

  saveTasks();
  renderTasks();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

setInterval(checkReminders, 60 * 1000);
renderTasks();
