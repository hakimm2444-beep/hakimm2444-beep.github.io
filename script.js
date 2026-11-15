import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// =========================================================================
// 1. KONFIGURASI FIREBASE (Isi dengan firebaseConfig dari Project Settings)
// =========================================================================
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6DrR07nH8X_qRlgb7le0RgVPrDgh8nTM",
  authDomain: "hkmmportofolio.firebaseapp.com",
  projectId: "hkmmportofolio",
  storageBucket: "hkmmportofolio.firebasestorage.app",
  messagingSenderId: "51493725276",
  appId: "1:51493725276:web:13631b17d2967512d47299",
  measurementId: "G-D7FZBPB1RN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


let auth = null;
let firestore = null;
let isFirebaseReady = false;

try {
    if (!firebaseConfig.apiKey.includes("TEMPEL_")) {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        firestore = getFirestore(app);
        isFirebaseReady = true;
    }
} catch (err) {
    console.error("Gagal inisialisasi Firebase:", err);
}

// =========================================================================
// 2. DATA DEFAULT & TEMA
// =========================================================================
const defaultAvatar = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e293b"/><circle cx="100" cy="75" r="40" fill="#06b6d4"/><path d="M30 190 C30 130, 170 130, 170 190" fill="#06b6d4"/></svg>`);
const defaultProjImg = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="#0f172a"/><circle cx="200" cy="100" r="20" fill="#334155"/><path d="M185 100 L215 100 M200 85 L200 115" stroke="#94a3b8" stroke-width="4"/></svg>`);

const themes = [
    { name: "Cyan Network", hex: "#06b6d4", glow: "rgba(6, 182, 212, 0.35)" },
    { name: "Matrix Green", hex: "#10b981", glow: "rgba(16, 185, 129, 0.35)" },
    { name: "Cisco Blue", hex: "#3b82f6", glow: "rgba(59, 130, 246, 0.35)" },
    { name: "Fiber Orange", hex: "#f59e0b", glow: "rgba(245, 158, 11, 0.35)" },
    { name: "Hacker Purple", hex: "#a855f7", glow: "rgba(168, 85, 247, 0.35)" }
];

const iconList = [
    "fa-network-wired", "fa-server", "fa-ethernet", "fa-wifi", "fa-microchip", "fa-database",
    "fa-shield-halved", "fa-laptop-code", "fa-code-branch", "fa-terminal", "fa-cloud",
    "fa-envelope", "fa-phone", "fa-brands fa-whatsapp", "fa-brands fa-github", "fa-brands fa-linkedin", "fa-brands fa-instagram"
];

const defaultDB = {
    avatar: defaultAvatar,
    bg: "",
    themeIdx: 0,
    texts: {
        roleText: "Siap Belajar",
        terminalTitle: "Informasi Siswa",
        copyrightText: "© 2026 TJKT Hkmmz Portofolio"
    },
    icons: {},
    projects: [
        { id: 1, title: "Topologi Jaringan Lab", tag: "MIKROTIK", image: defaultProjImg }
    ]
};

let db = structuredClone(defaultDB);
let isEditMode = false;
let currentUser = null;
let targetIconEl = null;
let mouse = { x: null, y: null };

// =========================================================================
// 3. MUAT DATA (FIRESTORE ATAU LOCAL STORAGE) & RENDER UI
// =========================================================================
async function loadData() {
    if (isFirebaseReady) {
        try {
            const docSnap = await getDoc(doc(firestore, "portfolio", "main"));
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                db = {
                    ...structuredClone(defaultDB),
                    ...cloudData,
                    texts: { ...defaultDB.texts, ...(cloudData.texts || {}) },
                    icons: { ...(cloudData.icons || {}) }
                };
            }
        } catch (err) {
            console.error("Gagal memuat Firestore:", err);
        }
    } else {
        const localData = JSON.parse(localStorage.getItem("hkmmz_portfolio_local"));
        if (localData) {
            db = {
                ...structuredClone(defaultDB),
                ...localData,
                texts: { ...defaultDB.texts, ...(localData.texts || {}) },
                icons: { ...(localData.icons || {}) }
            };
        }
    }
    renderUI();
}

function renderUI() {
    applyTheme();

    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = db.avatar || defaultAvatar;

    const heroBg = document.getElementById("hero-bg");
    if (heroBg) {
        heroBg.style.backgroundImage = db.bg ? `url(${db.bg})` : "none";
    }

    document.querySelectorAll(".editable").forEach(el => {
        const key = el.getAttribute("data-key");
        if (key && db.texts[key]) {
            el.innerText = db.texts[key];
        }
    });

    document.querySelectorAll(".edit-icon").forEach(el => {
        const key = el.getAttribute("data-icon");
        if (key && db.icons[key]) {
            const cls = db.icons[key];
            el.className = `edit-icon ${cls.includes("brands") ? cls : "fas " + cls}`;
        }

        el.onclick = function () {
            if (!isEditMode) return;
            targetIconEl = this;
            renderIconModal();
            document.getElementById("modal-ikon").classList.add("active");
        };
    });

    renderProjects();
}

function applyTheme() {
    const theme = themes[db.themeIdx] || themes[0];
    document.documentElement.style.setProperty("--accent", theme.hex);
    document.documentElement.style.setProperty("--accent-glow", theme.glow);
}

function cycleTheme() {
    db.themeIdx = (db.themeIdx + 1) % themes.length;
    applyTheme();
    showToast(`Tema: ${themes[db.themeIdx].name}`);
}

// =========================================================================
// 4. LOGIN ADMIN & MODE EDIT
// =========================================================================
function injectLoginModal() {
    if (document.getElementById("modal-admin-login")) return;

    const modalHTML = `
    <div id="modal-admin-login" class="modal">
        <div class="modal-content glass-card">
            <div class="modal-header">
                <h3><i class="fas fa-user-shield"></i> Login Admin</h3>
                <button class="close-modal" id="close-login-modal">&times;</button>
            </div>
            <form id="form-admin-login">
                <label>Email Admin</label>
                <input type="email" id="admin-email" placeholder="admin@email.com" required>
                <label>Password</label>
                <input type="password" id="admin-pass" placeholder="Masukkan password..." required>
                <button type="submit" id="btn-login-submit" class="btn-primary" style="width: 100%; margin-top: 18px;">
                    <i class="fas fa-sign-in-alt"></i> Masuk Mode Edit
                </button>
            </form>
        </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    document.getElementById("close-login-modal").onclick = () => {
        document.getElementById("modal-admin-login").classList.remove("active");
    };

    document.getElementById("form-admin-login").onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-email").value.trim();
        const pass = document.getElementById("admin-pass").value;
        const btn = document.getElementById("btn-login-submit");

        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memverifikasi...`;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            document.getElementById("modal-admin-login").classList.remove("active");
            document.getElementById("form-admin-login").reset();
            setEditState(true);
            showToast("Login Admin Berhasil!");
        } catch (err) {
            alert("Login gagal! Periksa email dan password admin.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Masuk Mode Edit`;
        }
    };

    if (isFirebaseReady) {
        const toolbarActions = document.querySelector(".toolbar-actions");
        if (toolbarActions && !document.getElementById("btn-admin-logout")) {
            const logoutBtn = document.createElement("button");
            logoutBtn.id = "btn-admin-logout";
            logoutBtn.className = "tool-btn danger";
            logoutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Keluar`;
            logoutBtn.onclick = logoutAdmin;
            toolbarActions.appendChild(logoutBtn);
        }
    }
}

function toggleEditMode() {
    if (isFirebaseReady && !currentUser) {
        document.getElementById("modal-admin-login").classList.add("active");
        return;
    }

    const nextState = !isEditMode;
    setEditState(nextState);
    if (!nextState) {
        saveData(true);
    } else if (!isFirebaseReady) {
        showToast("Mode Edit Lokal Aktif");
    }
}

function setEditState(state) {
    isEditMode = state;
    document.body.classList.toggle("edit-mode", isEditMode);
    document.querySelectorAll(".editable").forEach(el => {
        el.contentEditable = isEditMode ? "true" : "false";
    });

    const btnSpan = document.querySelector("#toggle-edit-btn span");
    const btnIcon = document.querySelector("#toggle-edit-btn i");
    if (btnSpan) btnSpan.textContent = isEditMode ? "Selesai Edit" : "Mode Edit";
    if (btnIcon) btnIcon.className = isEditMode ? "fas fa-check" : "fas fa-sliders-h";
}

async function logoutAdmin() {
    if (!auth) return;
    await signOut(auth);
    setEditState(false);
    showToast("Berhasil logout.");
}

// =========================================================================
// 5. SIMPAN & RESET DATA
// =========================================================================
async function saveData(notify = true) {
    document.querySelectorAll(".editable").forEach(el => {
        const key = el.getAttribute("data-key");
        if (key) {
            db.texts[key] = el.innerText.trim();
        }
    });

    if (isFirebaseReady) {
        if (!currentUser) {
            alert("Silakan login sebagai admin untuk menyimpan perubahan.");
            return;
        }
        const payloadSize = new Blob([JSON.stringify(db)]).size;
        if (payloadSize > 950000) {
            alert("Ukuran total foto mendekati batas 1MB. Hapus beberapa foto proyek terlebih dahulu.");
            return;
        }
        try {
            showToast("Menyimpan ke database...");
            await setDoc(doc(firestore, "portfolio", "main"), db);
            if (notify) showToast("Tersimpan Online!");
        } catch (err) {
            console.error(err);
            alert("Gagal menyimpan ke Firebase. Cek Rules Firestore kamu.");
        }
    } else {
        try {
            localStorage.setItem("hkmmz_portfolio_local", JSON.stringify(db));
            if (notify) showToast("Tersimpan di Browser!");
        } catch (err) {
            alert("Memori browser penuh! Hapus beberapa foto lama.");
        }
    }
}

async function resetData() {
    if (confirm("Kembalikan semua teks dan foto ke pengaturan awal?")) {
        db = structuredClone(defaultDB);
        renderUI();
        await saveData(true);
    }
}

function copyContact(cardEl) {
    if (isEditMode) return;
    const textEl = cardEl.querySelector(".contact-text");
    if (!textEl) return;
    navigator.clipboard.writeText(textEl.innerText.trim()).then(() => {
        showToast("Kontak disalin: " + textEl.innerText.trim());
    });
}

function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
}

// =========================================================================
// 6. UPLOAD & KOMPRESI GAMBAR
// =========================================================================
function compressImage(file, maxW, quality, callback) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
                h = Math.round((h * maxW) / w);
                w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function setupUploadListeners() {
    const inputAvatar = document.getElementById("input-avatar");
    if (inputAvatar) {
        inputAvatar.addEventListener("change", e => {
            if (e.target.files[0]) {
                compressImage(e.target.files[0], 280, 0.65, res => {
                    db.avatar = res;
                    renderUI();
                    saveData();
                });
            }
        });
    }

    const inputBg = document.getElementById("input-bg");
    if (inputBg) {
        inputBg.addEventListener("change", e => {
            if (e.target.files[0]) {
                compressImage(e.target.files[0], 850, 0.6, res => {
                    db.bg = res;
                    renderUI();
                    saveData();
                });
            }
        });
    }

    const formProyek = document.getElementById("form-proyek");
    if (formProyek) {
        formProyek.addEventListener("submit", e => {
            e.preventDefault();
            const file = document.getElementById("proj-img").files[0];
            if (file) {
                compressImage(file, 450, 0.6, imgData => {
                    db.projects.unshift({
                        id: Date.now(),
                        title: document.getElementById("proj-title").value,
                        tag: document.getElementById("proj-tag").value.toUpperCase(),
                        image: imgData
                    });
                    document.getElementById("modal-proyek").classList.remove("active");
                    formProyek.reset();
                    renderProjects();
                    saveData();
                });
            }
        });
    }
}

// =========================================================================
// 7. MODAL IKON & GALERI PROYEK
// =========================================================================
function renderIconModal() {
    const grid = document.getElementById("icon-grid");
    grid.innerHTML = "";
    iconList.forEach(cls => {
        const btn = document.createElement("button");
        btn.className = "icon-btn";
        btn.innerHTML = `<i class="${cls.includes("brands") ? cls : "fas " + cls}"></i>`;
        btn.onclick = () => {
            db.icons[targetIconEl.getAttribute("data-icon")] = cls;
            document.getElementById("modal-ikon").classList.remove("active");
            renderUI();
            saveData();
        };
        grid.appendChild(btn);
    });
}

function renderProjects() {
    const grid = document.getElementById("projects-grid");
    if (!grid) return;
    grid.innerHTML = "";
    db.projects.forEach(p => {
        grid.innerHTML += `
            <div class="glass-card project-card">
                <button class="btn-delete-proj" onclick="deleteProject(${p.id})"><i class="fas fa-trash"></i></button>
                <img src="${p.image}" class="project-thumb" alt="${p.title}">
                <div class="project-body">
                    <span class="project-tag">${p.tag}</span>
                    <h3 style="font-size:16px; margin-bottom:5px;">${p.title}</h3>
                </div>
            </div>`;
    });
}

function deleteProject(id) {
    if (confirm("Hapus proyek ini?")) {
        db.projects = db.projects.filter(p => p.id !== id);
        renderProjects();
        saveData();
    }
}

// =========================================================================
// 8. ANIMASI SCROLL, PARTIKEL CANVAS & EFEK KETIK
// =========================================================================
function initAnimations() {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) e.target.classList.add("active");
        });
    }, { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

    const canvas = document.getElementById("network-canvas");
    const hero = document.getElementById("beranda");
    if (canvas && hero) {
        const ctx = canvas.getContext("2d");
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = hero.offsetHeight;
        }
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
        window.addEventListener("touchmove", e => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; });
        window.addEventListener("touchend", () => { mouse.x = null; mouse.y = null; });

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 1.4;
                this.vy = (Math.random() - 0.5) * 1.4;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = (themes[db.themeIdx] || themes[0]).hex;
                ctx.fill();
            }
        }

        for (let i = 0; i < 45; i++) particles.push(new Particle());

        function animateCanvas() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
                if (mouse.x != null) {
                    const dx = mouse.x - particles[i].x;
                    const dy = mouse.y - particles[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 130) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist / 130})`;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animateCanvas);
        }
        animateCanvas();
    }

    let charIdx = 0;
    let isDel = false;
    function typeEffect() {
        const el = document.getElementById("typing-text");
        if (!el) return;
        if (isEditMode) {
            setTimeout(typeEffect, 300);
            return;
        }
        const txt = db.texts["roleText"] || "Siap Belajar";
        el.textContent = txt.substring(0, isDel ? charIdx - 1 : charIdx + 1);
        charIdx += isDel ? -1 : 1;
        if (!isDel && charIdx === txt.length) {
            isDel = true;
            setTimeout(typeEffect, 2000);
            return;
        }
        if (isDel && charIdx === 0) {
            isDel = false;
        }
        setTimeout(typeEffect, isDel ? 40 : 80);
    }
    typeEffect();
}

// =========================================================================
// 9. INISIALISASI GLOBAL
// =========================================================================
window.toggleEditMode = toggleEditMode;
window.cycleTheme = cycleTheme;
window.saveData = saveData;
window.resetData = resetData;
window.deleteProject = deleteProject;
window.copyContact = copyContact;

async function init() {
    injectLoginModal();
    setupUploadListeners();
    initAnimations();

    if (isFirebaseReady && auth) {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
        });
    }

    await loadData();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}