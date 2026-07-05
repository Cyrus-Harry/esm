// ==========================================
// 🔥 تنظیمات Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAw5aIKg_mXeoKmGOl2mFpI074eSaonHmc",
    authDomain: "esm-famil-59c9d.firebaseapp.com",
    databaseURL: "https://esm-famil-59c9d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "esm-famil-59c9d",
    storageBucket: "esm-famil-59c9d.firebasestorage.app",
    messagingSenderId: "123286091020",
    appId: "1:123286091020:web:3a05708c2515c4b3be8529",
    measurementId: "G-08WCQS7GZ7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ==========================================
// 🛠 توابع کمکی
// ==========================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function generateLobbyCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ==========================================
// 👤 مدیریت کاربران
// ==========================================
async function login(name) {
    try {
        await auth.signInAnonymously();
        const uid = auth.currentUser.uid;

        const snapshot = await db.ref('users/' + uid).once('value');
        if (!snapshot.exists()) {
            const newUser = {
                id: uid,
                name: name,
                score: 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref('users/' + uid).set(newUser);
            localStorage.setItem('userId', uid);
            return newUser;
        } else {
            const userData = snapshot.val();
            userData.name = name;
            await db.ref('users/' + uid + '/name').set(name);
            localStorage.setItem('userId', uid);
            return userData;
        }
    } catch (error) {
        throw new Error('خطا در ورود: ' + error.message);
    }
}

async function getCurrentUser() {
    const userId = localStorage.getItem('userId');
    if (!userId) return null;
    if (!auth.currentUser) {
        try {
            await auth.signInAnonymously();
        } catch (e) {
            return null;
        }
    }
    try {
        const snapshot = await db.ref('users/' + userId).once('value');
        return snapshot.val();
    } catch (e) {
        return null;
    }
}

// ==========================================
// 📨 درخواست بازی
// ==========================================
async function sendGameRequest(toName) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const usersSnapshot = await db.ref('users').orderByChild('name').equalTo(toName).once('value');
    const users = usersSnapshot.val();
    if (!users) throw new Error('کاربری با این نام پیدا نشد');

    const targetId = Object.keys(users)[0];
    if (targetId === currentUser.id) throw new Error('نمیتوانید به خودتان درخواست دهید');

    const request = {
        from: currentUser.id,
        fromName: currentUser.name,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref('users/' + targetId + '/requests').push(request);
    return true;
}

// ==========================================
// 🏠 لابی (بدون محدودیت تعداد)
// ==========================================
async function createLobby() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const lobbyId = generateId();
    const lobby = {
        id: lobbyId,
        code: generateLobbyCode(),
        createdBy: currentUser.id,
        players: {
            [currentUser.id]: {
                name: currentUser.name,
                ready: false,
                inGame: false
            }
        },
        chat: [],
        gameType: null,
        gameId: null,
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref('lobbies/' + lobbyId).set(lobby);
    return lobby;
}

async function joinLobby(code) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const snapshot = await db.ref('lobbies').orderByChild('code').equalTo(code.toUpperCase()).once('value');
    const lobbies = snapshot.val();
    if (!lobbies) throw new Error('لابی با این کد پیدا نشد');

    const lobbyId = Object.keys(lobbies)[0];
    const lobby = lobbies[lobbyId];

    if (lobby.players && lobby.players[currentUser.id]) {
        return lobby;
    }

    lobby.players[currentUser.id] = {
        name: currentUser.name,
        ready: false,
        inGame: false
    };

    await db.ref('lobbies/' + lobbyId + '/players').set(lobby.players);
    return lobby;
}

async function getLobby(lobbyId) {
    const snapshot = await db.ref('lobbies/' + lobbyId).once('value');
    return snapshot.val();
}

async function setGameType(lobbyId, gameType) {
    await db.ref('lobbies/' + lobbyId + '/gameType').set(gameType);
}

// ==========================================
// 💬 چت
// ==========================================
async function sendChat(lobbyId, msg) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const chatMsg = {
        userId: currentUser.id,
        userName: currentUser.name,
        msg: msg,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref('lobbies/' + lobbyId + '/chat').push(chatMsg);
}

// ==========================================
// 🎮 شروع بازی (بر اساس نوع)
// ==========================================
async function startGame(lobbyId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const lobby = await getLobby(lobbyId);
    if (!lobby) throw new Error('لابی پیدا نشد');
    if (lobby.status === 'playing') throw new Error('بازی در حال اجراست');

    const gameType = lobby.gameType;
    if (!gameType) throw new Error('نوع بازی انتخاب نشده');

    const readyPlayers = Object.keys(lobby.players).filter(uid => lobby.players[uid].ready);
    if (readyPlayers.length < 2 && gameType === 'esm-famil') {
        throw new Error('برای اسم فامیل حداقل ۲ نفر باید آماده باشند');
    }
    if (readyPlayers.length < 1 && gameType === 'hokm') {
        throw new Error('برای حکم حداقل ۱ نفر باید آماده باشد');
    }

    const gameId = generateId();
    const gameData = {
        id: gameId,
        lobbyId: lobbyId,
        type: gameType,
        status: 'playing',
        startTime: Date.now(),
        duration: 120000,
        round: 1,
        players: {}
    };

    for (const uid of readyPlayers) {
        gameData.players[uid] = {
            name: lobby.players[uid].name,
            finished: false,
            words: {},
            roundScore: 0,
            totalScore: 0
        };
    }

    if (gameType === 'hokm') {
        const botNames = ['بات ۱', 'بات ۲', 'بات ۳'];
        let botCount = 0;
        while (Object.keys(gameData.players).length < 4) {
            const botId = 'bot_' + generateId();
            gameData.players[botId] = {
                name: botNames[botCount % botNames.length] + (botCount >= botNames.length ? ' ' + Math.floor(botCount/botNames.length) : ''),
                finished: false,
                words: {},
                roundScore: 0,
                totalScore: 0,
                isBot: true
            };
            botCount++;
        }
    }

    if (gameType === 'esm-famil') {
        const letters = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
        gameData.letter = letters[Math.floor(Math.random() * letters.length)];
    }

    await db.ref('games/' + gameId).set(gameData);

    await db.ref('lobbies/' + lobbyId + '/gameId').set(gameId);
    await db.ref('lobbies/' + lobbyId + '/status').set('playing');
    for (const uid of readyPlayers) {
        await db.ref('lobbies/' + lobbyId + '/players/' + uid + '/inGame').set(true);
    }

    return gameData;
}

// ==========================================
// 📡 دریافت بازی
// ==========================================
async function getGame(gameId) {
    const snapshot = await db.ref('games/' + gameId).once('value');
    return snapshot.val();
}

// ==========================================
// 🎯 توابع مخصوص اسم فامیل
// ==========================================
async function saveWord(gameId, field, value) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'playing') throw new Error('بازی تمام شده');

    const player = game.players[currentUser.id];
    if (!player) throw new Error('شما در این بازی نیستید');
    if (player.finished) throw new Error('شما بازی را تمام کرده‌اید');

    await db.ref('games/' + gameId + '/players/' + currentUser.id + '/words/' + field).set(value);
}

async function finishGame(gameId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'playing') throw new Error('بازی تمام شده');
    if (game.type !== 'esm-famil') throw new Error('این تابع فقط برای اسم فامیل است');

    await db.ref('games/' + gameId + '/status').set('finished');
    const updates = {};
    for (const uid of Object.keys(game.players)) {
        updates['games/' + gameId + '/players/' + uid + '/finished'] = true;
    }
    await db.ref().update(updates);

    const lobbyId = game.lobbyId;
    await db.ref('lobbies/' + lobbyId + '/status').set('finished');
}

async function nextRound(gameId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.type !== 'esm-famil') throw new Error('این تابع فقط برای اسم فامیل است');

    const letters = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
    const newLetter = letters[Math.floor(Math.random() * letters.length)];

    const updates = {};
    for (const uid of Object.keys(game.players)) {
        updates['games/' + gameId + '/players/' + uid + '/finished'] = false;
        updates['games/' + gameId + '/players/' + uid + '/words'] = {};
        updates['games/' + gameId + '/players/' + uid + '/roundScore'] = 0;
    }
    updates['games/' + gameId + '/letter'] = newLetter;
    updates['games/' + gameId + '/status'] = 'playing';
    updates['games/' + gameId + '/startTime'] = Date.now();
    updates['games/' + gameId + '/round'] = (game.round || 1) + 1;

    await db.ref().update(updates);

    const lobbyId = game.lobbyId;
    await db.ref('lobbies/' + lobbyId + '/status').set('playing');
}

async function setRoundScore(gameId, uid, score) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');
    if (currentUser.id !== uid) throw new Error('شما فقط می‌توانید امتیاز خود را تغییر دهید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'finished') throw new Error('بازی تمام نشده است');

    const player = game.players[uid];
    if (!player) throw new Error('بازیکن پیدا نشد');
    const newTotal = (player.totalScore || 0) + score;
    await db.ref('games/' + gameId + '/players/' + uid + '/roundScore').set(score);
    await db.ref('games/' + gameId + '/players/' + uid + '/totalScore').set(newTotal);
}

// ==========================================
// 📡 Polling
// ==========================================
function pollLobby(lobbyId, callback) {
    const ref = db.ref('lobbies/' + lobbyId);
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data);
        } else {
            callback(null);
        }
    });
    return ref;
}

function pollGame(gameId, callback) {
    const ref = db.ref('games/' + gameId);
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data);
        } else {
            callback(null);
        }
    });
    return ref;
}

function pollRequests(callback) {
    const userId = localStorage.getItem('userId');
    if (!userId) return null;
    const ref = db.ref('users/' + userId + '/requests');
    ref.on('value', (snapshot) => {
        const requests = snapshot.val();
        callback(requests || {});
    });
    return ref;
}

function stopPolling(ref) {
    if (ref) {
        ref.off();
    } else {
        db.ref().off();
    }
}
