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
                requests: [],
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
    
    // بررسی اینکه کاربر هنوز در Firebase احراز هویت شده
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
// 🏠 لابی
// ==========================================
async function createLobby() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const lobbyId = generateId();
    const lobby = {
        id: lobbyId,
        code: generateLobbyCode(),
        players: [
            {
                id: currentUser.id,
                name: currentUser.name,
                ready: false,
                finished: false,
                words: {}
            }
        ],
        chat: [],
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

    if (lobby.players.length >= 2) throw new Error('لابی پر است');

    if (lobby.players.find(p => p.id === currentUser.id)) {
        return lobby;
    }

    lobby.players.push({
        id: currentUser.id,
        name: currentUser.name,
        ready: false,
        finished: false,
        words: {}
    });

    await db.ref('lobbies/' + lobbyId).update({
        players: lobby.players
    });

    return lobby;
}

async function getLobby(lobbyId) {
    const snapshot = await db.ref('lobbies/' + lobbyId).once('value');
    return snapshot.val();
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
// 🎮 بازی
// ==========================================
async function startGame(lobbyId) {
    const lobby = await getLobby(lobbyId);
    if (!lobby) throw new Error('لابی پیدا نشد');

    const letters = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
    const letter = letters[Math.floor(Math.random() * letters.length)];

    const gameId = generateId();
    const game = {
        id: gameId,
        lobbyId: lobbyId,
        letter: letter,
        players: lobby.players.map(p => ({
            id: p.id,
            name: p.name,
            words: {},
            finished: false,
            finalScore: 0,
            ready: false
        })),
        startTime: Date.now(),
        duration: 120000,
        status: 'playing'
    };

    await db.ref('games/' + gameId).set(game);
    await db.ref('lobbies/' + lobbyId + '/gameId').set(gameId);
    await db.ref('lobbies/' + lobbyId + '/status').set('playing');

    return game;
}

async function getGame(gameId) {
    const snapshot = await db.ref('games/' + gameId).once('value');
    return snapshot.val();
}

async function saveWord(gameId, field, value) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');

    const playerIndex = game.players.findIndex(p => p.id === currentUser.id);
    if (playerIndex === -1) throw new Error('شما در این بازی نیستید');

    game.players[playerIndex].words[field] = value;

    await db.ref('games/' + gameId + '/players').set(game.players);
}

async function finishGame(gameId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('لطفا ابتدا وارد شوید');

    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');

    const playerIndex = game.players.findIndex(p => p.id === currentUser.id);
    if (playerIndex === -1) throw new Error('شما در این بازی نیستید');

    game.players[playerIndex].finished = true;

    const score = calculateScore(game.players[playerIndex], game.letter);
    game.players[playerIndex].finalScore = score;

    await db.ref('games/' + gameId + '/players').set(game.players);

    const allFinished = game.players.every(p => p.finished);
    if (allFinished) {
        game.status = 'finished';
        for (const player of game.players) {
            await db.ref('users/' + player.id + '/score').transaction((current) => {
                return (current || 0) + player.finalScore;
            });
        }
        await db.ref('games/' + gameId + '/status').set('finished');
    }

    return game;
}

function calculateScore(player, letter) {
    let score = 0;
    const fields = ['name', 'family', 'city', 'country', 'food', 'object'];
    for (const field of fields) {
        const word = player.words[field] || '';
        if (word && word.trim().length > 0) {
            if (word.trim()[0] === letter) {
                score += 10;
            } else {
                score += 5;
            }
        }
    }
    return score;
}

// ==========================================
// 📡 Polling (لحظه‌ای با onValue)
// ==========================================
function pollLobby(lobbyId, callback) {
    const ref = db.ref('lobbies/' + lobbyId);
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data);
        } else {
            // اگر لابی وجود نداشت
            callback(null);
        }
    });
    return ref; // برگرداندن ref برای unsubscribe
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

// ==========================================
// 🧹 Cleanup
// ==========================================
function stopPolling(ref) {
    if (ref) {
        ref.off();
    } else {
        db.ref().off();
    }
}
