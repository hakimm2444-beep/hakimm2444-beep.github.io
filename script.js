import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// =========================================================================
// 1. KONFIGURASI FIREBASE
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyD6DrR07nH8X_qRlgb7le0RgVPrDgh8nTM",
  authDomain: "hkmmportofolio.firebaseapp.com",
  projectId: "hkmmportofolio",
  storageBucket: "hkmmportofolio.firebasestorage.app",
  messagingSenderId: "51493725276",
  appId: "1:51493725276:web:13631b17d2967512d47299",
  measurementId: "G-D7FZBPB1RN"
};

let auth = null;
let firestore = null;
let isFirebaseReady = false;

try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);
    isFirebaseReady = true;
} catch (err) {
    console.error("Gagal inisialisasi Firebase:", err);
}

// =========================================================================
// 2. DATA DEFAULT & TEMA
// =========================================================================
const defaultAvatar = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e293b"/><circle cx="100" cy="75" r="40" fill="#06b6d4"/><path d="M30 190 C30 130, 170 130, 170 190" fill="#06b6d4"/></svg>`);
const defaultProjImg = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#0f172a"/><circle cx="320" cy="180" r="28" fill="#1e293b" stroke="#06b6d4" stroke-width="3"/><path d="M308 180 L332 180 M320 168 L320 192" stroke="#06b6d4" stroke-width="3"/></svg>`);

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
        {
            id: 1,
            type: "image",
            title: "Topologi Jaringan Lab",
            tag: "MIKROTIK",
            desc: "Perancangan topologi jaringan lokal menggunakan router MikroTik, manajemen VLAN, dan pembagian bandwidth client.",
            url: defaultProjImg,
            ext: ""
        }
    ]
};

let db = structuredClone(defaultDB);
let isEditMode = false;
let currentUser = null;
let targetIconEl = null;
let mouse = { x: null, y: null };

// =========================================================================
// 3. PEMROSESAN GAMBAR TAJAM (HD) & KONVERTER URL MEDIA (TIKTOK / YT / DRIVE)
// =========================================================================
function processHighQualityImage(file, maxW, quality, callback) {
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
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function extractDriveId(url) {
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) return match1[1];
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    return null;
}

function getDirectImageUrl(url) {
    if (!url) return "";
    const driveId = extractDriveId(url);
    if (driveId) {
        return `https://lh3.googleusercontent.com/d/${driveId}=s0`;
    }
    return url.trim();
}

function getEmbedVideoInfo(url) {
    const cleanUrl = url.trim();

    // 1. Cek YouTube (youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...)
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }

    // 2. Cek TikTok URL Penuh (https://www.tiktok.com/@username/video/1234567890123456789)
    const tiktokMatch = cleanUrl.match(/tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokMatch) {
        return { kind: "iframe", src: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}` };
    }

    // 3. Cek Link Pendek TikTok (vt.tiktok.com / vm.tiktok.com)
    if (cleanUrl.includes("tiktok.com")) {
        return { kind: "external-video", src: cleanUrl };
    }

    // 4. Cek Google Drive Video
    const driveId = extractDriveId(cleanUrl);
    if (driveId) {
        return { kind: "iframe", src: `https://drive.google.com/file/d/${driveId}/preview` };
    }

    // 5. Direct MP4 / WebM
    return { kind: "video", src: cleanUrl };
}

function getFileIcon(ext) {
    const e = (ext || "").toUpperCase();
    if (e.includes("PDF")) return "fa-file-pdf";
    if (e.includes("DOC")) return "fa-file-word";
    if (e.includes("XLS") || e.includes("CSV")) return "fa-file-excel";
    if (e.includes("PPT")) return "fa-file-powerpoint";
    if (e.includes("ZIP") || e.includes("RAR") || e.includes("7Z")) return "fa-file-zipper";
    if (e.includes("PKT") || e.includes("RSC") || e.includes("CFG") || e.includes("SH")) return "fa-file-code";
    return "fa-file-lines";
}

// =========================================================================
// 4. MUAT DATA DARI FIRESTORE & RENDER UI
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
    }
    renderUI();
}

function renderUI() {
    applyTheme();

    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = db.avatar || defaultAvatar;

    const heroBg = document.getElementById("hero-bg");
    if (heroBg) {
        heroBg.style.backgroundImage = db.bg ? `url("${db.bg}")` : "none";
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
// 5. LOGIN ADMIN & MODE EDIT
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
            alert("Login gagal! Periksa kembali email dan password admin.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Masuk Mode Edit`;
        }
    };

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

function toggleEditMode() {
    if (!currentUser) {
        document.getElementById("modal-admin-login").classList.add("active");
        return;
    }

    const nextState = !isEditMode;
    setEditState(nextState);
    if (!nextState) {
        saveData(true);
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
// 6. UNGGAH FOTO PROFIL, BACKGROUND & KARYA LANGSUNG
// =========================================================================
function openProjectModal() {
    document.getElementById("form-proyek").reset();
    toggleFormInputs();
    document.getElementById("modal-proyek").classList.add("active");
}

function toggleFormInputs() {
    const type = document.getElementById("proj-type").value;
    const groupFile = document.getElementById("group-file-upload");
    const groupUrl = document.getElementById("group-url-input");
    const fileInput = document.getElementById("proj-file-input");
    const urlInput = document.getElementById("proj-url");
    const labelUrl = document.getElementById("label-media-url");
    const helpUrl = document.getElementById("help-media-url");
    const extGroup = document.getElementById("file-ext-group");

    if (type === "image-file") {
        groupFile.style.display = "block";
        groupUrl.style.display = "none";
        extGroup.style.display = "none";
        fileInput.required = true;
        urlInput.required = false;
    } else {
        groupFile.style.display = "none";
        groupUrl.style.display = "block";
        fileInput.required = false;
        urlInput.required = true;

        if (type === "image-url") {
            labelUrl.textContent = "Link Gambar HD (Google Drive / Imgur / Postimages)";
            urlInput.placeholder = "https://drive.google.com/file/d/...";
            helpUrl.textContent = "Pastikan akses Google Drive diatur ke 'Siapa saja yang memiliki link'.";
            extGroup.style.display = "none";
        } else if (type === "video") {
            labelUrl.textContent = "Link Video (TikTok / YouTube / Google Drive / MP4)";
            urlInput.placeholder = "https://www.tiktok.com/@.../video/... atau https://youtu.be/...";
            helpUrl.textContent = "Mendukung link video TikTok, YouTube, YouTube Shorts, atau video MP4 Google Drive.";
            extGroup.style.display = "none";
        } else {
            labelUrl.textContent = "Link File (Google Drive / GitHub)";
            urlInput.placeholder = "https://drive.google.com/file/d/...";
            helpUrl.textContent = "Mendukung semua format file: PDF, DOCX, PPTX, ZIP, Packet Tracer (.pkt), MikroTik (.rsc), dll.";
            extGroup.style.display = "block";
        }
    }
}

function setupUploadListeners() {
    // Unggah Foto Profil Langsung (HD 550px, kualitas 92%)
    const inputAvatar = document.getElementById("input-avatar");
    if (inputAvatar) {
        inputAvatar.addEventListener("change", e => {
            if (e.target.files[0]) {
                processHighQualityImage(e.target.files[0], 550, 0.92, res => {
                    db.avatar = res;
                    renderUI();
                    saveData(true);
                });
            }
        });
    }

    // Unggah Latar Belakang Langsung (HD 1366px, kualitas 88%)
    const inputBg = document.getElementById("input-bg");
    if (inputBg) {
        inputBg.addEventListener("change", e => {
            if (e.target.files[0]) {
                processHighQualityImage(e.target.files[0], 1366, 0.88, res => {
                    db.bg = res;
                    renderUI();
                    saveData(true);
                });
            }
        });
    }

    // Submit Tambah Karya (Unggah Foto Langsung / Link / TikTok / Video / File)
    const formProyek = document.getElementById("form-proyek");
    if (!formProyek) return;

    formProyek.addEventListener("submit", e => {
        e.preventDefault();
        const type = document.getElementById("proj-type").value;
        const title = document.getElementById("proj-title").value.trim();
        const tag = document.getElementById("proj-tag").value.trim().toUpperCase();
        const desc = document.getElementById("proj-desc").value.trim();
        const ext = document.getElementById("proj-ext").value.trim().toUpperCase() || "FILE";

        if (type === "image-file") {
            const file = document.getElementById("proj-file-input").files[0];
            if (!file) return;
            processHighQualityImage(file, 1200, 0.90, imgData => {
                db.projects.unshift({
                    id: Date.now(),
                    type: "image",
                    title,
                    tag,
                    desc,
                    url: imgData,
                    ext: ""
                });
                document.getElementById("modal-proyek").classList.remove("active");
                formProyek.reset();
                renderProjects();
                saveData(true);
            });
        } else {
            const rawUrl = document.getElementById("proj-url").value.trim();
            const normalizedType = type === "image-url" ? "image" : type;
            const finalUrl = normalizedType === "image" ? getDirectImageUrl(rawUrl) : rawUrl;

            db.projects.unshift({
                id: Date.now(),
                type: normalizedType,
                title,
                tag,
                desc,
                url: finalUrl,
                ext: normalizedType === "file" ? ext : ""
            });

            document.getElementById("modal-proyek").classList.remove("active");
            formProyek.reset();
            renderProjects();
            saveData(true);
        }
    });
}

// =========================================================================
// 7. RENDER KARTU GALERI & PREVIEW FULLSCREEN
// =========================================================================
function renderProjects() {
    const grid = document.getElementById("projects-grid");
    if (!grid) return;
    grid.innerHTML = "";

    db.projects.forEach(p => {
        const type = p.type || "image";
        const mediaUrl = p.url || p.image || defaultProjImg;
        const descText = p.desc || "Dokumentasi praktikum dan portofolio kompetensi TJKT.";
        let mediaHTML = "";
        let badgeHTML = "";
        let actionBtnHTML = "";

        if (type === "image") {
            badgeHTML = `<span class="media-type-pill"><i class="fas fa-image"></i> FOTO</span>`;
            mediaHTML = `<img src="${mediaUrl}" class="project-thumb" alt="${p.title}" loading="lazy" onclick="openPreview(${p.id})">`;
            actionBtnHTML = `<button class="btn-card-action" onclick="openPreview(${p.id})"><i class="fas fa-expand"></i> Lihat Penuh</button>`;
        } else if (type === "video") {
            const vid = getEmbedVideoInfo(mediaUrl);
            badgeHTML = `<span class="media-type-pill"><i class="fas fa-video"></i> VIDEO</span>`;
            if (vid.kind === "iframe") {
                mediaHTML = `<iframe src="${vid.src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
                actionBtnHTML = `<button class="btn-card-action" onclick="openPreview(${p.id})"><i class="fas fa-play"></i> Putar Layar Penuh</button>`;
            } else if (vid.kind === "external-video") {
                mediaHTML = `
                    <div class="file-banner">
                        <i class="fab fa-tiktok"></i>
                        <span class="file-ext-badge">VIDEO TIKTOK</span>
                    </div>`;
                actionBtnHTML = `<a href="${vid.src}" target="_blank" rel="noopener noreferrer" class="btn-card-action"><i class="fab fa-tiktok"></i> Tonton di TikTok</a>`;
            } else {
                mediaHTML = `<video src="${vid.src}" controls preload="metadata"></video>`;
                actionBtnHTML = `<button class="btn-card-action" onclick="openPreview(${p.id})"><i class="fas fa-play"></i> Putar Layar Penuh</button>`;
            }
        } else {
            const extLabel = p.ext || "DOKUMEN";
            const iconCls = getFileIcon(extLabel);
            badgeHTML = `<span class="media-type-pill"><i class="fas fa-file"></i> FILE</span>`;
            mediaHTML = `
                <div class="file-banner">
                    <i class="fas ${iconCls}"></i>
                    <span class="file-ext-badge">${extLabel}</span>
                </div>`;
            actionBtnHTML = `<a href="${mediaUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-action"><i class="fas fa-external-link-alt"></i> Buka / Unduh File</a>`;
        }

        grid.innerHTML += `
            <div class="glass-card project-card">
                <button class="btn-delete-proj" onclick="deleteProject(${p.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                <div class="media-box">
                    ${badgeHTML}
                    ${mediaHTML}
                </div>
                <div class="project-body">
                    <span class="project-tag">${p.tag}</span>
                    <h3 class="project-title">${p.title}</h3>
                    <p class="project-desc">${descText}</p>
                    <div class="project-footer-actions">
                        ${actionBtnHTML}
                    </div>
                </div>
            </div>`;
    });
}

function openPreview(id) {
    const item = db.projects.find(p => p.id === id);
    if (!item) return;

    const container = document.getElementById("preview-media-container");
    const mediaUrl = item.url || item.image || defaultProjImg;

    if ((item.type || "image") === "video") {
        const vid = getEmbedVideoInfo(mediaUrl);
        if (vid.kind === "iframe") {
            container.innerHTML = `<iframe src="${vid.src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        } else if (vid.kind === "external-video") {
            window.open(vid.src, "_blank", "noopener,noreferrer");
            return;
        } else {
            container.innerHTML = `<video src="${vid.src}" controls autoplay></video>`;
        }
    } else {
        container.innerHTML = `<img src="${mediaUrl}" alt="${item.title}">`;
    }

    document.getElementById("preview-tag").textContent = item.tag;
    document.getElementById("preview-title").textContent = item.title;
    document.getElementById("preview-desc").textContent = item.desc || "";
    document.getElementById("modal-preview").classList.add("active");
}

function closePreview() {
    document.getElementById("modal-preview").classList.remove("active");
    document.getElementById("preview-media-container").innerHTML = "";
}

function deleteProject(id) {
    if (confirm("Hapus item ini dari galeri?")) {
        db.projects = db.projects.filter(p => p.id !== id);
        renderProjects();
        saveData(true);
    }
}

// =========================================================================
// 8. SIMPAN & RESET DATA KE FIRESTORE
// =========================================================================
async function saveData(notify = true) {
    if (!isFirebaseReady || !currentUser) {
        alert("Anda harus login sebagai admin untuk menyimpan perubahan.");
        return;
    }

    document.querySelectorAll(".editable").forEach(el => {
        const key = el.getAttribute("data-key");
        if (key) {
            db.texts[key] = el.innerText.trim();
        }
    });

    const payloadSize = new Blob([JSON.stringify(db)]).size;
    if (payloadSize > 980000) {
        alert("Kapasitas penyimpanan langsung hampir penuh (mendekati 1MB). Gunakan opsi 'Link Gambar HD' dari Google Drive untuk foto tambahan, atau hapus foto lama.");
        return;
    }

    try {
        showToast("Menyimpan ke database...");
        await setDoc(doc(firestore, "portfolio", "main"), db);
        if (notify) showToast("Tersimpan Online!");
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan ke Firebase. Periksa koneksi atau Rules Firestore.");
    }
}

async function resetData() {
    if (!currentUser) return;
    if (confirm("Kembalikan semua teks dan konten ke pengaturan awal?")) {
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
// 9. MODAL IKON & ANIMASI PARTIKEL
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
            saveData(true);
        };
        grid.appendChild(btn);
    });
}

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
// 10. INISIALISASI GLOBAL
// =========================================================================
window.toggleEditMode = toggleEditMode;
window.cycleTheme = cycleTheme;
window.saveData = saveData;
window.resetData = resetData;
window.deleteProject = deleteProject;
window.copyContact = copyContact;
window.openProjectModal = openProjectModal;
window.toggleFormInputs = toggleFormInputs;
window.openPreview = openPreview;
window.closePreview = closePreview;

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