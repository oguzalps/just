// script.js
// Sayfalama İçin Global Değişkenler
let currentPage = 1;
// messagePageHistory: Dizideki her eleman, ilgili sayfanın ilk görünen belgesidir (Firestore DocumentSnapshot).
// İlk eleman (index 0) null olacak, çünkü ilk sayfanın "öncesi" yok.
let messagePageHistory = [null]; 
let lastVisibleMessageDoc = null; // Mevcut sayfanın son belgesi
let firstVisibleMessageDoc = null; // Mevcut sayfanın ilk belgesi
let unsubscribeMessages = null; // Firestore dinleyicisini kapatmak için
const MESSAGES_PER_PAGE = 10; // Sayfa başına mesaj sayısı

// Sayfa geçmişini tutan dizi. Her eleman bir önceki sayfanın son belgesi (next için startAfter)
// pageHistory[0] ilk yüklemedir (null). pageHistory[1] 2. sayfanın başlangıcıdır.


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
    writeBatch,
    startAfter // Firestore sayfalama için gerekli
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

let shoutMessages = [];
let shoutIndex = 0;
let shoutInterval = null;
let currentDailyQuestion = null;
const uidToNicknameMap = {};

// Zaman formatlama fonksiyonu
function formatDateTime(timestamp) {
    if (!timestamp) return "";
    // Firebase Timestamp objesi ise toDate() kullan, değilse doğrudan kullan
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

        // **BURASI:** Kullanıcı belgesini oluştur/güncelle
        await setDoc(userDocRef, {
            nickname: nickname,
            color: userColor,
            createdAt: serverTimestamp()
        }, { merge: true });

        // Belge başarılı bir şekilde kaydedildikten sonra UI güncellenmeli ve veriler yüklenmeli
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";
        document.getElementById("welcome-msg").textContent = `Hoş geldin, ${nickname}!`;
        console.log("Kullanıcı belgesi başarıyla yazıldı/güncellendi."); // Bu mesaj görünmeli

        loadInitialData(); // Bu fonksiyonun burada çağrılması önemli
    } catch (error) {
        console.error("Giriş hatası (loginButton):", error);
        alert("Giriş sırasında bir sorun oluştu. Lütfen tekrar deneyin veya internet bağlantınızı kontrol edin.");
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
        // Eski message-input-container yerine Bootstrap modal gizleme
        $('#messageModal').modal('hide'); 
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
    if (!text) {
        alert("Mesaj boş olamaz!");
        return;
    }
    // Opsiyonel: Karakter limiti kontrolü ekleyebilirsin
    if (text.length > 500) { // Örneğin 500 karakter limiti
        alert("Mesajınız en fazla 500 karakter olabilir.");
        return;
    }

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
        
        $("#message-input").val(""); // Inputu temizle
        
        // Mesaj gönderildikten sonra modalı gizle
        $('#messageModal').modal('hide'); 
        
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


// MESAJLARI DOM'A BASAN FONKSİYON - BU EKSİKMİŞ, ŞİMDİ EKLİYORUZ
function displayMessages(messages) {
    const messageList = $("#message-list");
    messageList.empty(); // Mevcut mesajları temizle

    if (messages.length === 0) {
        messageList.html('<p class="text-center text-muted" id="no-messages-text">Henüz mesaj yok.</p>');
        return;
    }
    
    // Eğer no-messages-text elementi varsa gizle
    $("#no-messages-text").addClass("d-none"); // Bu id'ye sahip bir p etiketi HTML'de olmalı

    messages.forEach(message => {
        const repliesCount = (message.replies || []).length;
        // uidToNicknameMap üzerinden kullanıcı bilgilerini al (daha önce Promise.all ile doldurulmuş olmalı)
        const { nickname: displayUser, color: userColor } = uidToNicknameMap[message.userUid] || { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; 

        const messageElement = $(`
            <div class="message p-3 mb-2 rounded shadow-sm">
                <div class="d-flex align-items-center mb-2">
                    <span class="badge" style="background-color: ${userColor}; margin-right: 8px;">${displayUser}</span>
                    <small class="text-muted">${formatDateTime(message.createdAt)}</small>
                </div>
                <p class="mb-2">${message.text}</p>
                <div class="reactions">
                    ${renderReactions(message.id, message.reactions)}
                </div>
                <div class="mt-1">
                    ${repliesCount > 0 ? `<button class="btn btn-sm btn-link p-0 view-replies-toggle" data-message-id="${message.id}" data-replies-count="${repliesCount}">Yanıtlar (${Math.min(5, repliesCount)})</button>` : ''}
                    <button class="btn btn-sm btn-link p-0 add-reply-btn" data-message-id="${message.id}">Yeni Yanıt Ekle</button>
                </div>
                <div class="replies-container" style="display:none;"></div>
            </div>
        `);

        // Yanıtları konteynere ekle (sadece son 5 tanesi)
        const $repliesContainer = messageElement.find(".replies-container");
        if (repliesCount > 0) {
            const repliesToShow = (message.replies || []).slice(-5); // En son 5 yanıtı göster
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
        messageList.append(messageElement);
    });

    // Olay dinleyicilerini burada bağla (her mesaj listesi yenilendiğinde)
    // Sadece .message-list içindeki elementlere dinleyici ekliyoruz
    messageList.off('click', '.react-btn').on('click', '.react-btn', function() {
        const messageId = $(this).data('message-id');
        const emoji = $(this).data('emoji');
        react(messageId, emoji);
    });

    messageList.off('click', '.view-replies-toggle').on('click', '.view-replies-toggle', function() {
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

    messageList.off('click', '.add-reply-btn').on('click', '.add-reply-btn', function() {
        const messageId = $(this).data('message-id');
        addReply(messageId);
    });
}




// Mesajları yükleme ve listeleme (Real-time dinleme ve Sayfalama)
async function loadMessages(direction = 'initial') {
    if (unsubscribeMessages) {
        unsubscribeMessages(); // Önceki dinleyiciyi kapat
        console.log("Önceki onSnapshot dinleyicisi kapatıldı.");
    }

    const messagesRef = collection(db, "messages");
    let q;
    let startDoc = null; // Sorgunun başlayacağı belge
    let queryDirection = "desc"; // Firestore sıralama yönü

    try {
        if (direction === 'initial') {
            currentPage = 1;
            messagePageHistory = [null]; // Geçmişi temizle ve ilk elemanı null yap
            q = query(
                messagesRef,
                orderBy("createdAt", "desc"),
                limit(MESSAGES_PER_PAGE)
            );
            console.log("İlk sayfa yükleniyor...");

        } else if (direction === 'next') {
            // lastVisibleMessageDoc'un mevcut ve geçerli olduğundan emin ol
            if (!lastVisibleMessageDoc) {
                console.warn("Sonraki sayfa için lastVisibleMessageDoc bulunamadı. Muhtemelen son sayfadasınız.");
                updatePaginationButtons(true, false); // Sadece önceki butonu aktif
                return;
            }
            startDoc = lastVisibleMessageDoc;
            currentPage++;
            q = query(
                messagesRef,
                orderBy("createdAt", "desc"),
                startAfter(startDoc), // Bir önceki sayfanın son belgesinden sonra başla
                limit(MESSAGES_PER_PAGE)
            );
            console.log(`Sonraki sayfa yükleniyor. Mevcut sayfa: ${currentPage}`);

        } else if (direction === 'prev') {
            if (currentPage <= 1) {
                console.warn("İlk sayfadasın, daha fazla geri gidemezsin.");
                updatePaginationButtons(false, true); // Sadece sonraki butonu aktif
                return;
            }
            currentPage--;
            // prev için, o sayfadaki en yeni mesajı almamız lazım (yani bir önceki sayfanın ilk mesajı)
            // messagePageHistory[currentPage -1] bize o sayfanın ilk belgesini vermeli
            // Eğer currentPage 1 ise, messagePageHistory[0] yani null olacak, bu da startAfter'ı kullanmamamız gerektiği anlamına gelir.
            startDoc = messagePageHistory[currentPage -1]; 

            // Eğer prevStartDoc null ise (yani ilk sayfaya dönüyorsak), startAfter kullanmayız
            // ve direkt limit ile ilk sayfayı çekeriz.
            if (startDoc) {
                 q = query(
                    messagesRef,
                    orderBy("createdAt", "desc"),
                    startAfter(startDoc), 
                    limit(MESSAGES_PER_PAGE)
                );
            } else { // İlk sayfaya geri dönüyoruz
                q = query(
                    messagesRef,
                    orderBy("createdAt", "desc"),
                    limit(MESSAGES_PER_PAGE)
                );
            }
           
            console.log(`Önceki sayfa yükleniyor. Mevcut sayfa: ${currentPage}`);
        }

        // onSnapshot dinleyicisini burada başlat
        unsubscribeMessages = onSnapshot(q, async (snapshot) => {
            const messages = [];
            const nicknamePromises = [];

            if (snapshot.empty) {
                if (direction === 'next' || direction === 'prev') {
                    console.log(`Sayfa ${currentPage} için veri yok. Sayfa numarası geri alındı.`);
                    // Eğer boş snapshot gelirse ve 'next' veya 'prev' yönündeysek, sayfa numarasını geri al.
                    // 'initial' ise ve boşsa 'Henüz mesaj yok' gösteririz.
                    if (direction === 'next') currentPage--;
                    else if (direction === 'prev') currentPage++; // Geri alırken bir hata oluştuysa ileri al
                    
                    // Eğer current page 0'a düşerse 1 yap.
                    if (currentPage < 1) currentPage = 1;

                    updatePaginationButtons(currentPage > 1, false); // Sadece önceki butonu aktif olabilir
                    updatePaginationNumbers();
                    // Mesaj listesini temizle veya önceki duruma getir
                    $("#message-list").html('<p class="text-center text-muted" id="no-messages-text">Mesaj yüklenemedi veya bu sayfada mesaj yok.</p>');
                    return;
                } else if (direction === 'initial') {
                    $("#message-list").html('<p class="text-center text-muted" id="no-messages-text">Henüz mesaj yok.</p>');
                    updatePaginationButtons(false, false);
                    updatePaginationNumbers();
                    return;
                }
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                messages.push({ id: doc.id, ...data });
                nicknamePromises.push(getNicknameByUid(data.userUid));
                (data.replies || []).forEach(reply => {
                    nicknamePromises.push(getNicknameByUid(reply.userUid));
                });
            });

            await Promise.all(nicknamePromises); 

            displayMessages(messages); 

            // Sayfa geçişleri için son ve ilk görünen belgeleri sakla
            if (snapshot.docs.length > 0) {
                firstVisibleMessageDoc = snapshot.docs[0];
                lastVisibleMessageDoc = snapshot.docs[snapshot.docs.length - 1];

                // Eğer 'next' yönünde yeni bir sayfaya geçtiysek
                // veya 'initial' yükleme ile ilk sayfayı yüklediysek,
                // ve bu sayfanın başlangıç belgesi (yani bir önceki sayfanın son belgesi) henüz history'de yoksa ekle.
                // messagePageHistory'ye her zaman bir sonraki sayfanın başlangıç belgesini (yani bu sayfanın son belgesini) ekliyoruz.
                // Eğer ileri gidiyorsak, şimdiki sayfanın son belgesini bir sonraki sayfanın başlangıcı olarak kaydet.
                if (direction === 'next' && messagePageHistory.length < currentPage + 1) {
                    messagePageHistory.push(lastVisibleMessageDoc); 
                    // currentPage'den bir sonraki dizine ekliyoruz ki, o dizine ulaştığımızda
                    // doğru startAfter belgesini bulabilelim.
                } else if (direction === 'initial' && messagePageHistory.length === 1) {
                    // İlk yüklemede, ilk sayfanın son belgesini, 2. sayfanın başlangıç belgesi olarak kaydet.
                    messagePageHistory.push(lastVisibleMessageDoc);
                }
                 // Eğer prev yapıyorsak ve messagePageHistory'de zaten varsa ekleme yapmayız.
                 // Eğer prev ile currentPage'i düşürdüysek ve o index'teki belge null değilse, zaten history'de var demektir.
            } else { // Hiç mesaj yoksa lastVisibleMessageDoc ve firstVisibleMessageDoc'u sıfırla
                lastVisibleMessageDoc = null;
                firstVisibleMessageDoc = null;
            }

            // Sonraki sayfanın olup olmadığını kontrol etmek için ekstra bir sorgu
            let hasNextPage = false;
            if (lastVisibleMessageDoc) {
                const nextQueryForCheck = query(
                    messagesRef,
                    orderBy("createdAt", "desc"),
                    startAfter(lastVisibleMessageDoc),
                    limit(1) 
                );
                const nextSnapshotCheck = await getDocs(nextQueryForCheck);
                hasNextPage = !nextSnapshotCheck.empty; 
            }

            // Önceki sayfanın olup olmadığını kontrol et
            const hasPrevPage = currentPage > 1;

            updatePaginationButtons(hasPrevPage, hasNextPage);
            updatePaginationNumbers(); 

            console.log(`Sayfa ${currentPage} yüklendi. Mesaj sayısı: ${messages.length}`);
            console.log("lastVisibleMessageDoc ID:", lastVisibleMessageDoc?.id || "Yok");
            console.log("firstVisibleMessageDoc ID:", firstVisibleMessageDoc?.id || "Yok");
            console.log("messagePageHistory IDs:", messagePageHistory.map(doc => doc ? doc.id : 'null'));

        }); 

    } catch (error) {
        console.error("Mesajlar yüklenirken hata:", error);
        alert("Mesajlar yüklenirken bir hata oluştu.");
    }
}

// Sayfalama butonlarının durumunu güncelleyen fonksiyon
function updatePaginationButtons(hasPrev, hasNext) {
    const prevBtn = $("#prev-page-item");
    const nextBtn = $("#next-page-item");

    if (hasPrev) {
        prevBtn.removeClass("disabled");
        prevBtn.find("a").attr("aria-disabled", "false");
    } else {
        prevBtn.addClass("disabled");
        prevBtn.find("a").attr("aria-disabled", "true");
    }

    if (hasNext) {
        nextBtn.removeClass("disabled");
        nextBtn.find("a").attr("aria-disabled", "false");
    } else {
        nextBtn.addClass("disabled");
        nextBtn.find("a").attr("aria-disabled", "true");
    }
}

// Sayfa numaralarını güncelleyen fonksiyon
// Bu fonksiyon artık tüm sayfa sayılarını değil, sadece "Önceki" ve "Sonraki" butonlarını gösterecek.
// Sayfa numaralarını güncelleyen fonksiyon
function updatePaginationNumbers() {
    // Sadece mevcut sayfa numarasını gösteren elementin içeriğini güncelle
    $("#current-page-display .page-link").text(currentPage);

    // Diğer sayfa numaralarını dinamik olarak oluşturmak istersen burayı geliştirebiliriz.
    // Şimdilik sadece "Önceki - 1 - Sonraki" yapısına odaklanalım.
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
                    createdAt: serverTimestamp() // Sunucu zaman damgasını kullan
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
    // Tüm mesajları çekmek yerine, sadece son N mesajı çekip onların arasından en çok tepki alanları bulmak daha mantıklı olabilir.
    // Ancak mevcut logic'e göre tümü çekiliyor, bu da çok mesajda yavaşlayabilir.
    // Eğer Firestore'da aggregation yapmayacaksak, bu haliyle devam edelim.
    const q = query(messagesRef, orderBy("createdAt", "desc")); // order by en yeniyi getirir, top reaksiyon için uygun değil

    onSnapshot(q, async (snapshot) => {
        let messages = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({ id: doc.id, ...data });
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        await Promise.all(nicknamePromises);

        // Önemli: Eğer tüm mesajlar çekiliyorsa ve çok fazlaysa bu sorted işlemi çok yavaşlar.
        // Genellikle ilk 100-200 mesajdan en çok tepki alanı bulmak yeterlidir.
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

        // Event listener'lar her zaman listenin dışına ve bir kere bağlanmalı.
        // off().on() kullanımı bu sorunu çözse de, DOM'a sürekli aynı elementleri basmak maliyetli.
        // Bu yüzden eğer #top-messages-list içinde `.react-btn` dinamik olarak değişiyorsa bu OK.
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
    // currentDailyQuestion ile aynı olmayan tüm cevapları silmek yerine
    // belirli bir tarihten eski olanları silmek daha güvenli olabilir.
    // Ancak bu haliyle devam ediyoruz, logic bu şekilde.
    const q = query(answersRef, where("question", "!=", currentDailyQuestion)); 

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
async function cleanupOldData() {
    console.log("cleanupOldData çalışıyor...");
    const now = new Date();
    // Milisaniye cinsinden 24 saat
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
    const twentyFourHoursAgo = new Date(now.getTime() - twentyFourHoursInMs);
    console.log("Şu anki zaman:", now.toLocaleString());
    console.log("24 saat önceki zaman (silme eşiği):", twentyFourHoursAgo.toLocaleString());

    const collectionsToClean = ['messages', 'shouts', 'secret_room_messages']; // 'secret_room_messages' ekledim

    for (const collectionName of collectionsToClean) {
        console.log(`--- Koleksiyon '${collectionName}' için temizlik başlatılıyor ---`);
        
        // Firestore Timestamp nesnesi ile karşılaştırmak için Date objesini kullanmak doğru.
        // Firestore otomatik olarak Date objelerini Timestamp'e çevirir.
        const q = query(collection(db, collectionName), where("createdAt", "<", twentyFourHoursAgo));
        
        let querySnapshot;
        try {
            querySnapshot = await getDocs(q);
        } catch (error) {
            console.error(`Koleksiyon '${collectionName}' için belge alınırken hata oluştu:`, error);
            continue;
        }

        if (querySnapshot.empty) {
            console.log(`Koleksiyon '${collectionName}' içinde temizlenecek eski veri bulunamadı.`);
            continue;
        }

        console.log(`Koleksiyon '${collectionName}' içinde ${querySnapshot.size} adet eski veri bulunuyor. Siliniyor...`);
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(docSnapshot => {
            batch.delete(doc(db, collectionName, docSnapshot.id));
        });

        try {
            await batch.commit();
            console.log(`Koleksiyon '${collectionName}' için ${querySnapshot.size} adet belge başarıyla silindi.`);
        } catch (error) {
            console.error(`Koleksiyon '${collectionName}' için belgeler silinirken hata oluştu:`, error);
        }
    }
}


// onAuthStateChanged dinleyicisi
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        // Kullanıcı anonim de olsa veritabanında bir kaydının olmasını sağlarız
        const userDocRef = doc(db, "users", currentUserUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            currentUserNickname = userData.nickname;
            currentUserColor = userData.color;
            console.log("Kullanıcı zaten giriş yapmış: ", currentUserNickname);
        } else {
            // Eğer anonim kullanıcı ilk kez geliyorsa ve bir nickname'i yoksa
            // nickname alma ekranına geri yönlendir.
            // Bu durumda loginButton click event'i nickname alıp setDoc yapacak.
            console.log("Anonim kullanıcı girişi, ancak profil bilgisi yok.");
            $("#main-app").hide();
            $("#login-screen").show();
            return;
        }

        // Kullanıcı giriş yaptıysa ana uygulama görünür
        $("#login-screen").hide();
        $("#main-app").show();
        $("#welcome-msg").text(`Hoş geldin, ${currentUserNickname}!`);
        loadInitialData(); // Giriş yapıldıktan sonra tüm verileri yükle
    } else {
        // Kullanıcı çıkış yaptıysa veya hiç giriş yapmadıysa
        console.log("Kullanıcı çıkış yaptı veya giriş yapmadı.");
        $("#main-app").hide();
        $("#login-screen").show();
    }
});

// Tüm başlangıç verilerini yükleyen ana fonksiyon
function loadInitialData() {
    loadTopMessages();
    loadShouts(); // Eğer shouts varsa, onu da yükle
    setDailyQuestion(); // Günlük soruyu yükle ve cevapları getir
    loadMessages('initial'); // Sayfalama ile mesajları yükle
    // Diğer başlangıçta yüklenmesi gereken fonksiyonlar buraya eklenebilir.
	    countdownToMidnight(); // Geri sayımı başlat (ve gece yarısı temizliği/soru güncellemesi yapar)

}

// Bootstrap modal ve diğer event listener'lar
$(document).ready(function() {
    // "Mesaj Yaz" modalını açma butonu
    $("#toggle-message-input-btn").on("click", () => {
        $('#messageModal').modal('show');
        $("#message-input").val(''); // Input'u temizle
    });

    // Mesaj Gönder butonu olay dinleyicisi (modal içinde)
    $("#send-message-btn").on("click", sendMessage);

    // Çıkış butonu
    $("#logout-btn").on("click", logout);

    // Günlük soru cevaplama butonu
    $("#submit-answer-btn").on("click", submitAnswer);

    // Temizleme işlevini belirli aralıklarla çalıştırmak için (eğer kullanılıyorsa)
    // setInterval(cleanupOldData, 60 * 60 * 1000); // Her saat başı çalıştır
    // İlk çalıştırma için (eğer kullanılıyorsa)
    // cleanupOldData();

    // SAYFALAMA BUTONLARI OLAY DİNLEYİCİLERİ
    // Pagination butonları HTML'de sabit olduğu için, ID'lerine direkt bağlama yapıyoruz.
    // Bu, önceki .page-link'e genel bağlamadan daha spesifik ve yönetilebilirdir.
    
    // "Önceki" butonu
    $("#prev-page-item").on("click", (e) => {
        e.preventDefault();
        // Sadece disabled değilse çalıştır
        if (!$("#prev-page-item").hasClass("disabled")) {
            loadMessages('prev');
        }
    });

    // "Sonraki" butonu
    $("#next-page-item").on("click", (e) => {
        e.preventDefault();
        // Sadece disabled değilse çalıştır
        if (!$("#next-page-item").hasClass("disabled")) {
            loadMessages('next');
        }
    });

    // Sayı butonları (Önceki - 1 - Sonraki yapısını kullandığımız için şu anlık yok,
    // ama ilerde eklerseniz buraya ekleyebilirsiniz)
    // Örneğin: $("#page-number-1-btn").on("click", function() { loadMessages('goToPage', 1); });

    // Sayfa ilk yüklendiğinde ve kullanıcı oturumu kontrol edildiğinde
    // loadInitialData() onAuthStateChanged içinde çağrıldığı için burada çağırmıyoruz
    // Ancak sen test etmek istersen veya onAuthStateChanged dışında bir yerde çağrıyorsan:
    // loadInitialData(); // Kullanıcının durumuna göre ilk veriyi yükler
    
    // Eğer onAuthStateChanged dışında direkt mesajları yüklemek istiyorsan,
    // mesela kullanıcı girişi sonrası direkt buraya geliniyorsa:
    // loadMessages('initial'); // İlk mesaj sayfasını yükle

    // onAuthStateChanged dinleyicisini burada tanımlamak yerine genellikle
    // Firebase auth setup dosyasında veya daha genel bir auth.js dosyasında tutulur.
    // Ancak örnek olması açısından buraya da eklenebilir.
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Kullanıcı giriş yapmış.
            console.log("Kullanıcı giriş yapmış:", user.uid);
            // Kullanıcı arayüzünü güncelle (login/logout butonları vs.)
            $("#logged-in-user-info").text(`Giriş Yapan: ${user.email}`);
            $("#logout-btn").show();
            $("#login-btn").hide();
            $("#shout-btn").show();
            $("#toggle-message-input-btn").show();
            
            // Kullanıcı girişi başarılı olduğunda ilk mesajları yükle
            loadMessages('initial'); 
            
            // Nickname'i yükle
            loadUserNickname(); 
            
            // Günlük soruyu yükle (eğer varsa)
            loadDailyQuestion();

        } else {
            // Kullanıcı çıkış yapmış veya giriş yapmamış.
            console.log("Kullanıcı çıkış yapmış.");
            $("#logged-in-user-info").text("Giriş Yapmadınız");
            $("#logout-btn").hide();
            $("#login-btn").show();
            $("#shout-btn").hide();
            $("#toggle-message-input-btn").hide();
            
            // Kullanıcı çıkış yaptığında mesaj listesini temizle veya giriş yapma mesajı göster
            $("#message-list").html('<p class="text-center text-muted">Mesajları görmek için giriş yapmalısınız.</p>');
            updatePaginationButtons(false, false); // Pagination'ı kapat
            updatePaginationNumbers(); // Sayfa numarasını sıfırla/gizle
        }
    });
});


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


// Haykırma mesajları fonksiyonları (buraya ekliyorum, senin kodunda yoktu ama çağırılıyor)
// Bu fonksiyonların da tanımlı olması gerekiyor eğer çağırılıyorsa.
// loadShouts() ve startShoutDisplay()




function loadShouts() { // startShoutDisplay yerine loadShouts ismini kullanıyoruz, tutarlılık için
    const shoutsRef = collection(db, "shouts");
    const q = query(shoutsRef, orderBy("createdAt", "desc"), limit(100)); // Son 100 haykırma

    // Önceki interval'i temizle, aksi takdirde birden fazla interval çalışabilir
    if (shoutInterval) {
        clearInterval(shoutInterval);
        shoutInterval = null;
    }

    onSnapshot(q, async (snapshot) => { // async anahtar kelimesini ekledik!
        const tempShoutMessages = [];
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            tempShoutMessages.push({ id: doc.id, ...data }); // Geçici listeye ekle, nickname henüz yok
            // Her userUid için nickname ve color çekme promise'ini oluştur
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        // Tüm nicknamePromises'in tamamlanmasını bekle
        const resolvedUserProfiles = await Promise.all(nicknamePromises);

        // Şimdi temShoutMessages'ı doldurulmuş nickname ve color ile güncelle
        shoutMessages = tempShoutMessages.map((shout, index) => {
            const userProfile = resolvedUserProfiles[index];
            return {
                ...shout,
                nickname: userProfile.nickname,
                color: userProfile.color
            };
        }).reverse(); // En eski en üstte olacak şekilde sırala

        if (shoutMessages.length > 0) {
            // Eğer daha önce bir interval varsa durdurup yeniden başlat
            if (shoutInterval) {
                clearInterval(shoutInterval);
            }
            // İlk haykırmayı hemen göster ve interval'i başlat
            displayNextShout();
            shoutInterval = setInterval(displayNextShout, 5000); // Her 5 saniyede bir değiştir
        } else {
            $("#shout-text-display").text("Henüz haykırma yok.");
            clearInterval(shoutInterval);
            shoutInterval = null;
        }
    }, (error) => {
        console.error("Haykırma mesajları dinlenirken hata:", error);
        $("#shout-text-display").text("Haykırmalar yüklenemedi.");
        clearInterval(shoutInterval);
        shoutInterval = null;
    });
}

// displayNextShout fonksiyonun zaten doğru, varsayılan değer olarak "Anonim" veya "Bilinmeyen" kullanmalı
// const displayUser = currentShout.nickname || "Anonim"; 
// Sadece `moment` kütüphanesinin HTML'e ekli olduğundan emin ol.

function startShoutDisplay() {
    if (shoutInterval) {
        clearInterval(shoutInterval);
    }
    if (shoutMessages.length === 0) {
        $("#shout-text-display").text("Henüz haykırma yok.");
        return;
    }

    shoutIndex = 0;
    displayNextShout(); // İlk haykırmayı hemen göster

    shoutInterval = setInterval(() => {
        displayNextShout();
    }, 5000); // Her 5 saniyede bir değiştir
}

function displayNextShout() {
    if (shoutMessages.length === 0) {
        $("#shout-text-display").text("Henüz haykırma yok.");
        clearInterval(shoutInterval);
        return;
    }
    const currentShout = shoutMessages[shoutIndex];
    const displayUser = currentShout.nickname || "Anonim";
    const userColor = currentShout.color || "#CCCCCC";

    const shoutHtml = `
        <span class="badge" style="background-color: ${userColor}; margin-right: 5px;">${displayUser}</span>
        ${currentShout.text}
        <small class="text-muted ms-2">${moment(currentShout.createdAt.toDate()).fromNow()}</small>
    `;
    $("#shout-text-display").html(shoutHtml);

    shoutIndex = (shoutIndex + 1) % shoutMessages.length;
}

// "Haykır" butonu ve modalı
$("#shout-btn").on("click", () => {
        $('#shoutModal').modal('show');
        $("#shout-input").val(''); // Input'u temizle
    });

$("#send-shout-btn").on("click", async () => {
    if (!currentUserUid) {
        alert("Haykırmak için giriş yapmalısın!");
        return;
    }
    const shoutText = $("#shout-input").val().trim();
    if (!shoutText) {
        alert("Haykırma boş olamaz!");
        return;
    }
    if (shoutText.length > 200) {
        alert("Haykırma en fazla 200 karakter olabilir!");
        return;
    }

    try {
        await addDoc(collection(db, "shouts"), {
            text: shoutText,
            userUid: currentUserUid,
            nickname: currentUserNickname,
            color: currentUserColor,
            createdAt: serverTimestamp()
        });
        $("#shout-input").val("");
        $('#shoutModal').modal('hide');
        console.log("Haykırma gönderildi.");
    } catch (error) {
        console.error("Haykırma gönderme hatası:", error);
        alert("Haykırma gönderilemedi.");
    }
});