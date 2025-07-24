// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    where,
    serverTimestamp,
    getDocs,
	deleteDoc, // <-- Yeni eklenen: Tek belge silmek için (batch kullanacağız ama yine de dursun)
    writeBatch // <-- Yeni eklenen: Toplu silme işlemleri için
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyApT5nPgxEDOA8iqkXlzo2QQGInS3TnhtU",
    authDomain: "just-anonymous.firebaseapp.com",
    projectId: "just-anonymous",
    storageBucket: "just-anonymous.firebasestorage.app",
    messagingSenderId: "419400824575",
    appId: "1:419400824575:web:6b5f1c58d7af8a090efeca",
    measurementId: "G-JS89445Z60"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Eğer kullanmıyorsan bu satırı kaldırabilirsin
const auth = getAuth(app);
const db = getFirestore(app);

// Sabitler
const MESSAGES_PER_PAGE = 10;
const dailyQuestions = [
    "Hayatta seni en çok motive eden şey nedir?",
    "En büyük pişmanlığın ne ve neden?",
    "Eğer zamanı geriye alabilseydin, hangi anı tekrar yaşardın?",
    "Sence insan doğası gereği iyi midir, kötü müdür?",
    "Ölümden sonra yaşam var mı, varsa nasıl bir yer hayal ediyorsun?",
    "Evrenin bir başlangıcı ve sonu var mı, varsa neyden ibaret?",
    "Sence gerçek aşk nedir ve onu nasıl tanımlarsın?",
    "Hayatındaki en değerli hediye neydi ve neden?",
    "Bir süper gücün olsaydı, bu ne olurdu ve neden?",
    "Eğer 24 saatin kalsaydı, ne yapardın?",
    "Mutluluğu nasıl tanımlarsın ve seni ne mutlu eder?",
    "Din ve bilim arasındaki ilişkiyi nasıl görüyorsun?",
    "Sence hayatın anlamı var mı, varsa nedir?",
    "En büyük korkun ne ve bu korkunla nasıl başa çıkarsın?",
    "Tekrar doğsan hangi hayvan olmak isterdin ve neden?",
    "Para mı güç mü, hangisi daha önemli ve neden?",
    "Teknolojinin insanlık üzerindeki en büyük etkisi nedir?",
    "Aşk mı mantık mı, ilişkilerde hangisi daha ağır basmalı?",
    "Bir insanı gerçekten sevdiğini nasıl anlarsın?",
    "Affetmek mi, unutmak mı, hangisi daha zor?",
    "Sence kader mi, yoksa özgür irade mi hayatımızı şekillendirir?",
    "Sanatın insanlık için önemi nedir?",
    "Eğer zamanda yolculuk yapabilseydin, hangi döneme giderdin?",
    "En çok ilham aldığın kişi kim ve neden?",
    "Sence yalnızlık iyi bir şey mi, yoksa kötü mü?",
    "Hayatında en çok neye şükrediyorsun?",
    "Seni en çok güldüren şey nedir?",
    "Bir gün herkesin okumasını istediğin bir kitap var mı?",
    "Dünyayı değiştirmek için yapabileceğin tek bir şey olsaydı, ne olurdu?",
    "Bir ilişkide güven mi, tutku mu daha önemlidir?",
    "En sevdiğin anı ne ve neden?",
    "Hayatında aldığın en iyi tavsiye neydi?",
    "Sence mutluluğun sırrı nedir?",
    "Hangi konularda kendini geliştirmek istersin?",
    "En utanç verici anın neydi?",
    "Hangi filmi defalarca izleyebilirsin?",
    "Çocukluğundan en çok neyi özlüyorsun?",
    "En büyük hayalin nedir ve onu gerçekleştirmek için neler yapıyorsun?",
    "Hangi beceriyi anında kazanmak isterdin?",
    "Eğer hayat bir oyun olsaydı, hangi seviyesinde olurdun?"
];

// Değişkenler
let currentUserUid = null; // Kullanıcının Firebase UID'si
let currentUserNickname = null; // Kullanıcının seçtiği takma ad
let currentUserColor = null; // Kullanıcının rengi
let currentPage = 1;
let shoutMessages = []; // Firestore'dan gelen haykırmalar
let shoutIndex = 0;
let shoutInterval = null;
let currentDailyQuestion = null;
const uidToNicknameMap = {}; // UID'leri nickname ve renk objelerine eşlemek için cache

function formatDateTime(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp); // Firestore Timestamp veya Date objesi
    return d.toLocaleString("tr-TR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}




// Helper Fonksiyonlar

// HSL'den RGB'ye dönüştürücü (renk üretimi için)
function hslToRgb(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color);
    };
    return [f(0), f(8), f(4)];
}

// Rastgele okunaklı renk üreten fonksiyon (koyu arka plan için)
function generateRandomColor() {
    const h = Math.floor(Math.random() * 360); // Ton
    const s = Math.floor(Math.random() * (90 - 70) + 70); // Doygunluk (70-90 arası)
    const l = Math.floor(Math.random() * (70 - 50) + 50); // Parlaklık (50-70 arası, koyu arka plan için ideal)

    const [r, g, b] = hslToRgb(h, s, l);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}


async function getNicknameByUid(uid) {
    // UID'nin geçerli bir string olup olmadığını kontrol et
    if (typeof uid !== 'string' || !uid) {
        console.warn("getNicknameByUid: Geçersiz UID sağlandı:", uid);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; // Geçersiz UID durumunda varsayılan dön
    }

    if (uidToNicknameMap[uid]) {
        return uidToNicknameMap[uid]; // Cache'den dön
    }
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const nickname = userData.nickname;
            const color = userData.color || generateRandomColor(); // Renk yoksa yeni üret

            // Eğer renk yeni üretildiyse, Firestore'a kaydet
            if (!userData.color) {
                await updateDoc(doc(db, "users", uid), { color: color });
            }

            uidToNicknameMap[uid] = { nickname, color }; // Cache'e objeyi ekle
            return { nickname, color };
        } else {
            // Kullanıcı belgesi Firestore'da yoksa (ancak UID geçerliyse)
            console.warn("getNicknameByUid: Kullanıcı belgesi bulunamadı:", uid);
            return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; // Varsayılan dön
        }
    } catch (error) {
        console.error("Kullanıcı takma adı veya renk alınamadı:", error);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; // Hata durumunda varsayılan dön
    }
}

function getTotalReactions(msg) {
    return Object.values(msg.reactions || {}).reduce((acc, arr) => acc + arr.length, 0);
}

// Yeni Login Mantığı (Firebase Anonymous Auth)
document.getElementById("loginButton").addEventListener("click", async () => {
    const nickname = document.getElementById("nickname").value.trim();

    if (!nickname) {
        alert("Lütfen bir nick girin.");
        return;
    }

    try {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        currentUserUid = user.uid;
        currentUserNickname = nickname;

        // Kullanıcının rengini kontrol et veya ata
        let userColor = null;
        const userDocRef = doc(db, "users", currentUserUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().color) {
            userColor = userDocSnap.data().color;
        } else {
            userColor = generateRandomColor();
        }
        currentUserColor = userColor; // Global rengi ayarla

        // Nickname ve rengi kullanıcıyla ilişkilendir (veritabanında)
        await setDoc(userDocRef, {
            nickname: nickname,
            color: userColor, // Rengi de kaydet
            createdAt: serverTimestamp()
        }, { merge: true });

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";
        document.getElementById("welcome-msg").textContent = `Hoş geldin, ${nickname}!`;

        loadInitialData();
    } catch (error) {
        console.error("Giriş hatası:", error);
        alert("Giriş yapılamadı: " + error.message);
    }
});

// Kullanıcı çıkışı
async function logout() {
    try {
        await auth.signOut();
        currentUserUid = null;
        currentUserNickname = null;
        currentUserColor = null;
        $("#main-app").hide();
        $("#login-screen").show();
        $("#nickname").val("");
        $("#message-input-container").addClass("d-none-important");
        clearInterval(shoutInterval);
        $("#shout-text-display").text("Henüz haykırma yok.");
    } catch (error) {
        console.error("Çıkış hatası:", error);
        alert("Çıkış yapılırken bir hata oluştu.");
    }
}

// Mesaj gönderme
async function sendMessage() {
    if (!currentUserUid) {
        alert("Mesaj göndermek için giriş yapmalısın!");
        return;
    }
    const text = $("#message-input").val().trim();
    if (!text) return alert("Mesaj boş olamaz!");

    try {
        await addDoc(collection(db, "messages"), {
            text,
            userUid: currentUserUid,
            nickname: currentUserNickname,
            color: currentUserColor, // Rengi de mesajla birlikte kaydet (opsiyonel, getNicknameByUid yeterli)
            createdAt: serverTimestamp(),
            reactions: {},
            replies: []
        });
        $("#message-input").val("");
        $("#message-input-container").addClass("d-none-important");
    } catch (error) {
        console.error("Mesaj gönderme hatası:", error);
        alert("Mesaj gönderilemedi.");
    }
}

// Tepki butonlarını render etme (Emoji Tepki Sistemi)
function renderReactions(msgId, reactions) {
    let html = "";
    const emojis = ["😂", "😲", "🤔"];
    emojis.forEach(e => {
        const usersReacted = reactions?.[e] || [];
        const count = usersReacted.length;

        const hasReacted = currentUserUid && usersReacted.includes(currentUserUid);
        const btnClass = hasReacted ? "btn-primary" : "btn-outline-light";

        html += `<button class="btn btn-sm ${btnClass} me-1 react-btn" data-message-id="${msgId}" data-emoji="${e}">${e}`;
        if (count > 0) html += ` <span class="badge bg-danger">${count}</span>`;
        html += "</button>";
    });
    return html;
}

// Tepki verme/geri çekme (Emoji Tepki Sistemi)
async function react(messageId, emoji) {
    if (!currentUserUid) {
        alert("Tepki vermek için giriş yapmalısın!");
        return;
    }

    const messageRef = doc(db, "messages", messageId);
    try {
        const messageDoc = await getDoc(messageRef);
        if (messageDoc.exists()) {
            const currentReactions = messageDoc.data().reactions || {};
            const usersReacted = currentReactions[emoji] || [];

            if (usersReacted.includes(currentUserUid)) {
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayRemove(currentUserUid)
                });
            } else {
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayUnion(currentUserUid)
                });
            }
        }
    } catch (error) {
        console.error("Tepki hatası:", error);
        alert("Tepki verilemedi.");
    }
}

// Mesajları yükleme ve listeleme (Real-time dinleme)
function loadMessages() {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        const messages = [];
        const nicknamePromises = [];

        // Hata ayıklama için ek loglar
        console.log("--- loadMessages Başladı ---");
        console.log("Mesajlar Snapshot boş mu?", snapshot.empty);
        console.log("Mesajlar Snapshot belge sayısı:", snapshot.size);

        snapshot.forEach(doc => {
            const data = doc.data();
            // 24 saatlik filtreleme burada kaldırılmıştı, bu kısım doğru
            messages.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
            (data.replies || []).forEach(reply => {
                nicknamePromises.push(getNicknameByUid(reply.userUid));
            });
        });

        await Promise.all(nicknamePromises);

        console.log("Filtreleme sonrası 'messages' dizisi boyutu:", messages.length);


        const totalPages = Math.ceil(messages.length / MESSAGES_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages || 1;

        $("#pagination").empty();
        for (let i = 1; i <= totalPages; i++) {
            const active = i === currentPage ? "active" : "";
            $("#pagination").append(`<li class="page-item ${active}"><a href="#" class="page-link">${i}</a></li>`);
        }

        const start = (currentPage - 1) * MESSAGES_PER_PAGE;
        const pageMessages = messages.slice(start, start + MESSAGES_PER_PAGE);

        const $list = $("#message-list").empty();

        if (pageMessages.length === 0) {
            $list.append("<p class='text-center text-muted mt-3'>Henüz mesaj yok.</p>");
            return;
        }

        for (const msg of pageMessages) {
            const repliesCount = (msg.replies || []).length;
            const { nickname: displayUser, color: userColor } = await getNicknameByUid(msg.userUid);

            const msgEl = $(`
                <div class="message">
                    <div><strong style="color: ${userColor};">${displayUser}</strong> <small class="text-muted">${formatDateTime(msg.createdAt)}</small></div>
                    <div class="mt-1 mb-2">${msg.text}</div>
                    <div class="reactions">${renderReactions(msg.id, msg.reactions)}</div>
                    <div class="mt-1">
                        ${repliesCount > 0 ? `<button class="btn btn-sm btn-link p-0 view-replies-toggle" data-message-id="${msg.id}" data-replies-count="${repliesCount}">Yanıtlar (${Math.min(5, repliesCount)})</button>` : ''}
                        <button class="btn btn-sm btn-link p-0 add-reply-btn" data-message-id="${msg.id}">Yeni Yanıt Ekle</button>
                    </div>
                    <div class="replies-container" style="display:none;"></div>
                </div>
            `);

            const $repliesContainer = msgEl.find(".replies-container");
            if (repliesCount > 0) {
                const repliesToShow = (msg.replies || []).slice(-5);
                for (const rep of repliesToShow) {
                    const { nickname: displayReplyUser, color: replyUserColor } = await getNicknameByUid(rep.userUid);
                    const repEl = $(`
                        <div class="reply-message mt-1 p-2 rounded" style="background:#444; color:#eee;">
                            <strong style="color: ${replyUserColor};">${displayReplyUser}</strong> <small class="text-muted">${formatDateTime(rep.createdAt)}</small><br/>
                            ${rep.text}
                        </div>
                    `);
                    $repliesContainer.append(repEl);
                }
            }
            $list.append(msgEl);
        }

        $("#pagination").off("click", ".page-link").on("click", ".page-link", function (e) {
            e.preventDefault();
            currentPage = parseInt($(this).text());
        });

        $("#message-list").off('click', '.react-btn').on('click', '.react-btn', function () {
            const messageId = $(this).data('message-id');
            const emoji = $(this).data('emoji');
            react(messageId, emoji);
        });

        $("#message-list").off('click', '.view-replies-toggle').on('click', '.view-replies-toggle', function () {
            const $button = $(this);
            const $repliesContainer = $button.closest(".message").find(".replies-container");
            const repliesCount = $button.data('replies-count');

            $repliesContainer.slideToggle(400, function() {
                if ($(this).is(":visible")) {
                    $button.text("Yanıtları Gizle");
                } else {
                    $button.text(`Yanıtlar (${Math.min(5, repliesCount)})`);
                }
            });
        });

        $("#message-list").off('click', '.add-reply-btn').on('click', '.add-reply-btn', function () {
            const messageId = $(this).data('message-id');
            addReply(messageId);
        });
    });
}



// Yanıt ekleme (Yanıt Sistemi)
async function addReply(messageId) {
    if (!currentUserUid) {
        alert("Yanıt vermek için giriş yapmalısın!");
        return;
    }
    const replyText = prompt("Yanıtınızı yazın:");
    if (replyText && replyText.trim() !== "") {
        const messageRef = doc(db, "messages", messageId);
        try {
            await updateDoc(messageRef, {
                replies: arrayUnion({
                    userUid: currentUserUid,
                    nickname: currentUserNickname,
                    color: currentUserColor, // Yanıtla birlikte rengi de kaydet (opsiyonel)
                    text: replyText.trim(),
                    createdAt: new Date()
                })
            });
        } catch (error) {
            console.error("Yanıt ekleme hatası:", error);
            alert("Yanıt eklenemedi.");
        }
    }
}

// En çok tepki alan mesajları yükleme (Real-time dinleme)
function loadTopMessages() {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        let messages = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // 24 saatlik filtreleme kaldırıldı, tüm mesajlar değerlendirilecek
            messages.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        await Promise.all(nicknamePromises);

        // Sıralama ve ilk 2'yi alma mantığı aynı kalacak
        const sorted = messages.slice().sort((a, b) => getTotalReactions(b) - getTotalReactions(a)).slice(0, 2);
        if (sorted.length === 0) {
            $("#top-messages-list").text("Henüz yok.");
            return;
        }

        const htmlPromises = sorted.map(async m => {
            const { nickname: displayUser, color: userColor } = await getNicknameByUid(m.userUid);
            return `<div class="mb-2 p-2 rounded message">
                <div><strong style="color: ${userColor};">${displayUser}</strong> <small class="text-muted">${formatDateTime(m.createdAt)}</small></div>
                <div>${m.text}</div>
                <div class="reactions mt-2">${renderReactions(m.id, m.reactions)}</div>
            </div>`;
        });

        const html = (await Promise.all(htmlPromises)).join("");
        $("#top-messages-list").html(html);

        $("#top-messages-list").off('click', '.react-btn').on('click', '.react-btn', function() {
            const messageId = $(this).data('message-id');
            const emoji = $(this).data('emoji');
            react(messageId, emoji);
        });
    });
}

// Günlük soruyu ayarlama (Firestore'dan okuma/yazma)
async function setDailyQuestion() {
    const today = new Date().toDateString();
    const dailyQuestionDocRef = doc(db, "appSettings", "dailyQuestion");

    try {
        const docSnap = await getDoc(dailyQuestionDocRef);

        if (docSnap.exists() && docSnap.data().date === today) {
            currentDailyQuestion = docSnap.data().question;
        } else {
            const randomIndex = Math.floor(Math.random() * dailyQuestions.length);
            currentDailyQuestion = dailyQuestions[randomIndex].trim();
            await setDoc(dailyQuestionDocRef, {
                date: today,
                question: currentDailyQuestion
            });
        }
        $("#daily-question p b").text(`Soru: ${currentDailyQuestion}`);
        loadAnswers();
    } catch (error) {
        console.error("Günlük soru ayarlama hatası:", error);
        $("#daily-question p b").text("Soru yüklenemedi.");
    }
}

// Günlük soruya cevap gönderme
async function submitAnswer() {
    if (!currentUserUid) {
        alert("Cevap vermek için giriş yapmalısın!");
        return;
    }
    const answerText = $("#daily-answer").val().trim();
    if (!answerText) return alert("Cevabın boş olamaz!");

    try {
        const answersRef = collection(db, "answers");
        const q = query(answersRef,
            where("userUid", "==", currentUserUid),
            where("question", "==", currentDailyQuestion),
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docToUpdate = querySnapshot.docs[0];
            await updateDoc(doc(db, "answers", docToUpdate.id), {
                text: answerText,
                createdAt: serverTimestamp()
            });
            alert("Cevabınız güncellendi!");
        } else {
            await addDoc(answersRef, {
                userUid: currentUserUid,
                nickname: currentUserNickname,
                color: currentUserColor, // Cevapla birlikte rengi de kaydet (opsiyonel)
                question: currentDailyQuestion,
                text: answerText,
                createdAt: serverTimestamp()
            });
            alert("Cevabınız gönderildi!");
        }
        $("#daily-answer").val("");
        loadAnswers();
    } catch (error) {
        console.error("Cevap gönderme hatası:", error);
        alert("Cevap gönderilemedi.");
    }
}

// Cevapları yükleme ve listeleme (Real-time dinleme)
function loadAnswers() {
    if (!currentDailyQuestion) {
        console.warn("loadAnswers: currentDailyQuestion henüz ayarlanmadı.");
        $("#answers-list").text("Henüz cevap yok.");
        return;
    }

    const answersRef = collection(db, "answers");
    // ÖNEMLİ: 'question' alanına göre filtreleme ve 'createdAt'e göre sıralama için
    // Firebase konsolunda bir DİZİN oluşturman GEREKİYOR.
    const q = query(answersRef,
        where("question", "==", currentDailyQuestion), // <-- Bu satırın aktif olduğundan emin ol
        orderBy("createdAt", "asc")
    );

    onSnapshot(q, async (snapshot) => {
        console.log("--- loadAnswers Başladı ---");
        console.log("Answers Snapshot Boş mu?", snapshot.empty);
        console.log("Answers Snapshot belge sayısı:", snapshot.size);
        console.log("currentDailyQuestion değeri:", currentDailyQuestion); // Hata ayıklama için

        const answers = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            answers.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        console.log("Oluşturulan Answers Dizisi boyutu:", answers.length);

        await Promise.all(nicknamePromises);

        const $list = $("#answers-list").empty();

        if (answers.length === 0) {
            $list.text("Henüz cevap yok.");
            return;
        }

        for (const ans of answers) {
            const { nickname: displayUser, color: userColor } = await getNicknameByUid(ans.userUid);
            $list.append(`
                <div class="mb-2 p-2 rounded" style="background:#333; color:#fff;">
                    <strong style="color: ${userColor};">${displayUser}:</strong> ${ans.text} <small class="text-muted">${formatDateTime(ans.createdAt)}</small>
                </div>
            `);
        }
        $list.scrollTop($list[0].scrollHeight);
    });
}


// Yeni fonksiyon: Eski verileri temizle
async function cleanupOldData() {
    console.log("Eski veriler temizleniyor...");
    const twentyFourHoursAgo = new Date(Date.now() - 86400000);

    const collectionsToClean = ["messages", "shouts", "answers"];

    for (const collectionName of collectionsToClean) {
        try {
            const q = query(
                collection(db, collectionName),
                where("createdAt", "<", twentyFourHoursAgo)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                console.log(`Koleksiyon '${collectionName}' içinde temizlenecek eski veri yok.`);
                continue;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnapshot => {
                batch.delete(doc(db, collectionName, docSnapshot.id));
            });

            await batch.commit();
            console.log(`Koleksiyon '${collectionName}' içindeki ${snapshot.size} eski belge başarıyla silindi.`);

        } catch (error) {
            console.error(`Koleksiyon '${collectionName}' temizlenirken hata oluştu:`, error);
        }
    }
}

// Gece Yarısına Kadar Geri Sayım
function countdownToMidnight() {
    const updateCountdown = () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        const remaining = midnight.getTime() - now.getTime();

        if (remaining <= 0) {
            $("#countdown").text("Yeni gün başladı! Veriler temizleniyor...");
            cleanupOldData().then(() => {
                console.log("Veri temizleme tamamlandı, sayfa yenileniyor.");
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }).catch(error => {
                console.error("Veri temizleme sırasında hata oluştu:", error);
                setTimeout(() => {
                    location.reload();
                }, 1000);
            });
            return;
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((remaining / (1000 * 60)) % 60).toString().padStart(2, '0');
        const seconds = Math.floor((remaining / 1000) % 60).toString().padStart(2, '0');
        $("#countdown").text(`Yeni gün için: ${hours}sa ${minutes}dk ${seconds}sn`);
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Haykırma rotasyonunu başlatma (Real-time dinleme)
function startShoutRotation() {
    const shoutsRef = collection(db, "shouts");
    const q = query(shoutsRef, orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        shoutMessages = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // 24 saatlik filtreleme kaldırıldı, tüm haykırmalar değerlendirilecek
            shoutMessages.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        await Promise.all(nicknamePromises);

        if (shoutInterval) clearInterval(shoutInterval);
        shoutIndex = 0;

        if (shoutMessages.length === 0) {
            $("#shout-text-display").text("Henüz haykırma yok.");
            return;
        }

        const { nickname: firstShoutUser, color: firstShoutColor } = await getNicknameByUid(shoutMessages[shoutIndex].userUid);
        $("#shout-text-display").html(`<span style="color: ${firstShoutColor};">${firstShoutUser}</span>: ${shoutMessages[shoutIndex].text}`).show();

        shoutInterval = setInterval(async () => {
            shoutIndex++;
            if (shoutIndex >= shoutMessages.length) shoutIndex = 0;

            const { nickname: currentShoutUser, color: currentShoutColor } = await getNicknameByUid(shoutMessages[shoutIndex].userUid);
            $("#shout-text-display").fadeOut(500, function() {
                $(this).html(`<span style="color: ${currentShoutColor};">${currentShoutUser}</span>: ${shoutMessages[shoutIndex].text}`).fadeIn(500);
            });
        }, 3000);
    });
}

// Haykırma modalını açma
function openShoutModal() {
    const shoutModal = new bootstrap.Modal(document.getElementById('shoutModal'));
    $("#shout-input").val('');
    shoutModal.show();
}

// Haykırma mesajı gönderme
async function sendShout() {
    if (!currentUserUid) {
        alert("Haykırmak için giriş yapmalısın!");
        return;
    }
    const shoutText = $("#shout-input").val().trim();
    if (!shoutText) {
        alert("Haykırmak istediğin mesaj boş olamaz!");
        return;
    }
    if (shoutText.length > 150) {
        alert("Haykırma mesajı en fazla 150 karakter olabilir.");
        return;
    }

    try {
        await addDoc(collection(db, "shouts"), {
            userUid: currentUserUid,
            nickname: currentUserNickname,
            color: currentUserColor, // Rengi de haykırmayla birlikte kaydet (opsiyonel)
            text: shoutText,
            createdAt: serverTimestamp()
        });
        $("#shout-input").val("");
        bootstrap.Modal.getInstance(document.getElementById('shoutModal')).hide();
    } catch (error) {
        console.error("Haykırma gönderme hatası:", error);
        alert("Haykırma gönderilemedi.");
    }
}

// Uygulama başlangıcında çalışacak fonksiyon (jQuery document ready)
$(function () {
    $("#message-input-container").addClass("d-none-important");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            const userDocRef = doc(db, "users", currentUserUid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                currentUserNickname = userData.nickname;
                currentUserColor = userData.color || generateRandomColor();
                if (!userData.color) {
                    await updateDoc(userDocRef, { color: currentUserColor });
                }
            } else {
                currentUserNickname = "Anonim_" + Math.random().toString(36).substring(2, 7);
                currentUserColor = generateRandomColor();
                try {
                    await setDoc(userDocRef, {
                        nickname: currentUserNickname,
                        color: currentUserColor,
                        createdAt: serverTimestamp()
                    });
                    console.warn("Yeni kullanıcı profili oluşturuldu:", currentUserNickname, currentUserUid);
                } catch (error) {
                    console.error("Yeni kullanıcı profili oluşturulurken hata:", error);
                    alert("Kullanıcı profili oluşturulamadı. Lütfen tekrar deneyin.");
                    logout();
                    return;
                }
            }

            uidToNicknameMap[currentUserUid] = { nickname: currentUserNickname, color: currentUserColor };

            $("#login-screen").hide();
            $("#main-app").show();
            $("#welcome-msg").text(`Hoş geldin, ${currentUserNickname}!`);
            loadInitialData();
        } else {
            currentUserUid = null;
            currentUserNickname = null;
            currentUserColor = null;
            $("#main-app").hide();
            $("#login-screen").show();
            $("#nickname").val("");
            $("#message-input-container").addClass("d-none-important");
            clearInterval(shoutInterval);
            $("#shout-text-display").text("Henüz haykırma yok.");
        }
    });

    // Event Listener'lar
    $("#logout-btn").on("click", logout);
    $("#send-message-btn").on("click", sendMessage);
    $("#toggle-theme-btn").on("click", () => {
        $("body").toggleClass("light dark");
    });
    $("#submit-answer-btn").on("click", submitAnswer);
    $("#toggle-message-input-btn").on("click", () => {
        $("#message-input-container").removeClass("d-none-important");
    });
    $("#shout-btn").on("click", openShoutModal);
    $("#send-shout-btn").on("click", sendShout);

    // Gizli Oda butonuna tıklama olayı (Şimdi doğru yerde)
    $("#secret-room-btn").on("click", () => {
        window.location.href = "secret_room.html";
    });

    setDailyQuestion();
    countdownToMidnight();
});



function loadInitialData() {
    loadMessages();
    loadTopMessages();
    loadAnswers();
    startShoutRotation();
}
