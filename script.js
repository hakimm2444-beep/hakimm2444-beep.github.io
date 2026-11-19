import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, deleteDoc, 
    collection, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
const defaultAvatar = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e293b"/><circle cx="100" cy="75" r="40" fill="#38bdf8"/><path d="M30 190 C30 130, 170 130, 170 190" fill="#38bdf8"/></svg>`);
const defaultProjImg = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#0f172a"/><circle cx="320" cy="180" r="28" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/><path d="M308 180 L332 180 M320 168 L320 192" stroke="#38bdf8" stroke-width="3"/></svg>`);

const themes = [
    { name: "Sky Glass", hex: "#38bdf8", glow: "rgba(56, 189, 248, 0.45)" },
    { name: "Sakura Pink", hex: "#f472b6", glow: "rgba(244, 114, 182, 0.45)" },
    { name: "Emerald Pond", hex: "#34d399", glow: "rgba(52, 211, 153, 0.45)" },
    { name: "Amber Sun", hex: "#fbbf24", glow: "rgba(251, 191, 36, 0.45)" },
    { name: "Lavender Mist", hex: "#c084fc", glow: "rgba(192, 132, 252, 0.45)" }
];

const iconList = [
    "fa-network-wired", "fa-server", "fa-ethernet", "fa-wifi", "fa-microchip", "fa-database",
    "fa-shield-halved", "fa-laptop-code", "fa-code-branch", "fa-terminal", "fa-cloud",
    "fa-envelope", "fa-phone", "fa-brands fa-whatsapp", "fa-brands fa-github", "fa-brands fa-linkedin", "fa-brands fa-instagram"
];

const defaultProfile = {
    avatar: defaultAvatar,
    bg: "",
    themeIdx: 0,
    texts: {
        roleText: "Siap Belajar",
        terminalTitle: "Informasi Siswa",
        copyrightText: "© 2026 TJKT Hkmmz Portofolio"
    },
    icons: {}
};

let profileData = structuredClone(defaultProfile);
let projectItems = [];
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

    // 1. YouTube (watch, youtu.be, shorts, embed)
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }

    // 2. TikTok URL Penuh (https://www.tiktok.com/@username/video/1234567890123456789)
    const tiktokMatch = cleanUrl.match(/tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokMatch) {
        return { kind: "iframe", src: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}` };
    }

    // 3. Link Pendek TikTok (vt.tiktok.com / vm.tiktok.com)
    if (cleanUrl.includes("tiktok.com")) {
        return { kind: "external-video", src: cleanUrl };
    }

    // 4. Google Drive Video
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
// 4. SINKRONISASI REAL-TIME FIRESTORE (PROFIL + SUB-KOLEKSI KARYA)
// =========================================================================
function initRealtimeSync() {
    if (!isFirebaseReady) {
        renderUI();
        return;
    }

    // 1. Sinkronisasi Profil & Pengaturan Teks (portfolio/main)
    onSnapshot(doc(firestore, "portfolio", "main"), (docSnap) => {
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            profileData = {
                ...structuredClone(defaultProfile),
                avatar: cloudData.avatar || defaultAvatar,
                bg: cloudData.bg || "",
                themeIdx: cloudData.themeIdx ?? 0,
                texts: { ...defaultProfile.texts, ...(cloudData.texts || {}) },
                icons: { ...(cloudData.icons || {}) }
            };
        }
        renderUI();
    }, (err) => {
        console.error("Gagal membaca profil dari Firestore:", err);
        renderUI();
    });

    // 2. Sinkronisasi Koleksi Karya & File Tanpa Batas Jumlah (portfolio/main/items)
    const itemsQuery = query(collection(firestore, "portfolio", "main", "items"), orderBy("createdAt", "desc"));
    onSnapshot(itemsQuery, (querySnap) => {
        projectItems = [];
        querySnap.forEach((docItem) => {
            projectItems.push({ docId: docItem.id, ...docItem.data() });
        });
        renderProjects();
    }, (err) => {
        console.error("Gagal membaca daftar karya:", err);
    });
}

function renderUI() {
    applyTheme();

    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = profileData.avatar || defaultAvatar;

    // Sinkronisasi Background Frosted Glass ke seluruh layar
    const heroBg = document.getElementById("hero-bg");
    if (heroBg) {
        heroBg.style.backgroundImage = "none";
    }
    if (profileData.bg) {
        document.body.style.backgroundImage = `linear-gradient(180deg, rgba(6, 10, 20, 0.32) 0%, rgba(6, 10, 20, 0.55) 100%), url("${profileData.bg}")`;
    } else {
        document.body.style.backgroundImage = `linear-gradient(180deg, rgba(6, 10, 20, 0.32) 0%, rgba(6, 10, 20, 0.55) 100%), url("bg.jpg")`;
    }

    if (!isEditMode) {
        document.querySelectorAll(".editable").forEach(el => {
            const key = el.getAttribute("data-key");
            if (key && profileData.texts[key]) {
                el.innerText = profileData.texts[key];
            }
        });
    }

    document.querySelectorAll(".edit-icon").forEach(el => {
        const key = el.getAttribute("data-icon");
        if (key && profileData.icons[key]) {
            const cls = profileData.icons[key];
            el.className = `edit-icon ${cls.includes("brands") ? cls : "fas " + cls}`;
        }

        el.onclick = function () {
            if (!isEditMode) return;
            targetIconEl = this;
            renderIconModal();
            document.getElementById("modal-ikon").classList.add("active");
        };
    });
}

function applyTheme() {
    const theme = themes[profileData.themeIdx] || themes[0];
    document.documentElement.style.setProperty("--accent", theme.hex);
    document.documentElement.style.setProperty("--accent-glow", theme.glow);
}

function cycleTheme() {
    profileData.themeIdx = (profileData.themeIdx + 1) % themes.length;
    applyTheme();
    saveProfileData(false);
    showToast(`Tema: ${themes[profileData.themeIdx].name}`);
}

// =========================================================================
// 5. SIMPAN PROFIL & SIMPAN KARYA SECARA TERPISAH (ANTI-HILANG)
// =========================================================================
async function saveProfileData(notify = true) {
    if (!isFirebaseReady || !currentUser) {
        alert("Anda harus login sebagai admin terlebih dahulu.");
        return;
    }

    document.querySelectorAll(".editable").forEach(el => {
        const key = el.getAttribute("data-key");
        if (key) {
            profileData.texts[key] = el.innerText.trim();
        }
    });

    const payloadSize = new Blob([JSON.stringify(profileData)]).size;
    if (payloadSize > 950000) {
        alert("Ukuran foto profil + latar belakang melebihi 1MB. Gunakan foto dengan ukuran lebih kecil.");
        return;
    }

    try {
        if (notify) showToast("Menyimpan profil...");
        await setDoc(doc(firestore, "portfolio", "main"), profileData);
        if (notify) showToast("Profil Tersimpan Online!");
    } catch (err) {
        console.error("Error simpan profil:", err);
        alert("Gagal menyimpan profil: " + err.message);
    }
}

async function saveSingleProjectItem(itemObj) {
    if (!isFirebaseReady || !currentUser) {
        alert("Anda harus login sebagai admin untuk menambah konten.");
        return false;
    }

    const itemSize = new Blob([JSON.stringify(itemObj)]).size;
    if (itemSize > 980000) {
        alert("Ukuran file foto ini terlalu besar (>1MB). Gunakan opsi 'Link Gambar HD' dari Google Drive untuk foto berukuran sangat besar.");
        return false;
    }

    try {
        showToast("Mengunggah ke server...");
        const itemId = String(itemObj.id);
        await setDoc(doc(firestore, "portfolio", "main", "items", itemId), itemObj);
        showToast("Berhasil Tersimpan Permanen!");
        return true;
    } catch (err) {
        console.error("Error simpan item:", err);
        alert("Gagal mengunggah ke server Firebase: " + err.message);
        return false;
    }
}

async function deleteProject(id) {
    if (!currentUser) return;
    if (confirm("Hapus item ini secara permanen?")) {
        try {
            showToast("Menghapus...");
            await deleteDoc(doc(firestore, "portfolio", "main", "items", String(id)));
            showToast("Item dihapus.");
        } catch (err) {
            alert("Gagal menghapus item: " + err.message);
        }
    }
}

async function resetData() {
    if (!currentUser) return;
    if (confirm("Kembalikan teks profil, foto profil, background bawaan, dan tema ke pengaturan awal? (Galeri karya tidak ikut terhapus)")) {
        profileData = structuredClone(defaultProfile);
        renderUI();
        await saveProfileData(true);
    }
}

// =========================================================================
// 6. LOGIN ADMIN & MODE EDIT
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
        saveProfileData(true);
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
// 7. FORM UNGGAH KONTEN (FOTO LANGSUNG / LINK HD / TIKTOK / YT / FILE)
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
    const inputAvatar = document.getElementById("input-avatar");
    if (inputAvatar) {
        inputAvatar.addEventListener("change", e => {
            if (e.target.files[0]) {
                processHighQualityImage(e.target.files[0], 500, 0.90, async res => {
                    profileData.avatar = res;
                    renderUI();
                    await saveProfileData(true);
                });
            }
        });
    }

    const inputBg = document.getElementById("input-bg");
    if (inputBg) {
        inputBg.addEventListener("change", e => {
            if (e.target.files[0]) {
                processHighQualityImage(e.target.files[0], 1280, 0.85, async res => {
                    profileData.bg = res;
                    renderUI();
                    await saveProfileData(true);
                });
            }
        });
    }

    const formProyek = document.getElementById("form-proyek");
    if (!formProyek) return;

    formProyek.addEventListener("submit", async e => {
        e.preventDefault();
        const submitBtn = formProyek.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menyimpan ke Cloud...`;

        const type = document.getElementById("proj-type").value;
        const title = document.getElementById("proj-title").value.trim();
        const tag = document.getElementById("proj-tag").value.trim().toUpperCase();
        const desc = document.getElementById("proj-desc").value.trim();
        const ext = document.getElementById("proj-ext").value.trim().toUpperCase() || "FILE";
        const now = Date.now();

        if (type === "image-file") {
            const file = document.getElementById("proj-file-input").files[0];
            if (!file) {
                submitBtn.disabled = false;
                return;
            }
            processHighQualityImage(file, 1100, 0.88, async imgData => {
                const newItem = {
                    id: now,
                    createdAt: now,
                    type: "image",
                    title,
                    tag,
                    desc,
                    url: imgData,
                    ext: ""
                };
                const ok = await saveSingleProjectItem(newItem);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-check"></i> Tambahkan ke Galeri`;
                if (ok) {
                    document.getElementById("modal-proyek").classList.remove("active");
                    formProyek.reset();
                }
            });
        } else {
            const rawUrl = document.getElementById("proj-url").value.trim();
            const normalizedType = type === "image-url" ? "image" : type;
            const finalUrl = normalizedType === "image" ? getDirectImageUrl(rawUrl) : rawUrl;

            const newItem = {
                id: now,
                createdAt: now,
                type: normalizedType,
                title,
                tag,
                desc,
                url: finalUrl,
                ext: normalizedType === "file" ? ext : ""
            };

            const ok = await saveSingleProjectItem(newItem);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fas fa-check"></i> Tambahkan ke Galeri`;
            if (ok) {
                document.getElementById("modal-proyek").classList.remove("active");
                formProyek.reset();
            }
        }
    });
}

// =========================================================================
// 8. RENDER KARTU GALERI & PREVIEW FULLSCREEN
// =========================================================================
function renderProjects() {
    const grid = document.getElementById("projects-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (projectItems.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 14px;">Belum ada dokumentasi yang diunggah.</p>`;
        return;
    }

    projectItems.forEach(p => {
        const type = p.type || "image";
        const mediaUrl = p.url || p.image || defaultProjImg;
        const descText = p.desc || "";
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
    const item = projectItems.find(p => p.id === id);
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
        btn.onclick = async () => {
            profileData.icons[targetIconEl.getAttribute("data-icon")] = cls;
            document.getElementById("modal-ikon").classList.remove("active");
            renderUI();
            await saveProfileData(true);
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
                ctx.fillStyle = (themes[profileData.themeIdx] || themes[0]).hex;
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
        const txt = profileData.texts["roleText"] || "Siap Belajar";
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
window.saveData = () => saveProfileData(true);
window.resetData = resetData;
window.deleteProject = deleteProject;
window.copyContact = copyContact;
window.openProjectModal = openProjectModal;
window.toggleFormInputs = toggleFormInputs;
window.openPreview = openPreview;
window.closePreview = closePreview;

function init() {
    injectLoginModal();
    setupUploadListeners();
    initAnimations();

    if (isFirebaseReady && auth) {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
        });
    }

    initRealtimeSync();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}