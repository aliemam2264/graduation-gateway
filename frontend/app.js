/* ═══════════════════════════════════════════════════
   Graduation Gateway · app.js
   Vanilla JS → Express → MongoDB → Groq AI
═══════════════════════════════════════════════════ */
const API = "http://localhost:5000/api";

// ──────────── STATE ────────────
const state = {
  token: localStorage.getItem("gradai_token") || null,
  user: JSON.parse(localStorage.getItem("gradai_user") || "null"),
  projects: [],
  currentSessionId: null,
  lastRoadmap: null,
};

// ──────────── API ────────────
async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  Object.assign(headers, opts.headers || {});
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401) {
    logout();
    return null;
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ──────────── AUTH ────────────
async function authLogin() {
  const email = $("loginEmail").value.trim();
  const pw = $("loginPassword").value;
  const btn = $("loginBtn");
  const err = $("loginError");
  err.textContent = "";
  if (!email || !pw) {
    err.textContent = "Email and password required.";
    return;
  }
  btn.textContent = "Signing in…";
  btn.disabled = true;
  try {
    const d = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pw }),
    });
    saveSession(d);
    hideAuthModal();
    initApp();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = "Sign In";
    btn.disabled = false;
  }
}

async function authRegister() {
  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const pw = $("regPassword").value;
  const major = $("regMajor").value;
  const supervisorId = $("regSupervisor")?.value || "";
  const btn = $("registerBtn");
  const err = $("registerError");
  err.textContent = "";
  if (!name || !email || !pw) {
    err.textContent = "All fields required.";
    return;
  }
  btn.textContent = "Creating…";
  btn.disabled = true;
  try {
    const d = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password: pw,
        major,
        supervisorId: supervisorId || undefined,
      }),
    });
    saveSession(d);
    hideAuthModal();
    initApp();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = "Create Account";
    btn.disabled = false;
  }
}

// Load supervisor list into the dropdown
async function loadSupervisorsDropdown() {
  const sel = $("regSupervisor");
  if (!sel) return;
  try {
    const res = await fetch(API + "/auth/supervisors");
    const d = await res.json();
    (d.supervisors || []).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s._id;
      opt.textContent =
        `${s.title || ""} ${s.name}${s.department ? " — " + s.department : ""}`.trim();
      sel.appendChild(opt);
    });
  } catch (_) {}
}

function saveSession({ token, user }) {
  state.token = token;
  state.user = user;
  localStorage.setItem("gradai_token", token);
  localStorage.setItem("gradai_user", JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  state.currentSessionId = null;
  localStorage.removeItem("gradai_token");
  localStorage.removeItem("gradai_user");
  showAuthModal();
}

function showAuthModal() {
  $("authOverlay").style.display = "flex";
  $("shell").style.display = "none";
}
function hideAuthModal() {
  $("authOverlay").style.display = "none";
  $("shell").style.display = "flex";
}
function switchAuthTab(tab) {
  $("loginForm").style.display = tab === "login" ? "block" : "none";
  $("registerForm").style.display = tab === "register" ? "block" : "none";
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.auth-tab[data-tab="${tab}"]`)
    .classList.add("active");
}

// ──────────── INIT ────────────
async function initApp() {
  if (!state.token || !state.user) {
    showAuthModal();
    return;
  }
  hideAuthModal();
  updateSidebar();
  loadBrowseIdeas();
  await loadDashboard();
}

function ini(name) {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function updateSidebar() {
  const u = state.user;
  if (!u) return;
  setText("sidebarAvatar", ini(u.name));
  setText("sidebarName", u.name);
  setText("sidebarPlan", u.plan === "pro" ? "Pro Plan" : "Free Plan");
  setText("logoVer", `v2.4 · ${u.plan === "pro" ? "Pro" : "Free"} Plan`);
}

// ──────────── DASHBOARD ────────────
async function loadDashboard() {
  try {
    const d = await apiFetch("/stats");
    const s = d.stats;
    setText("statGenerated", s.generated ?? 0);
    setText("statDone", s.approved ?? 0);
    setText("statScore", s.avgQualityScore ?? "—");
    setText("statActive", s.active ?? 0);
    renderDashRecentProjects(d.recentProjects || []);
    renderFieldBreakdown(d.fieldBreakdown || [], s.generated);
    renderActivityFeed(d.recentProjects || []);
    renderDashRoadmap(s);
    renderSettingsUsage(s);
  } catch (e) {
    console.warn("Dashboard:", e.message);
  }
}

function renderDashRecentProjects(projects) {
  const t = $("dashRecentTable");
  if (!t) return;
  const badge = (s) =>
    ({
      done: `<span class="badge badge-green">✓ Done</span>`,
      active: `<span class="badge badge-amber">⟳ Active</span>`,
      draft: `<span class="badge badge-grey">◌ Draft</span>`,
    })[s] || `<span class="badge badge-grey">◌ Draft</span>`;
  t.innerHTML =
    `<tr><th>Project</th><th>Field</th><th>Status</th></tr>` +
    (projects.length
      ? projects
          .slice(0, 5)
          .map(
            (p) => `<tr>
          <td><b>${esc(p.title)}</b></td>
          <td><span style="color:var(--text-2);font-size:12px">${esc(p.field)}</span></td>
          <td>${badge(p.status)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-3)">
          No projects yet — <a style="color:var(--green);cursor:pointer" onclick="nav(document.querySelector('[data-screen=generate]'))">generate your first →</a>
        </td></tr>`);
}

function renderFieldBreakdown(fields, total) {
  const c = $("fieldBreakdown");
  if (!c) return;
  if (!fields.length) {
    c.innerHTML = `<div style="color:var(--text-3);font-size:13px">Generate projects to see breakdown.</div>`;
    return;
  }
  const icons = {
    "Computer Science": "💻",
    "Data Science & AI": "🤖",
    "Software Engineering": "⚙️",
    "Electrical Engineering": "⚡",
    "Biomedical Engineering": "🏥",
    "Business & Technology": "💼",
  };
  c.innerHTML = fields
    .slice(0, 5)
    .map((f) => {
      const pct = total ? Math.round((f.count / total) * 100) : 0;
      return `<div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:13px;font-weight:500">${icons[f.field] || "📂"} ${esc(f.field)}</span>
        <span style="font-size:12px;font-family:'Geist Mono',monospace;color:var(--text-3)">${f.count}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill pf-dark" style="width:${pct}%"></div></div>
    </div>`;
    })
    .join("");
}

function renderActivityFeed(projects) {
  const f = $("activityFeed");
  if (!f) return;
  if (!projects.length) {
    f.innerHTML = `<div style="padding:20px;color:var(--text-3);font-size:13px;text-align:center">No activity yet.</div>`;
    return;
  }
  const ago = (d) => {
    const h = Math.floor((Date.now() - new Date(d)) / 3600000);
    return h < 1 ? "Just now" : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  };
  f.innerHTML = projects
    .map(
      (p) => `
    <div style="display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid var(--border)">
      <div class="avatar" style="flex-shrink:0">${ini(state.user?.name)}</div>
      <div style="flex:1;font-size:13px;color:var(--text-2)"><strong style="color:var(--text)">You</strong> generated <strong style="color:var(--text)">${esc(
        p.title,
      )}</strong></div>
      <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--text-3)">${ago(p.createdAt)}</div>
    </div>`,
    )
    .join("");
}

function renderDashRoadmap(stats) {
  const c = $("dashRoadmap");
  if (!c) return;
  const phases = [
    {
      title: "Topic Selection",
      desc: stats.generated > 0 ? "Completed ✓" : "Not started",
      done: stats.generated > 0,
    },
    {
      title: "Project Generation",
      desc: stats.generated > 0 ? `${stats.generated} project(s)` : "Pending",
      done: stats.generated > 0,
    },
    { title: "Implementation", desc: "Upcoming", done: false },
    { title: "Defense & Graduation", desc: "Final", done: false },
  ];
  c.innerHTML = phases
    .map(
      (p) => `
    <div class="tl-item">
      <div class="tl-dot ${p.done ? "done" : p.cur ? "now" : "todo"}">${p.done ? "✓" : p.cur ? "→" : ""}</div>
      <div><div class="tl-title ${p.cur ? "tl-green" : ""}">${p.title}</div>
      <div class="tl-desc" ${p.cur ? 'style="color:var(--green)"' : ""}>${p.desc}</div></div>
    </div>`,
    )
    .join("");
}

function renderSettingsUsage(stats) {
  const u = state.user;
  if (!u) return;
  const used = u.generationsUsed || 0,
    lim = u.generationsLimit || 10;
  setText("settingsGenUsed", `${used} / ${lim}`);
  setText("settingsPlan", u.plan === "pro" ? "Pro Plan" : "Free Plan");
  const bar = $("settingsGenBar");
  if (bar)
    bar.style.width = Math.min(Math.round((used / lim) * 100), 100) + "%";
}

// ──────────── GENERATE ────────────
async function triggerGenerate() {
  const loading = $("genLoading"),
    btn = document.querySelector("#screen-generate .btn-green");
  if (!btn) return;
  const field = $("genField")?.value || "Computer Science";
  const degreeLevel = $("genDegree")?.value || "Undergraduate (Bachelor)";
  const timeline = $("genTimeline")?.value || "1 Semester";
  const teamSize = $("genTeam")?.value || "Solo (1 person)";
  const interests = $("genInterests")?.value || "";
  const keywords = [...document.querySelectorAll("#genTags .tag.active")]
    .map((t) => t.textContent.trim())
    .join(", ");

  loading.classList.add("show");
  btn.disabled = true;
  btn.style.opacity = "0.5";
  btn.textContent = "Generating…";
  try {
    const d = await apiFetch("/generate", {
      method: "POST",
      body: JSON.stringify({
        field,
        degreeLevel,
        timeline,
        teamSize,
        interests,
        keywords,
      }),
    });
    renderGeneratedResult(d.generated, d.project);
    showToast("✓ Project generated!");
    loadProjects();
    loadDashboard();
    loadRecentGenerations();
    populateRoadmapSelect();
  } catch (e) {
    showToast("✗ " + e.message, "error");
  } finally {
    loading.classList.remove("show");
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.textContent = "✦ Generate Project";
  }
}

function renderGeneratedResult(g, project) {
  const c = $("genResult");
  if (!c) return;
  c.innerHTML = `
    <div class="section-card" style="margin-top:20px">
      <div class="section-head">
        <div class="section-title"><div class="tdot tdot-green"></div>✦ Generated Project</div>
        <span class="see-all" onclick="nav(document.querySelector('[data-screen=projects]'))">View in Projects →</span>
      </div>
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px">
          <div>
            <div style="font-size:18px;font-weight:700;letter-spacing:-0.4px;margin-bottom:6px">${esc(g.title)}</div>
            <div style="font-size:13px;color:var(--text-2);line-height:1.6">${esc(g.description)}</div>
          </div>
          ${
            g.qualityScore
              ? `<div style="text-align:center;flex-shrink:0;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
            <div style="font-size:24px;font-weight:700">${g.qualityScore}</div>
            <div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--text-3)">SCORE</div>
          </div>`
              : ""
          }
        </div>
        <div class="grid-2" style="gap:16px;margin-bottom:16px">
          <div>
            <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--text-3);margin-bottom:8px;text-transform:uppercase">Objectives</div>
            ${(g.objectives || [])
              .map(
                (o) =>
                  `<div style="font-size:13px;color:var(--text-2);margin-bottom:5px;display:flex;gap:6px"><span style="color:var(--green);flex-shrink:0">●</span>${esc(
                    o,
                  )}</div>`,
              )
              .join("")}
          </div>
          <div>
            <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--text-3);margin-bottom:8px;text-transform:uppercase">Tech Stack</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">${(
              g.technologies || []
            )
              .map((t) => `<span class="badge badge-blue">${esc(t)}</span>`)
              .join("")}</div>
            ${
              g.novelty
                ? `<div style="margin-top:12px;font-size:12px;color:var(--text-3)"><span style="color:var(--green);font-weight:600">✦ Novelty:</span> ${esc(
                    g.novelty,
                  )}</div>`
                : ""
            }
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-solid" onclick="nav(document.querySelector('[data-screen=advisor]'));setTimeout(()=>{document.getElementById('chatInput').value='Tell me more about the project: ${esc(
            g.title,
          ).replace(/'/g, "\\'")}';sendChat();},300)">◈ Ask Advisor</button>
          <button class="btn btn-outline" onclick="nav(document.querySelector('[data-screen=roadmap]'));setTimeout(()=>{document.getElementById('roadmapProjectSelect').value='${
            project._id
          }';onRoadmapProjectChange();generateRoadmap();},300)">↗ Build Roadmap</button>
        </div>
      </div>
    </div>`;
  c.scrollIntoView({ behavior: "smooth" });
}

async function loadRecentGenerations() {
  try {
    const d = await apiFetch("/projects?sort=-createdAt");
    const c = $("recentGenerations");
    if (!c) return;
    const ago = (dt) => {
      const h = Math.floor((Date.now() - new Date(dt)) / 3600000);
      return h < 1
        ? "Just now"
        : h < 24
          ? `${h}h ago`
          : h < 168
            ? `${Math.floor(h / 24)}d ago`
            : `${Math.floor(h / 168)}w ago`;
    };
    c.innerHTML = d.projects.length
      ? d.projects
          .slice(0, 4)
          .map(
            (p) => `
          <div style="padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''"
            onclick="nav(document.querySelector('[data-screen=projects]'))">
            <div style="font-size:13px;font-weight:500;margin-bottom:2px">${esc(p.title)}</div>
            <div style="font-size:11.5px;font-family:'Geist Mono',monospace;color:var(--text-3)">${esc(p.field)} · ${ago(p.createdAt)}</div>
          </div>`,
          )
          .join("")
      : `<div style="padding:20px;color:var(--text-3);font-size:13px;text-align:center">No generations yet.</div>`;
  } catch (_) {}
}

// ──────────── PROJECTS ────────────
async function loadProjects() {
  try {
    const d = await apiFetch("/projects");
    state.projects = d.projects;
    renderProjectsTable(d.projects);
  } catch (e) {
    console.warn("Projects:", e.message);
  }
}

function renderProjectsTable(projects) {
  const t = $("projectsTable");
  if (!t) return;
  const badge = (s) =>
    ({
      done: `<span class="badge badge-green">✓ Done</span>`,
      active: `<span class="badge badge-amber">⟳ Active</span>`,
      draft: `<span class="badge badge-grey">◌ Draft</span>`,
    })[s] || `<span class="badge badge-grey">◌ Draft</span>`;
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  t.innerHTML =
    `<tr><th>Project Title</th><th>Field</th><th>Level</th><th>Score</th><th>Status</th><th>Date</th><th></th></tr>` +
    (projects.length
      ? projects
          .map(
            (p) => `<tr>
          <td><b>${esc(p.title)}</b></td>
          <td>${esc(p.field)}</td>
          <td>${(p.degreeLevel || "—").split(" ")[0]}</td>
          <td><b>${p.qualityScore ?? "—"}</b></td>
          <td>${badge(p.status)}</td>
          <td style="font-family:'Geist Mono',monospace;font-size:12px;color:var(--text-3)">${fmt(p.createdAt)}</td>
          <td style="display:flex;gap:5px">
            <button class="btn btn-outline" style="padding:4px 8px;font-size:11px" title="Cycle status" onclick="cycleStatus('${p._id}','${
              p.status
            }')">✎</button>
            <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;color:#b91c1c" onclick="deleteProject('${p._id}')">✕</button>
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">
          No projects. <a style="color:var(--green);cursor:pointer" onclick="nav(document.querySelector('[data-screen=generate]'))">Generate one →</a>
        </td></tr>`);

  // Filters
  const total = projects.length,
    done = projects.filter((p) => p.status === "done").length,
    active = projects.filter((p) => p.status === "active").length,
    draft = projects.filter((p) => p.status === "draft").length;
  const fb = $("projectFilters");
  if (fb)
    fb.innerHTML = `
    <span class="tag active" onclick="filterProjects(this,'')">All (${total})</span>
    <span class="tag tag-green" onclick="filterProjects(this,'done')">Done (${done})</span>
    <span class="tag tag-amber" onclick="filterProjects(this,'active')">Active (${active})</span>
    <span class="tag" onclick="filterProjects(this,'draft')">Draft (${draft})</span>`;
}

function filterProjects(el, status) {
  document
    .querySelectorAll("#projectFilters .tag")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderProjectsTable(
    status ? state.projects.filter((p) => p.status === status) : state.projects,
  );
}
function searchProjects(val) {
  const q = val.toLowerCase();
  renderProjectsTable(
    state.projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.field.toLowerCase().includes(q),
    ),
  );
}
async function cycleStatus(id, cur) {
  const next =
    { draft: "active", active: "done", done: "draft" }[cur] || "active";
  try {
    await apiFetch(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    showToast(`✓ Status → "${next}"`);
    loadProjects();
    loadDashboard();
  } catch (e) {
    showToast("✗ " + e.message, "error");
  }
}
async function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  try {
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    showToast("✓ Deleted.");
    loadProjects();
    loadDashboard();
  } catch (e) {
    showToast("✗ " + e.message, "error");
  }
}

// ──────────── BROWSE IDEAS ────────────
const BROWSE_IDEAS = [
  {
    icon: "🤖",
    title: "Emotion Recognition via Webcam",
    desc: "Real-time facial expression detection using CNNs for accessibility apps.",
    tags: ["ai"],
    field: "AI/ML",
    level: "Bachelor",
  },
  {
    icon: "🏥",
    title: "Diabetic Retinopathy Screening",
    desc: "Deep learning model to detect early-stage eye disease from fundus images.",
    tags: ["ai", "health"],
    field: "Health AI",
    level: "Master",
  },
  {
    icon: "🚦",
    title: "Smart Traffic Signal Control",
    desc: "Reinforcement learning agent to optimize signal timing in real-time.",
    tags: ["ai", "iot"],
    field: "AI/IoT",
    level: "Bachelor",
  },
  {
    icon: "📚",
    title: "Adaptive Learning Platform",
    desc: "AI-personalized curriculum that adjusts difficulty based on student performance.",
    tags: ["ai", "web"],
    field: "EdTech",
    level: "Master",
  },
  {
    icon: "🔐",
    title: "Zero-Trust Network Architecture",
    desc: "Design and implement a zero-trust security model for enterprise networks.",
    tags: ["security"],
    field: "Security",
    level: "Master",
  },
  {
    icon: "🌱",
    title: "Precision Agriculture with Drones",
    desc: "Computer vision drones for automated crop health monitoring.",
    tags: ["ai", "iot"],
    field: "AgriTech",
    level: "Bachelor",
  },
  {
    icon: "💬",
    title: "Legal Document Summarizer",
    desc: "NLP pipeline to extract key clauses from legal contracts automatically.",
    tags: ["nlp", "ai"],
    field: "NLP",
    level: "Master",
  },
  {
    icon: "🏗️",
    title: "Structural Defect Detection",
    desc: "Image segmentation model to identify cracks in building materials.",
    tags: ["ai"],
    field: "Civil AI",
    level: "PhD",
  },
  {
    icon: "🎵",
    title: "AI Music Composition Tool",
    desc: "Generative model trained on classical music to compose original melodies.",
    tags: ["ai"],
    field: "GenAI",
    level: "Bachelor",
  },
  {
    icon: "🌐",
    title: "Multi-tenant SaaS Dashboard",
    desc: "Full-stack web platform with role-based access control and analytics.",
    tags: ["web"],
    field: "Web Dev",
    level: "Bachelor",
  },
  {
    icon: "📱",
    title: "AR Campus Navigation App",
    desc: "Augmented reality mobile app for university campus navigation.",
    tags: ["mobile"],
    field: "Mobile/AR",
    level: "Bachelor",
  },
  {
    icon: "🔒",
    title: "Blockchain Identity Verification",
    desc: "Decentralized identity system using smart contracts for secure verification.",
    tags: ["security", "web"],
    field: "Security",
    level: "Master",
  },
  {
    icon: "📡",
    title: "IoT Smart Greenhouse Monitor",
    desc: "Sensor network for automated climate control in agricultural greenhouses.",
    tags: ["iot"],
    field: "IoT",
    level: "Bachelor",
  },
  {
    icon: "🧬",
    title: "Protein Structure Prediction",
    desc: "ML model to predict secondary protein structure from amino acid sequences.",
    tags: ["ai", "health"],
    field: "Bioinformatics",
    level: "PhD",
  },
  {
    icon: "🚗",
    title: "Autonomous Parking Navigation",
    desc: "Computer vision + path planning for fully autonomous parking systems.",
    tags: ["ai"],
    field: "Robotics",
    level: "Master",
  },
  {
    icon: "💊",
    title: "Drug Interaction Checker",
    desc: "NLP-powered system to detect dangerous drug interactions from patient records.",
    tags: ["nlp", "health"],
    field: "Health AI",
    level: "Master",
  },
  {
    icon: "🌍",
    title: "Carbon Footprint Tracker App",
    desc: "Mobile app that tracks and gamifies personal carbon footprint reduction.",
    tags: ["mobile", "web"],
    field: "GreenTech",
    level: "Bachelor",
  },
  {
    icon: "🤝",
    title: "Sign Language Translator",
    desc: "Real-time sign language recognition using computer vision and deep learning.",
    tags: ["ai"],
    field: "AI/ML",
    level: "Master",
  },
];

let browseFilter = "all";
function loadBrowseIdeas() {
  renderBrowseIdeas(browseFilter);
}
function filterBrowse(el, filter) {
  browseFilter = filter;
  document
    .querySelectorAll("#browseFilters .tag")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderBrowseIdeas(filter);
}
function renderBrowseIdeas(filter) {
  const grid = $("browseGrid");
  if (!grid) return;
  const filtered =
    filter === "all"
      ? BROWSE_IDEAS
      : BROWSE_IDEAS.filter((i) => i.tags.includes(filter));
  const lvlBadge = {
    Bachelor: "badge-grey",
    Master: "badge-blue",
    PhD: "badge-amber",
  };
  grid.innerHTML = filtered
    .map(
      (idea) => `
    <div class="info-card" style="cursor:pointer" onclick="generateFromIdea('${esc(idea.title).replace(/'/g, "\\'")}','${esc(idea.field)}')"
      onmouseover="this.style.boxShadow='0 4px 20px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow=''">
      <div class="info-icon">${idea.icon}</div>
      <div class="info-title">${esc(idea.title)}</div>
      <div class="info-desc">${esc(idea.desc)}</div>
      <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-blue">${esc(idea.field)}</span>
        <span class="badge ${lvlBadge[idea.level] || "badge-grey"}">${idea.level}</span>
      </div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--green);font-weight:500">Click to generate full project →</div>
    </div>`,
    )
    .join("");
}

function generateFromIdea(title, field) {
  nav(document.querySelector("[data-screen=generate]"));
  const fi = $("genField");
  if (fi) {
    [...fi.options].forEach((o) => {
      if (o.text.includes(field.split("/")[0].trim()) || o.value === field)
        o.selected = true;
    });
  }
  const ti = $("genInterests");
  if (ti) ti.value = `I want to work on: ${title}`;
  setTimeout(() => {
    document
      .querySelector("#screen-generate .btn-green")
      ?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, 200);
  showToast(`✓ Idea loaded — click Generate to create the full project.`);
}

// ──────────── MY REVIEWS ────────────
async function loadReviews() {
  const container = document.getElementById("reviews-container");
  if (!container) return;

  container.innerHTML = "<p>Loading reviews...</p>";

  try {
    const res = await fetch("http://localhost:5000/api/projects", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("gradai_token"),
      },
    });

    const data = await res.json();

    const reviewedProjects = (data.projects || []).filter(
      (p) => p.review && p.review.grade,
    );

    if (reviewedProjects.length === 0) {
      container.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    container.innerHTML = reviewedProjects
      .map(
        (p) => `
  <div class="section-card" style="margin-top:20px;">
    
    <div class="section-head">
      <div class="section-title">
        <div class="tdot tdot-green"></div>
        ${p.title}
      </div>

      <span class="badge badge-green">${p.review.grade}</span>
    </div>

    <div style="padding:20px">
      
      <div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:12px">
        <strong>Feedback:</strong><br>
        ${p.review.feedback || "No feedback provided."}
      </div>

      <div style="font-size:11.5px;font-family:'Geist Mono',monospace;color:var(--text-3)">
        Reviewed at: ${new Date(p.review.reviewedAt).toLocaleString()}
      </div>

    </div>
  </div>
`,
      )
      .join("");
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Failed to load reviews.</p>";
  }
}

function nav(el) {
  // remove active
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));

  el.classList.add("active");

  const screen = el.getAttribute("data-screen");

  // hide all
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.add("hidden"));

  // show selected
  const activeScreen = document.getElementById(screen + "-screen");
  if (activeScreen) activeScreen.classList.remove("hidden");

  if (screen === "reviews") {
    loadReviews();
  }
}

// ──────────── AI ADVISOR ────────────
async function sendChat() {
  const input = $("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  const container = $("chatMessages");
  const initials = ini(state.user?.name);

  appendMsg(
    container,
    "user",
    `<div class="avatar" style="flex-shrink:0">${initials}</div>
    <div><div class="msg-bubble">${esc(msg)}</div><div class="msg-time">${nowTime()}</div></div>`,
  );
  input.value = "";
  container.scrollTop = container.scrollHeight;

  const typingId = "typing_" + Date.now();
  appendMsg(
    container,
    "ai",
    `<div class="avatar av-green" style="flex-shrink:0">AI</div>
    <div><div class="msg-bubble" id="${typingId}"><div class="loader-dots"><span></span><span></span><span></span></div></div></div>`,
  );
  container.scrollTop = container.scrollHeight;

  try {
    const d = await apiFetch("/advisor/chat", {
      method: "POST",
      body: JSON.stringify({ message: msg, sessionId: state.currentSessionId }),
    });
    state.currentSessionId = d.sessionId;
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.closest(".msg").remove();
    appendMsg(
      container,
      "ai",
      `<div class="avatar av-green" style="flex-shrink:0">AI</div>
      <div><div class="msg-bubble">${fmtAI(d.reply)}</div><div class="msg-time">${nowTime()}</div></div>`,
    );
  } catch (e) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.closest(".msg").remove();
    appendMsg(
      container,
      "ai",
      `<div class="avatar av-green" style="flex-shrink:0">AI</div>
      <div><div class="msg-bubble" style="color:var(--amber)">⚠ ${esc(e.message)}</div></div>`,
    );
  }
  container.scrollTop = container.scrollHeight;
}

function appendMsg(container, role, html) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = html;
  container.appendChild(el);
}

function clearChat() {
  state.currentSessionId = null;
  $("chatMessages").innerHTML =
    `<div class="msg ai"><div class="avatar av-green" style="flex-shrink:0">AI</div>
    <div><div class="msg-bubble">Chat cleared. How can I help you with your graduation project?</div>
    <div class="msg-time">${nowTime()}</div></div></div>`;
}

// ──────────── ROADMAP ────────────
async function populateRoadmapSelect() {
  const sel = $("roadmapProjectSelect");
  if (!sel) return;
  try {
    const d = await apiFetch("/projects?sort=-createdAt");
    const current = sel.value;
    sel.innerHTML =
      `<option value="">— Custom Project —</option>` +
      d.projects
        .map(
          (p) =>
            `<option value="${p._id}" data-field="${esc(p.field)}" data-desc="${esc(p.description || "")}" data-tech="${esc(
              (p.technologies || []).join(","),
            )}">${esc(p.title)}</option>`,
        )
        .join("");
    if (current) sel.value = current;
  } catch (_) {}
}

function onRoadmapProjectChange() {
  const sel = $("roadmapProjectSelect");
  const titleInput = $("roadmapTitle");
  if (!sel || !titleInput) return;
  if (sel.value) {
    const opt = sel.options[sel.selectedIndex];
    titleInput.value = opt.text;
    titleInput.disabled = true;
  } else {
    titleInput.value = "";
    titleInput.disabled = false;
  }
}

async function generateRoadmap() {
  const sel = $("roadmapProjectSelect");
  const projectId = sel?.value || null;
  const customTitle = $("roadmapTitle")?.value?.trim() || "";
  const timeline = $("roadmapTimeline")?.value || "6 months";
  const teamSize = $("roadmapTeam")?.value || "1";

  if (!projectId && !customTitle) {
    showToast("Select a project or enter a title first.", "error");
    return;
  }

  const project = projectId
    ? state.projects.find((p) => p._id === projectId)
    : null;
  const title = project?.title || customTitle;
  const field = project?.field || "Computer Science";
  const description = project?.description || "";
  const technologies = project?.technologies || [];

  // Show loading
  $("roadmapLoading").style.display = "block";
  $("roadmapContent").style.display = "none";
  $("roadmapEmpty").style.display = "none";
  const btn = $("roadmapGenerateBtn");
  if (btn) {
    btn.textContent = "Generating…";
    btn.disabled = true;
  }

  try {
    const d = await apiFetch("/roadmap/generate", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        title,
        field,
        description,
        technologies,
        timeline,
        teamSize,
      }),
    });
    state.lastRoadmap = d.roadmap;
    renderRoadmapOutput(d.roadmap, title);
    showToast("✓ Roadmap generated!");
  } catch (e) {
    showToast("✗ " + e.message, "error");
    $("roadmapEmpty").style.display = "block";
  } finally {
    $("roadmapLoading").style.display = "none";
    if (btn) {
      btn.textContent = "↗ Generate Roadmap";
      btn.disabled = false;
    }
  }
}

function renderRoadmapOutput(roadmap, title) {
  // Stats
  setText("rmTotalWeeks", roadmap.totalWeeks || "—");
  setText("rmPhases", (roadmap.phases || []).length);
  setText("rmMilestones", (roadmap.keyMilestones || []).length);
  setText("rmRisks", (roadmap.riskFactors || []).length);

  // Project title label
  const ptEl = $("roadmapProjectTitle");
  if (ptEl) ptEl.textContent = title || "";

  // Phases
  const pc = $("roadmapPhases");
  if (pc)
    pc.innerHTML = (roadmap.phases || [])
      .map((p) => {
        const isDone = p.status === "done",
          isActive = p.status === "active";
        return `<div class="tl-item">
      <div class="tl-dot ${isDone ? "done" : isActive ? "now" : "todo"}">${isDone ? "✓" : isActive ? "→" : p.phase}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div class="tl-title ${isActive ? "tl-green" : ""}">${esc(p.name)}</div>
            <div class="tl-desc" ${isActive ? 'style="color:var(--green)"' : ""}>
              ${
                (p.tasks || [])
                  .slice(0, 3)
                  .map((t) => esc(t.task))
                  .join(" · ") || "No tasks"
              }
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <span class="badge ${isDone ? "badge-green" : isActive ? "badge-amber" : "badge-grey"}">${esc(p.weeks)}</span>
            ${p.milestone ? `<span class="badge badge-amber">🎯</span>` : ""}
          </div>
        </div>
        ${p.deliverable ? `<div style="margin-top:6px;font-size:12px;color:var(--green)">📦 ${esc(p.deliverable)}</div>` : ""}
      </div>
    </div>`;
      })
      .join("");

  // Milestones table
  const mt = $("roadmapMilestonesTable");
  if (mt)
    mt.innerHTML =
      `<tr><th>Week</th><th>Milestone</th><th>Description</th></tr>` +
      (roadmap.keyMilestones || [])
        .map(
          (m) => `<tr>
      <td><span class="badge badge-blue">W${m.week}</span></td>
      <td><b>${esc(m.milestone)}</b></td>
      <td style="color:var(--text-2);font-size:12px">${esc(m.description)}</td>
    </tr>`,
        )
        .join("");

  // Risks
  const rc = $("roadmapRisks");
  if (rc)
    rc.innerHTML = (roadmap.riskFactors || [])
      .map(
        (r) => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-size:13px;font-weight:500">⚠ ${esc(r.risk)}</div>
        <span class="badge ${r.probability === "high" ? "badge-amber" : "badge-grey"}">${esc(r.probability || "medium")}</span>
      </div>
      <div style="font-size:12px;color:var(--text-2)">${esc(r.mitigation)}</div>
    </div>`,
      )
      .join("");

  $("roadmapContent").style.display = "block";
  $("roadmapEmpty").style.display = "none";
}

function copyRoadmap() {
  if (!state.lastRoadmap) {
    showToast("Generate a roadmap first.", "error");
    return;
  }
  const r = state.lastRoadmap;
  let text = `PROJECT ROADMAP\n${"=".repeat(50)}\n\n`;
  (r.phases || []).forEach((p) => {
    text += `PHASE ${p.phase}: ${p.name} (${p.weeks})\n`;
    (p.tasks || []).forEach((t) => {
      text += `  • ${t.task} [${t.duration}]\n`;
    });
    if (p.deliverable) text += `  📦 Deliverable: ${p.deliverable}\n`;
    text += "\n";
  });
  if (r.riskFactors?.length) {
    text += "RISKS\n" + "─".repeat(30) + "\n";
    r.riskFactors.forEach((r) => {
      text += `• ${r.risk} → ${r.mitigation}\n`;
    });
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("✓ Roadmap copied to clipboard."));
}

// ──────────── PROFILE ────────────
function renderProfile() {
  const u = state.user;
  if (!u) return;
  const [first, ...rest] = u.name.split(" ");
  setText("profileAvatar", ini(u.name));
  setText("profileName", u.name);
  setText("profileMeta", `${u.email} · ${u.major || "—"}`);
  setText("profilePlanBadge", u.plan === "pro" ? "Pro Plan" : "Free Plan");
  setText("profileMajorBadge", u.major || "—");
  setVal("profileFirstName", first);
  setVal("profileLastName", rest.join(" "));
  setVal("profileEmail", u.email);
  setVal("profileUniversity", u.university || "");
  const ms = $("profileMajorSelect");
  if (ms)
    [...ms.options].forEach((o) => {
      o.selected = o.value === u.major;
    });
  const used = u.generationsUsed || 0,
    lim = u.generationsLimit || 10;
  setText("profileGenUsed", `${used} / ${lim}`);
  const pb = $("profileGenBar");
  if (pb) pb.style.width = Math.min(Math.round((used / lim) * 100), 100) + "%";
  setText("profileProjectCount", state.projects.length || "0");
  const ppb = $("profileProjectBar");
  if (ppb)
    ppb.style.width = Math.min((state.projects.length / 20) * 100, 100) + "%";
}

async function saveProfile() {
  const first = $("profileFirstName")?.value?.trim() || "";
  const last = $("profileLastName")?.value?.trim() || "";
  const name = (first + " " + last).trim();
  const university = $("profileUniversity")?.value?.trim() || "";
  const major = $("profileMajorSelect")?.value || "";
  const btn = $("saveProfileBtn");
  if (btn) {
    btn.textContent = "Saving…";
    btn.disabled = true;
  }
  try {
    const d = await apiFetch("/auth/update-profile", {
      method: "PATCH",
      body: JSON.stringify({ name, university, major }),
    });
    state.user = { ...state.user, ...d.user };
    localStorage.setItem("gradai_user", JSON.stringify(state.user));
    updateSidebar();
    renderProfile();
    showToast("✓ Profile saved.");
  } catch (e) {
    showToast("✗ " + e.message, "error");
  } finally {
    if (btn) {
      btn.textContent = "Save Profile";
      btn.disabled = false;
    }
  }
}

document.getElementById("profileSupervisor").value =
  state.user?.supervisor || "";
// ──────────── NAVIGATION ────────────
function nav(el) {
  const id = el?.dataset?.screen;
  if (!id) return;

  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");

  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });

  const screen =
    document.getElementById("screen-" + id) ||
    document.getElementById(id + "-screen");

  if (screen) {
    screen.classList.add("active");
    screen.classList.remove("hidden");
  }

  if (id === "dashboard") loadDashboard();
  if (id === "projects") loadProjects();
  if (id === "generate") loadRecentGenerations();
  if (id === "roadmap") populateRoadmapSelect();
  if (id === "profile") {
    loadProjects().then(() => renderProfile());
  }

  if (id === "reviews") {
    loadReviews();
  }
}

// ──────────── UTILS ────────────
function $(id) {
  return document.getElementById(id);
}
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}
function setVal(id, val) {
  const el = $(id);
  if (el) el.value = val;
}
function nowTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtAI(text) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}
function showToast(msg, type = "success") {
  const t = document.createElement("div"),
    isErr = type === "error";
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${isErr ? "#fff0f0" : "#fff"};border:1px solid ${
    isErr ? "#fca5a5" : "#e8e5e0"
  };color:${
    isErr ? "#b91c1c" : "#1a1814"
  };font-family:'Geist',sans-serif;font-size:13px;font-weight:500;padding:12px 18px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.08);animation:slideUp .2s ease;max-width:340px;z-index:99999`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ──────────── STYLES ────────────
const _style = document.createElement("style");
_style.textContent = `
@keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
.loader-dots{display:inline-flex;gap:4px;align-items:center}
.loader-dots span{width:5px;height:5px;border-radius:50%;background:var(--text-3);animation:dotPulse 1.2s infinite}
.loader-dots span:nth-child(2){animation-delay:.2s}.loader-dots span:nth-child(3){animation-delay:.4s}
@keyframes dotPulse{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
.auth-tab{cursor:pointer;padding:8px 16px;font-size:13.5px;font-weight:500;border-bottom:2px solid transparent;color:var(--text-3);transition:.15s}
.auth-tab.active{color:var(--text);border-bottom-color:var(--text)}
`;
document.head.appendChild(_style);

// ──────────── BOOT ────────────
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

// ══════════════════════════════════════════════════════
//  SUPERVISOR ROLE — All logic below
// ══════════════════════════════════════════════════════

// ── Role selection ──────────────────────────────────
let currentRole = "student"; // 'student' | 'supervisor'

function selectRole(role) {
  currentRole = role;
  const studentCard = document.getElementById("roleStudent");
  const supervisorCard = document.getElementById("roleSupervisor");
  const registerTabBtn = document.getElementById("registerTabBtn");

  if (role === "student") {
    studentCard.style.border = "2px solid var(--green)";
    studentCard.style.background =
      "color-mix(in srgb,var(--green) 8%,transparent)";
    supervisorCard.style.border = "2px solid var(--border)";
    supervisorCard.style.background = "";
    registerTabBtn.style.display = "";
  } else {
    supervisorCard.style.border = "2px solid #3d6b4f";
    supervisorCard.style.background =
      "color-mix(in srgb,#3d6b4f 8%,transparent)";
    studentCard.style.border = "2px solid var(--border)";
    studentCard.style.background = "";
    registerTabBtn.style.display = "";
  }
  // Re-render current tab for the chosen role
  const activeTab =
    document.querySelector(".auth-tab.active")?.dataset?.tab || "login";
  switchAuthTab(activeTab);
}

// Patch switchAuthTab to handle supervisor forms
const _origSwitchAuthTab = switchAuthTab;
// Override
switchAuthTab = function (tab) {
  const ids = ["loginForm", "registerForm", "supLoginForm", "supRegisterForm"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  const tabEl = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
  if (tabEl) tabEl.classList.add("active");

  if (currentRole === "student") {
    if (tab === "login")
      document.getElementById("loginForm").style.display = "block";
    else {
      document.getElementById("registerForm").style.display = "block";
      // Load supervisors dropdown when register form opens
      const sel = document.getElementById("regSupervisor");
      if (sel && sel.options.length <= 1) loadSupervisorsDropdown();
    }
  } else {
    if (tab === "login")
      document.getElementById("supLoginForm").style.display = "block";
    else document.getElementById("supRegisterForm").style.display = "block";
  }
};

// ── Supervisor API helper ────────────────────────────
async function supFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  Object.assign(headers, opts.headers || {});
  const res = await fetch(API + "/supervisor" + path, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401) {
    logout();
    return null;
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Supervisor Auth ──────────────────────────────────
async function authSupervisorLogin() {
  const email = document.getElementById("supLoginEmail").value.trim();
  const pw = document.getElementById("supLoginPassword").value;
  const btn = document.getElementById("supLoginBtn");
  const err = document.getElementById("supLoginError");
  err.textContent = "";
  if (!email || !pw) {
    err.textContent = "Email and password required.";
    return;
  }
  btn.textContent = "Signing in…";
  btn.disabled = true;
  try {
    const d = await fetch(API + "/supervisor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pw }),
    }).then((r) => r.json());
    if (d.error) throw new Error(d.error);
    saveSession(d);
    hideAuthModal();
    initSupervisorApp();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = "Sign In as Supervisor";
    btn.disabled = false;
  }
}

async function authSupervisorRegister() {
  const name = document.getElementById("supRegName").value.trim();
  const email = document.getElementById("supRegEmail").value.trim();
  const pw = document.getElementById("supRegPassword").value;
  const title = document.getElementById("supRegTitle").value;
  const dept = document.getElementById("supRegDept").value.trim();
  const univ = document.getElementById("supRegUniv").value.trim();
  const btn = document.getElementById("supRegisterBtn");
  const err = document.getElementById("supRegisterError");
  err.textContent = "";
  if (!name || !email || !pw) {
    err.textContent = "Name, email, and password are required.";
    return;
  }
  btn.textContent = "Creating…";
  btn.disabled = true;
  try {
    const d = await fetch(API + "/supervisor/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password: pw,
        title,
        department: dept,
        university: univ,
      }),
    }).then((r) => r.json());
    if (d.error) throw new Error(d.error);
    saveSession(d);
    hideAuthModal();
    initSupervisorApp();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = "Create Supervisor Account";
    btn.disabled = false;
  }
}

// ── Supervisor App Init ──────────────────────────────
function isSupervisor() {
  return state.user?.role === "supervisor";
}

async function initApp() {
  if (!state.token || !state.user) {
    showAuthModal();
    return;
  }
  if (isSupervisor()) {
    hideAuthModal();
    initSupervisorApp();
    return;
  }
  // student path
  hideAuthModal();
  document.getElementById("shell").style.display = "flex";
  document.getElementById("supShell").style.display = "none";
  updateSidebar();
  loadBrowseIdeas();
  await loadDashboard();
}

async function initSupervisorApp() {
  document.getElementById("shell").style.display = "none";
  const supShellEl = document.getElementById("supShell");
  supShellEl.style.display = "flex";
  supShellEl.style.height = "100vh";
  supShellEl.style.flexDirection = "row";
  supShellEl.style.overflow = "hidden";
  const u = state.user;
  document.getElementById("supSidebarAvatar").textContent = ini(u.name);
  document.getElementById("supSidebarName").textContent = u.name;
  document.getElementById("supWelcomeName").textContent = u.title
    ? `${u.title} ${u.name.split(" ")[0]}`
    : u.name.split(" ")[0];
  document.getElementById("supProfileName").textContent = u.name;
  document.getElementById("supProfileEmail").textContent = u.email;
  document.getElementById("supProfileAvatar").textContent = ini(u.name);
  // pre-fill profile form
  setValue("supProfName", u.name);
  setValue("supProfTitle", u.title || "Dr.");
  setValue("supProfDept", u.department || "");
  setValue("supProfUniv", u.university || "");
  await supLoadDashboard();
}

// ── Navigation ───────────────────────────────────────
function supNav(screenId, el) {
  document
    .querySelectorAll(".sup-screen")
    .forEach((s) => (s.style.display = "none"));
  const screen = document.getElementById(screenId);
  if (screen) screen.style.display = "block";
  document
    .querySelectorAll(".sup-nav-item")
    .forEach((n) => n.classList.remove("sup-nav-active"));
  if (el) el.classList.add("sup-nav-active");
  // lazy load
  if (screenId === "supScreenStudents") supLoadStudents();
  if (screenId === "supScreenReviews") supLoadAllProjects();
}

// ── Dashboard ────────────────────────────────────────
async function supLoadDashboard() {
  try {
    const d = await supFetch("/stats");
    const s = d.stats;
    setText("supStatStudents", s.students ?? 0);
    setText("supStatProjects", s.totalProjects ?? 0);
    setText("supStatReviewed", s.reviewedCount ?? 0);
    setText("supStatPending", s.pendingReviews ?? 0);
    renderSupRecentTable(d.recentProjects || []);
  } catch (e) {
    console.warn("Sup dashboard:", e.message);
  }
}

function renderSupRecentTable(projects) {
  const t = document.getElementById("supRecentTable");
  if (!t) return;
  const statusBadge = (s) =>
    ({
      done: `<span class="badge badge-green">✓ Done</span>`,
      active: `<span class="badge badge-amber">⟳ Active</span>`,
      draft: `<span class="badge badge-grey">◌ Draft</span>`,
    })[s] || `<span class="badge badge-grey">◌ Draft</span>`;

  const gradeClass = (g) =>
    ({
      Excellent: "grade-excellent",
      "Very Good": "grade-verygood",
      Good: "grade-good",
      "Needs Revision": "grade-revision",
      Rejected: "grade-rejected",
    })[g] || "grade-pending";

  const rows = projects.length
    ? projects
        .map(
          (p) => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px;font-size:13px;font-weight:500">${esc(p.title)}</td>
        <td style="padding:10px 16px;font-size:13px;color:var(--text-2)">${esc(p.user?.name || "—")}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text-3)">${esc(p.field)}</td>
        <td style="padding:10px 16px">${statusBadge(p.status)}</td>
        <td style="padding:10px 16px">
          <span class="grade-badge ${gradeClass(p.reviewGrade)}">${p.reviewGrade || "Pending"}</span>
        </td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" style="padding:30px;text-align:center;color:var(--text-3);font-size:13px">No student projects yet.</td></tr>`;

  // Rebuild with new header that includes Review column
  t.innerHTML =
    `
    <tr style="border-bottom:1px solid var(--border)">
      <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-3);font-weight:500">Project</th>
      <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-3);font-weight:500">Student</th>
      <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-3);font-weight:500">Field</th>
      <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-3);font-weight:500">Status</th>
      <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-3);font-weight:500">Review</th>
    </tr>` + rows;
}

// ── Students Screen ──────────────────────────────────
async function supLoadStudents() {
  try {
    const d = await supFetch("/students");
    renderStudentCards(d.students || []);
  } catch (e) {
    console.warn("Sup students:", e.message);
  }
}

function renderStudentCards(students) {
  const c = document.getElementById("supStudentsList");
  if (!c) return;
  if (!students.length) {
    c.innerHTML = `<div style="color:var(--text-3);font-size:13px;padding:20px">No students assigned yet. Click "Assign Student" to add one.</div>`;
    return;
  }
  c.innerHTML = students
    .map(
      (s) => `
    <div class="student-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="avatar">${ini(s.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${esc(s.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${esc(s.email)}</div>
        </div>
        <button onclick="supRemoveStudent('${
          s._id
        }')" title="Remove" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:2px">✕</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <span class="badge" style="background:color-mix(in srgb,#3d6b4f 10%,transparent);color:#3d6b4f">${esc(s.major || "—")}</span>
        <span class="badge badge-grey">${esc(s.university || "—")}</span>
        <span class="badge ${s.plan === "pro" ? "badge-green" : "badge-grey"}">${s.plan === "pro" ? "⭐ Pro" : "Free"}</span>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:12px;font-family:'Geist Mono',monospace">
        ${s.generationsUsed ?? 0} / ${s.generationsLimit ?? 10} generations used
      </div>
      <button class="btn btn-outline" style="width:100%;justify-content:center;font-size:12px" onclick="supViewStudentProjects('${s._id}','${esc(
        s.name,
      )}')">
        View Projects →
      </button>
    </div>`,
    )
    .join("");
}

async function supViewStudentProjects(studentId, studentName) {
  try {
    const d = await supFetch(`/students/${studentId}/projects`);
    // Switch to reviews screen and show that student's projects
    supNav(
      "supScreenReviews",
      document.querySelector(".sup-nav-item:nth-child(6)"),
    );
    renderProjectReviewCards(d.projects || [], studentName);
  } catch (e) {
    showToast("✗ " + e.message, "error");
  }
}

async function supRemoveStudent(studentId) {
  if (!confirm("Remove this student from your list?")) return;
  try {
    await supFetch(`/students/${studentId}`, { method: "DELETE" });
    showToast("✓ Student removed");
    supLoadStudents();
    supLoadDashboard();
  } catch (e) {
    showToast("✗ " + e.message, "error");
  }
}

// ── Assign Modal ─────────────────────────────────────
function showAssignModal() {
  document.getElementById("assignModal").style.display = "flex";
  document.getElementById("assignEmail").value = "";
  document.getElementById("assignError").textContent = "";
}
function hideAssignModal() {
  document.getElementById("assignModal").style.display = "none";
}
async function doAssignStudent() {
  const email = document.getElementById("assignEmail").value.trim();
  const err = document.getElementById("assignError");
  err.textContent = "";
  if (!email) {
    err.textContent = "Email is required.";
    return;
  }
  try {
    await supFetch("/students/assign", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    showToast("✓ Student assigned successfully");
    hideAssignModal();
    supLoadStudents();
    supLoadDashboard();
  } catch (e) {
    err.textContent = e.message;
  }
}

// ── Reviews Screen ───────────────────────────────────
async function supLoadAllProjects() {
  try {
    const d = await supFetch("/students");
    const students = d.students || [];
    if (!students.length) {
      document.getElementById("supAllProjectsList").innerHTML =
        `<div style="color:var(--text-3);font-size:13px;padding:20px">No students assigned yet. <a style="color:#3d6b4f;cursor:pointer;font-weight:500" onclick="supNav('supScreenStudents',null)">Assign students →</a></div>`;
      return;
    }
    // Fetch all students' projects in parallel — review data is already merged by the API
    const results = await Promise.all(
      students.map((s) =>
        supFetch(`/students/${s._id}/projects`)
          .then((r) => ({ student: r.student, projects: r.projects }))
          .catch(() => null),
      ),
    );
    let allProjects = [];
    results.filter(Boolean).forEach((r) => {
      (r.projects || []).forEach((p) =>
        allProjects.push({
          ...p,
          studentName: r.student?.name || "—",
          // review is now a property on the project object from the API
        }),
      );
    });
    renderProjectReviewCards(allProjects, null);
  } catch (e) {
    console.warn("Sup all projects:", e.message);
  }
}

function renderProjectReviewCards(projects, filterName) {
  const c = document.getElementById("supAllProjectsList");
  if (!c) return;
  if (!projects.length) {
    c.innerHTML = `<div style="color:var(--text-3);font-size:13px;padding:20px">No projects found for this student.</div>`;
    return;
  }

  const header = filterName
    ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
         <div style="font-size:15px;font-weight:600;color:var(--text-2)">Projects by ${esc(filterName)}</div>
         <button class="btn btn-outline" style="font-size:12px;padding:5px 12px" onclick="supLoadAllProjects()">← All Students</button>
       </div>`
    : `<div style="font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:16px">All Student Projects</div>`;

  const gradeClass = (g) =>
    ({
      Excellent: "grade-excellent",
      "Very Good": "grade-verygood",
      Good: "grade-good",
      "Needs Revision": "grade-revision",
      Rejected: "grade-rejected",
    })[g] || "grade-pending";

  c.innerHTML =
    header +
    projects
      .map((p) => {
        const review = p.review; // now embedded by the API
        const grade = review?.grade || "Pending";
        const hasFeedback = review?.feedback && review.feedback.trim();
        const reviewDate = review?.reviewedAt
          ? new Date(review.reviewedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;

        return `
    <div class="project-review-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;margin-bottom:3px">${esc(p.title)}</div>
          <div style="font-size:12px;color:var(--text-3)">${esc(p.studentName || "—")} · ${esc(p.field)} · ${esc(p.degreeLevel || "—")}</div>
        </div>
        ${
          p.qualityScore != null
            ? `<div style="text-align:center;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 12px">
               <div style="font-size:18px;font-weight:700">${p.qualityScore}</div>
               <div style="font-size:9px;font-family:'Geist Mono',monospace;color:var(--text-3)">SCORE</div>
             </div>`
            : ""
        }
      </div>

      <div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-bottom:12px">
        ${esc((p.description || "").slice(0, 200))}${(p.description || "").length > 200 ? "…" : ""}
      </div>

      <!-- Tech tags row -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${(p.technologies || [])
          .slice(0, 5)
          .map((t) => `<span class="badge badge-blue">${esc(t)}</span>`)
          .join("")}
      </div>

      <!-- Review section — show feedback if exists -->
      ${
        hasFeedback
          ? `
      <div style="background:color-mix(in srgb,#3d6b4f 8%,transparent);border:1px solid color-mix(in srgb,#3d6b4f 25%,transparent);border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:#3d6b4f;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
          Supervisor Feedback ${reviewDate ? `<span style="font-weight:400;color:var(--text-3)">· ${reviewDate}</span>` : ""}
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.6">${esc(review.feedback)}</div>
      </div>`
          : ""
      }

      <!-- Bottom row -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <span class="grade-badge ${gradeClass(grade)}">${grade}</span>
        <button class="btn btn-solid" style="padding:5px 14px;font-size:12px;background:#3d6b4f"
          onclick="openReviewModal('${p._id}','${esc(p.title).replace(/'/g, "'")}','${grade}',\`${(review?.feedback || "").replace(/`/g, "`")}\`)">
          ✏ ${review ? "Edit Review" : "Add Review"}
        </button>
      </div>
    </div>`;
      })
      .join("");
}

// ── Review Modal ─────────────────────────────────────
function openReviewModal(projectId, title, existingGrade, existingFeedback) {
  document.getElementById("reviewModal").style.display = "flex";
  document.getElementById("reviewProjectId").value = projectId;
  document.getElementById("reviewModalTitle").textContent = "Review: " + title;
  document.getElementById("reviewGrade").value = existingGrade || "Pending";
  document.getElementById("reviewFeedback").value = existingFeedback || "";
  document.getElementById("reviewError").textContent = "";
  document.getElementById("reviewModalDesc").textContent =
    existingGrade && existingGrade !== "Pending"
      ? "Editing existing review."
      : "";
}
function hideReviewModal() {
  document.getElementById("reviewModal").style.display = "none";
}
async function submitReview() {
  const projectId = document.getElementById("reviewProjectId").value;
  const grade = document.getElementById("reviewGrade").value;
  const feedback = document.getElementById("reviewFeedback").value.trim();
  const err = document.getElementById("reviewError");
  err.textContent = "";
  if (!grade || grade === "") {
    err.textContent = "Please select a grade.";
    return;
  }
  const btn = document.querySelector("#reviewModal .btn-solid");
  if (btn) {
    btn.textContent = "Saving…";
    btn.disabled = true;
  }
  try {
    await supFetch("/projects/" + projectId + "/review", {
      method: "POST",
      body: JSON.stringify({ grade, feedback }),
    });
    showToast("✓ Review saved successfully");
    hideReviewModal();
    // Refresh both the reviews list and the dashboard stats
    await Promise.all([supLoadAllProjects(), supLoadDashboard()]);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    if (btn) {
      btn.textContent = "Save Review";
      btn.disabled = false;
    }
  }
}

// ── Profile save ─────────────────────────────────────
async function supSaveProfile() {
  try {
    const d = await supFetch("/update-profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: document.getElementById("supProfName").value.trim(),
        title: document.getElementById("supProfTitle").value,
        department: document.getElementById("supProfDept").value.trim(),
        university: document.getElementById("supProfUniv").value.trim(),
      }),
    });
    state.user = { ...state.user, ...d.user };
    localStorage.setItem("gradai_user", JSON.stringify(state.user));
    document.getElementById("supSidebarName").textContent = d.user.name;
    document.getElementById("supSidebarAvatar").textContent = ini(d.user.name);
    document.getElementById("supProfileName").textContent = d.user.name;
    document.getElementById("supProfileAvatar").textContent = ini(d.user.name);
    showToast("✓ Profile updated");
  } catch (e) {
    showToast("✗ " + e.message, "error");
  }
}

// ── Helper ───────────────────────────────────────────
function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "SELECT") {
    [...el.options].forEach((o) => {
      if (o.value === val || o.text === val) o.selected = true;
    });
  } else {
    el.value = val;
  }
}
