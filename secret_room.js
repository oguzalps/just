import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Config (Ana uygulamadaki ile aynı olmalı)
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
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;
let currentUserNickname = null;
let currentUserColor = null;
const uidToNicknameMap = {};

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
    const h = Math.floor(Math.random() * 360);
    const s = Math.floor(Math.random() * (90 - 70) + 70);
    const l = Math.floor(Math.random() * (70 - 50) + 50);

    const [r, g, b] = hslToRgb(h, s, l);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Helper function to get nickname and color from UID
async function getNicknameByUid(uid) {
    // UID'nin geçerli bir string olup olmadığını kontrol et
    if (typeof uid !== 'string' || !uid) {
        console.warn("getNicknameByUid: Geçersiz UID sağlandı:", uid);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" }; // Geçersiz UID durumunda varsayılan dön
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
            // Kullanıcı belgesi Firestore'da yoksa
            console.warn("getNicknameByUid: Kullanıcı belgesi bulunamadı:", uid);
            return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
        }
    } catch (error) {
        console.error("Kullanıcı takma adı veya renk alınamadı:", error);
        return { nickname: "Bilinmeyen Kullanıcı", color: "#CCCCCC" };
    }
}



// Helper function to format timestamp
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

// Mesajları gönderme
async function sendSecretMessage() {
    if (!currentUserUid) {
        alert("Mesaj göndermek için giriş yapmalısın!");
        return;
    }
    const messageText = $("#secret-message-input").val().trim();
    if (!messageText) return;

    try {
        await addDoc(collection(db, "secret_room_messages"), {
            userUid: currentUserUid,
            nickname: currentUserNickname,
            color: currentUserColor,
            text: messageText,
            createdAt: serverTimestamp()
        });
        $("#secret-message-input").val("");
    } catch (error) {
        console.error("Gizli oda mesajı gönderme hatası:", error);
        alert("Mesaj gönderilemedi.");
    }
}

// Mesajları yükleme ve gerçek zamanlı dinleme
function loadSecretMessages() {
    const messagesRef = collection(db, "secret_room_messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    onSnapshot(q, async (snapshot) => {
        const $chatMessages = $("#chat-messages").empty();
        const nicknamePromises = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            nicknamePromises.push(getNicknameByUid(data.userUid));
        });

        await Promise.all(nicknamePromises);

        if (snapshot.empty) {
            $chatMessages.append("<p class='text-center text-muted'>Henüz mesaj yok.</p>");
            return;
        }

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const { nickname: displayUser, color: userColor } = await getNicknameByUid(data.userUid);
            const messageEl = `
                <div class="message-item">
                    <strong style="color: ${userColor};">${displayUser}</strong> <small class="text-muted">${formatDateTime(data.createdAt)}</small><br/>
                    ${data.text}
                </div>
            `;
            $chatMessages.append(messageEl);
        }

        $chatMessages.scrollTop($chatMessages[0].scrollHeight);
    });
}

// Uygulama başlangıcı
$(function () {
onAuthStateChanged(auth, async (user) => {
    console.log("Gizli Oda: onAuthStateChanged tetiklendi. user:", user ? user.uid : "null");

    if (user) {
        currentUserUid = user.uid;
        console.log("Gizli Oda: Kullanıcı oturumda:", currentUserUid);
        
        const userDocRef = doc(db, "users", currentUserUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            currentUserNickname = userData.nickname;
            currentUserColor = userData.color || generateRandomColor();
            if (!userData.color) {
                await updateDoc(userDocRef, { color: currentUserColor });
            }
            console.log("Gizli Oda: Kullanıcı profili bulundu:", currentUserNickname);
            $("#secret-room-app").show(); // Gizli oda uygulamasını göster
            loadSecretMessages(); // Gizli oda mesajlarını yükle
        } else {
            // Kullanıcı Auth'ta var ama Firestore'da profili yok (Nick girmediği durum)
            console.warn("Gizli Oda: Kullanıcının Firestore profili eksik. Ana sayfaya yönlendiriliyor.");
            alert("Giriş yapmanız gerekiyor. Lütfen ana sayfadan nick girerek giriş yapın.");
            window.location.href = "index.html"; // Ana sayfaya geri yönlendir
        }
        $("#current-user-info").text(`Giriş yapıldı: ${currentUserNickname} (UID: ${currentUserUid})`);
    } else {
    // Kullanıcı oturumda değil, anonim olarak giriş yapmayı dene
    console.log("Gizli Oda: Kullanıcı oturumda değil. Anonim giriş deneniyor...");
    try {
        const userCredential = await signInAnonymously(auth);
        const newUser = userCredential.user;
        currentUserUid = newUser.uid;
        
        // ÖNEMLİ: Auth objesinin güncellenmesini bekle (genellikle gereksizdir ama hata devam ediyorsa deneyebiliriz)
        // await new Promise(resolve => {
        //     const unsubscribe = onAuthStateChanged(auth, u => {
        //         if (u && u.uid === newUser.uid) {
        //             unsubscribe(); // Dinleyiciyi hemen kaldır
        //             resolve();
        //         }
        //     });
        // });
        // Yukarıdaki kısım genellikle gereksizdir çünkü signInAnonymously zaten await'li.

        currentUserNickname = "Anonim_" + Math.random().toString(36).substring(2, 7);
        currentUserColor = generateRandomColor();
        
        // Yeni anonim kullanıcı için Firestore'da profil oluştur
        // Burada Missing permissions hatası alıyorsan, kullanıcı UID'sinin henüz atanmamış
        // veya kurallara göre yetkisiz bir yazma girişimi olabilir.
        // Ama kuralların doğru görünüyor.
        await setDoc(doc(db, "users", currentUserUid), {
            nickname: currentUserNickname,
            color: currentUserColor,
            createdAt: serverTimestamp()
        });

        console.log("Gizli Oda: Anonim giriş başarılı ve profil oluşturuldu.", currentUserUid, currentUserNickname);
        $("#current-user-info").text(`Giriş yapıldı: ${currentUserNickname} (UID: ${currentUserUid})`);
        $("#secret-room-app").show(); // Gizli oda uygulamasını göster
        loadSecretMessages(); // Gizli oda mesajlarını yükle

    } catch (error) {
        console.error("Gizli Oda: Anonim giriş hatası:", error);
        alert("Gizli odaya giriş yapılırken bir hata oluştu: " + error.message + ". Lütfen ana sayfadan tekrar deneyin.");
        window.location.href = "index.html"; // Hata durumunda ana sayfaya yönlendir
    }
}
});

    // Event Listeners
    $("#send-secret-message-btn").on("click", sendSecretMessage);
    $("#secret-message-input").on("keypress", function (e) {
        if (e.which == 13) {
            sendSecretMessage();
        }
    });

    $("#back-to-main-btn").on("click", () => {
        window.location.href = "index.html";
    });
});
