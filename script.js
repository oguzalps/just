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
    deleteDoc,
    writeBatch
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
let currentUserUid = null;
let currentUserNickname = null;
let currentUserColor = null;
let currentPage = 1;
let shoutMessages = [];
let shoutIndex = 0;
let shoutInterval = null;
let currentDailyQuestion = null;
const uidToNicknameMap = {};

// Zaman formatlama fonksiyonu
function formatDateTime(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString("tr-TR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Renk üretme ve dönüştürme fonksiyonları
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

function generateRandomColor() {
    const h = Math.floor(Math.random() * 360);
    const s = Math.floor(Math.random() * (90 - 70) + 70);
    const l = Math.floor(Math.random() * (70 - 50) + 50);

    const [r, g, b] = hslToRgb(h, s, l);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// UID ile takma ad ve renk alma
async function getNicknameByUid(uid) {
    if (typeof uid !== 'string' || !uid) {
        console.warn("getNicknameByUid: Geçersiz UID sağlandı:", uid);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
    }

    if (uidToNicknameMap[uid]) {
        return uidToNicknameMap[uid];
    }
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const nickname = userData.nickname;
            const color = userData.color || generateRandomColor();

            if (!userData.color) {
                await updateDoc(doc(db, "users", uid), { color: color });
            }

            uidToNicknameMap[uid] = { nickname, color };
            return { nickname, color };
        } else {
            console.warn("getNicknameByUid: Kullanıcı belgesi bulunamadı:", uid);
            return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
        }
    } catch (error) {
        console.error("Kullanıcı takma adı veya renk alınamadı:", error);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
    }
}

// Toplam tepki sayısını hesaplama
function getTotalReactions(msg) {
    return Object.values(msg.reactions || {}).reduce((acc, arr) => acc + arr.length, 0);
}

// Login İşlemleri
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

        let userColor = null;
        const userDocRef = doc(db, "users", currentUserUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().color) {
            userColor = userDocSnap.data().color;
        } else {
            userColor = generateRandomColor();
        }
        currentUserColor = userColor;

        await setDoc(userDocRef, {
            nickname: nickname,
            color: userColor,
            createdAt: serverTimestamp()
        }, { merge: true });

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";
        document.getElementById("welcome-msg").textContent = `Hoş geldin, ${nickname}!`;
		console.log("Kullanıcı belgesi başarıyla yazıldı/güncellendi."); // Bu mesaj görünmeli


        loadInitialData();
    } catch (error) {
        console.error("Giriş hatası (loginButton):", error); // Bu hatayı mı görüyorsun?
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
            color: currentUserColor,
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

// Tepki butonlarını render etme
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

// Tepki verme/geri çekme
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

        console.log("--- loadMessages Başladı ---");
        console.log("Mesajlar Snapshot boş mu?", snapshot.empty);
        console.log("Mesajlar Snapshot belge sayısı:", snapshot.size);

        snapshot.forEach(doc => {
            const data = doc.data();
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
            const { nickname: displayUser, color: userColor } = uidToNicknameMap[msg.userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; // Cache'den al

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
                    const { nickname: displayReplyUser, color: replyUserColor } = uidToNicknameMap[rep.userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
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

// Yanıt ekleme
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
                    color: currentUserColor,
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

// En çok tepki alan mesajları yükleme
function loadTopMessages() {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        let messages = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        await Promise.all(nicknamePromises);

        const sorted = messages.slice().sort((a, b) => getTotalReactions(b) - getTotalReactions(a)).slice(0, 2);
        if (sorted.length === 0) {
            $("#top-messages-list").text("Henüz yok.");
            return;
        }

        const htmlPromises = sorted.map(async m => {
            const { nickname: displayUser, color: userColor } = uidToNicknameMap[m.userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
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
    const dailyQuestionDocRef = doc(db, "appSettings", "dailyQuestion");

    try {
        const docSnap = await getDoc(dailyQuestionDocRef);
        const now = new Date();
        const todayString = now.toLocaleDateString("tr-TR"); // "gg.aa.yyyy" formatında tarih

        if (docSnap.exists()) {
            const data = docSnap.data();
            const lastQuestionDate = data.date; // Bu 'gg.aa.yyyy' formatında olmalı

            // Tarih karşılaştırması: Kayıtlı tarih bugünden farklı mı?
            if (lastQuestionDate !== todayString) {
                // Yeni gün, soruyu değiştir ve eski cevapları temizle
                const randomIndex = Math.floor(Math.random() * dailyQuestions.length);
                currentDailyQuestion = dailyQuestions[randomIndex].trim();
                await setDoc(dailyQuestionDocRef, {
                    date: todayString,
                    question: currentDailyQuestion
                });
                console.log("Yeni günlük soru ayarlandı ve eski cevaplar temizleniyor.");
                await clearOldAnswers(); // Eski cevapları temizle
            } else {
                // Aynı gün, mevcut soruyu kullan
                currentDailyQuestion = data.question;
            }
        } else {
            // Belge yoksa, ilk defa soru ayarla
            const randomIndex = Math.floor(Math.random() * dailyQuestions.length);
            currentDailyQuestion = dailyQuestions[randomIndex].trim();
            await setDoc(dailyQuestionDocRef, {
                date: todayString,
                question: currentDailyQuestion
            });
            console.log("İlk günlük soru ayarlandı.");
        }
        $("#daily-question p b").text(`Soru: ${currentDailyQuestion}`);
        loadAnswers();
    } catch (error) {
        console.error("Günlük soru ayarlama hatası:", error);
        $("#daily-question p b").text("Soru yüklenemedi.");
    }
}

// Eski günlük soru cevaplarını temizleme
async function clearOldAnswers() {
    const answersRef = collection(db, "answers");
    const q = query(answersRef, where("question", "!=", currentDailyQuestion)); // Mevcut sorudan farklı olan tüm cevapları hedefle

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("Eski günlük soru cevapları bulunamadı.");
            return;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnapshot => {
            batch.delete(doc(db, "answers", docSnapshot.id));
        });

        await batch.commit();
        console.log(`${snapshot.size} adet eski günlük soru cevabı başarıyla silindi.`);
    } catch (error) {
        console.error("Eski günlük soru cevapları temizlenirken hata oluştu:", error);
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
                color: currentUserColor,
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

// Cevapları yükleme ve listeleme
function loadAnswers() {
    if (!currentDailyQuestion) {
        console.warn("loadAnswers: currentDailyQuestion henüz ayarlanmadı.");
        $("#answers-list").text("Henüz cevap yok.");
        return;
    }

    const answersRef = collection(db, "answers");
    const q = query(answersRef,
        where("question", "==", currentDailyQuestion),
        orderBy("createdAt", "asc")
    );

    onSnapshot(q, async (snapshot) => {
        console.log("--- loadAnswers Başladı ---");
        console.log("Answers Snapshot Boş mu?", snapshot.empty);
        console.log("Answers Snapshot belge sayısı:", snapshot.size);
        console.log("currentDailyQuestion değeri:", currentDailyQuestion);

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
            const { nickname: displayUser, color: userColor } = uidToNicknameMap[ans.userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
            $list.append(`
                <div class="mb-2 p-2 rounded" style="background:#333; color:#fff;">
                    <strong style="color: ${userColor};">${displayUser}:</strong> ${ans.text} <small class="text-muted">${formatDateTime(ans.createdAt)}</small>
                </div>
            `);
        }
        $list.scrollTop($list[0].scrollHeight);
    });
}

// Yeni fonksiyon: Eski mesajları ve haykırmaları temizle (24 saatten eski olanlar)
// Verileri temizleme fonksiyonu (cleanupOldData)
// Verileri temizleme fonksiyonu (cleanupOldData)
async function cleanupOldData() {
    console.log("cleanupOldData çalışıyor...");
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    console.log("Şu anki zaman:", now.toLocaleString());
    console.log("24 saat önceki zaman (silme eşiği):", twentyFourHoursAgo.toLocaleString());

    const collectionsToClean = ['messages', 'shouts', 'secret_room_messages'];

    for (const collectionName of collectionsToClean) {
        console.log(`--- Koleksiyon '${collectionName}' için temizlik başlatılıyor ---`);
        console.log(`Sorgu: createdAt < ${twentyFourHoursAgo.toLocaleString()}`); // Sorgu eşiğini logla

        const q = query(collection(db, collectionName), where("createdAt", "<", twentyFourHoursAgo));
        let querySnapshot;
        try {
            querySnapshot = await getDocs(q);
        } catch (error) {
            console.error(`Koleksiyon '${collectionName}' için belge alınırken hata oluştu:`, error);
            // Hata durumunda döngüden çıkma, diğer koleksiyonlara devam et
            continue;
        }


        if (querySnapshot.empty) {
            console.log(`Koleksiyon '${collectionName}' içinde temizlenecek eski veri bulunamadı.`);
            continue;
        }

        console.log(`Koleksiyon '${collectionName}' içinde ${querySnapshot.size} adet eski belge bulundu.`);
        // Bulunan belgelerin ID'lerini ve createdAt tarihlerini logla
        querySnapshot.docs.forEach(docSnapshot => {
            const data = docSnapshot.data();
            console.log(`  - Belge ID: ${docSnapshot.id}, createdAt: ${data.createdAt ? data.createdAt.toDate().toLocaleString() : 'Yok'}`);
        });

        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        try {
            await batch.commit();
            console.log(`Koleksiyon '${collectionName}' içinde ${querySnapshot.size} adet eski belge başarıyla silindi.`);
        } catch (error) {
            console.error(`Koleksiyon '${collectionName}' içindeki eski belgeler silinirken batch commit hatası oluştu:`, error);
        }
        console.log(`--- Koleksiyon '${collectionName}' temizlik tamamlandı ---`);
    }
}

// Gece Yarısına Kadar Geri Sayım ve İşlemler
function countdownToMidnight() {
    const updateCountdown = async () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0); // Bir sonraki gece yarısı

        let remaining = midnight.getTime() - now.getTime();
		
		 

        if (remaining <= 0) {
            // Eğer süre dolmuşsa veya geçmişse (bir sonraki güne geçmişse)
            // Geri sayımı güncelleyip tekrar çalıştırıyoruz, 1 saniye bekle
            // Bu, hemen temizlik işlemini tetiklemek yerine, bir sonraki saniyede doğru hesaplama için
            setTimeout(async () => {
                $("#countdown").text("Yeni gün başladı! Veriler temizleniyor...");
                console.log("Gece yarısı tetiklendi. Veriler temizleniyor...");
                await cleanupOldData(); // Mesajları ve haykırmaları temizle
                await setDailyQuestion(); // Yeni günlük soruyu ayarla ve eski cevapları temizle
                // Veri temizliği ve soru ayarlandıktan sonra sayacı tekrar başlat
                updateCountdown(); // Bir sonraki gece yarısına göre tekrar hesapla
                // Arayüzü yenilemek için gerekli çağrılar:
                loadMessages();
                loadTopMessages();
                loadAnswers(); // setDailyQuestion içinde çağrılıyor ama emin olmak için
                console.log("Veri temizleme ve soru ayarlama tamamlandı.");
            }, 1000); // 1 saniye bekle
            return;
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((remaining / (1000 * 60)) % 60).toString().padStart(2, '0');
        const seconds = Math.floor((remaining / 1000) % 60).toString().padStart(2, '0');
        $("#countdown").text(`Yeni gün için: ${hours}sa ${minutes}dk ${seconds}sn`);
    };

    // İlk çalıştırma ve her saniye güncelleme
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

        const { nickname: firstShoutUser, color: firstShoutColor } = uidToNicknameMap[shoutMessages[shoutIndex].userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
        $("#shout-text-display").html(`<span style="color: ${firstShoutColor};">${firstShoutUser}</span>: ${shoutMessages[shoutIndex].text}`).show();

        shoutInterval = setInterval(async () => {
            shoutIndex++;
            if (shoutIndex >= shoutMessages.length) shoutIndex = 0;

            const { nickname: currentShoutUser, color: currentShoutColor } = uidToNicknameMap[shoutMessages[shoutIndex].userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
            $("#shout-text-display").fadeOut(500, function() {
                $(this).html(`<span style="color: ${currentShoutColor};">${currentShoutUser}</span>: ${shoutMessages[shoutIndex].text}`).fadeIn(500);
            });
        }, 3000);
    });
}

// Haykırma modalını açma
function openShoutModal() {
    const shoutModal = new bootstrap.Modal(document.getElementById('shoutModal'));
    //$("#shout-input").val('');
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
            color: currentUserColor,
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
// Yeni fonksiyon: Uygulama başlangıcında yüklenmesi gereken tüm verileri ve işlevleri başlatır
async function loadInitialData() {
    console.log("loadInitialData: Uygulama başlangıç verileri yükleniyor...");
    await setDailyQuestion(); // Günlük soruyu ayarla (ve eski cevapları temizler)
    loadMessages(); // Ana sayfa mesajlarını yükle
    //loadTopMessages(); // Top mesajları yükle
    startShoutRotation(); // Haykırma rotasyonunu başlat
    countdownToMidnight(); // Geri sayımı başlat (ve gece yarısı temizliği/soru güncellemesi yapar)
}

// Uygulama başlangıcında çalışacak fonksiyon (jQuery document ready)
$(function () {
    $("#message-input-container").addClass("d-none-important");

     onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged tetiklendi. user:", user ? user.uid : "null");

        if (user) {
            // Kullanıcı zaten oturum açmış (veya oturumu sürdürülmüş)
            currentUserUid = user.uid;
            console.log("Kullanıcı durumu: GİRİŞ YAPILMIŞ veya OTURUM SÜRDÜRÜLMÜŞ.", "UID:", currentUserUid);

            const userDocRef = doc(db, "users", currentUserUid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                currentUserNickname = userData.nickname;
                currentUserColor = userData.color || generateRandomColor();
                if (!userData.color) {
                    await updateDoc(userDocRef, { color: currentUserColor });
                }
                console.log("Kullanıcı profili bulundu:", currentUserNickname);
            } else {
                // Bu durum normalde olmamalıdır, çünkü anonim girişte profil oluşturulur.
                // Eğer buraya düşüyorsa, oturum bozulmuş veya eski bir anonim UID'ye denk gelmiş olabilir.
                // Bu senaryoda kullanıcıdan tekrar nick istemek en doğrusu.
                console.warn("Kullanıcı Auth'ta var ancak Firestore'da profili eksik. Yeniden nick girilmesi istenecek.");
                currentUserNickname = null; // Nickname'i sıfırla ki giriş ekranı görünsün
                currentUserColor = null;
                $("#main-app").hide();
                $("#login-screen").show();
                $("#current-user-info").text("Giriş yapınız.");
                return; // Bu durumda daha fazla işlem yapma, giriş ekranını bekle
            }

            $("#current-user-info").text(`Giriş yapıldı: ${currentUserNickname} (UID: ${currentUserUid})`);
            $("#login-screen").hide();
            $("#main-app").show();
            
            // Kullanıcı başarıyla yüklendiğinde/oluşturulduğunda tüm başlangıç verilerini yükle
            loadInitialData(); // <-- Bu her başarılı girişte çalışır
            
        } else {
            // Kullanıcı oturum açmamış (ilk yükleme veya çıkış yapılmış)
            console.log("Kullanıcı durumu: ÇIKIŞ YAPILMIŞ.");
            currentUserUid = null;
            currentUserNickname = null;
            currentUserColor = null;
            $("#main-app").hide();
            $("#login-screen").show(); // HER ZAMAN GİRİŞ EKRANINI GÖSTER
            $("#current-user-info").text("Giriş yapınız.");
            $("#message-input-container").addClass("d-none-important"); // Giriş yapılana kadar mesaj kutusunu gizle
            
            // Eğer burası bir "loginButton" click olayı DEĞİLSE, anonim giriş YAPMA!
            // signInAnonymously çağrısını buradan kaldırın.
            // Sadece kullanıcı "Giriş Yap" butonuna bastığında çağrılmalı.
        }
    });

    // Login İşlemleri (loginButton click listener)
    // BU KOD ZATEN MEVCUT OLMALI, BURADA DEĞİŞİKLİK YAPMA!
    document.getElementById("loginButton").addEventListener("click", async () => {
        const nickname = document.getElementById("nickname").value.trim();

        if (!nickname) {
            alert("Lütfen bir nick girin.");
            return;
        }

        try {
            // Anonim giriş sadece burada, kullanıcı butona bastığında tetiklenmeli
            const userCredential = await signInAnonymously(auth);
            const user = userCredential.user;
            currentUserUid = user.uid;
            currentUserNickname = nickname; // Kullanıcının girdiği nick'i kullan

            let userColor = null;
            const userDocRef = doc(db, "users", currentUserUid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().color) {
                userColor = userDocSnap.data().color;
            } else {
                userColor = generateRandomColor();
            }
            currentUserColor = userColor;

            await setDoc(userDocRef, {
                nickname: nickname, // Kullanıcının girdiği nick
                color: userColor,
                createdAt: serverTimestamp()
            }, { merge: true });

            document.getElementById("login-screen").style.display = "none";
            document.getElementById("main-app").style.display = "block";
            document.getElementById("welcome-msg").textContent = `Hoş geldin, ${nickname}!`;
            
            // Giriş başarılı olduğunda ilk verileri yükle
            loadInitialData(); // <-- Bu da önemli
            
        } catch (error) {
            console.error("Giriş hatası:", error);
            alert("Giriş yapılamadı: " + error.message);
        }
    });


    // Diğer Event Listeners (Bunlar zaten doğru yerde olmalı)
    $("#logout-button").on("click", logout);
    $("#message-send-btn").on("click", sendMessage);
    $("#message-input").on("keypress", function (e) {
        if (e.which == 13) {
            sendMessage();
        }
    });
    $("#send-shout-btn").on("click", openShoutModal);
    $("#submit-shout-btn").on("click", sendShout);
    $("#submit-daily-answer-btn").on("click", submitAnswer);
    $("#open-secret-room-btn").on("click", () => {
        window.location.href = "secret_room.html";
    });


  
    $("#toggle-theme-btn").on("click", () => {
        $("body").toggleClass("light dark");
    });
	
	$("#toggle-message-input-btn").on("click", () => {
        $("#message-input-container").removeClass("d-none-important");
    });
	
    // Event Listeners (Bunlar doğru yerde)
    $("#logout-btn").on("click", logout);
    $("#send-message-btn").on("click", sendMessage);
    $("#message-input").on("keypress", function (e) {
        if (e.which == 13) {
            sendMessage();
        }
    });
    $("#shout-btn").on("click", openShoutModal);
    $("#send-shout-btn").on("click", sendShout);
    $("#submit-answer-btn").on("click", submitAnswer);
    $("#secret-room-btn").on("click", () => {
        window.location.href = "secret_room.html";
    });
});
