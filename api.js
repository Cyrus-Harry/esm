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

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
    if (readyPlayers.length < 1 && (gameType === 'hokm' || gameType === 'manche')) {
        throw new Error('برای این بازی حداقل ۱ نفر باید آماده باشد');
    }
    const gameId = generateId();
    const gameData = {
        id: gameId,
        lobbyId: lobbyId,
        type: gameType,
        status: (gameType === 'manche') ? 'color_select' : 'playing',
        startTime: Date.now(),
        duration: gameType === 'esm-famil' ? 120000 : 0,
        round: 1,
        players: {}
    };
    for (const uid of readyPlayers) {
        gameData.players[uid] = {
            name: lobby.players[uid].name,
            finished: false,
            words: {},
            roundScore: 0,
            totalScore: 0,
            isBot: false
        };
    }
    if (gameType === 'esm-famil') {
        const letters = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
        gameData.letter = letters[Math.floor(Math.random() * letters.length)];
    } else if (gameType === 'hokm') {
        const botNames = ['بات ۱', 'بات ۲', 'بات ۳'];
        let botCount = 0;
        while (Object.keys(gameData.players).length < 4) {
            const botId = 'bot_' + generateId();
            gameData.players[botId] = {
                name: botNames[botCount % botNames.length] + (botCount >= botNames.length ? ' ' + Math.floor(botCount/botNames.length) : ''),
                isBot: true,
                totalScore: 0
            };
            botCount++;
        }
        gameData.cards = {};
        gameData.played = {};
        gameData.currentTurn = null;
        gameData.lastWinner = null;
    } else if (gameType === 'manche') {
        // اضافه کردن بات‌ها تا ۴ نفر
        const botNames = ['بات قرمز', 'بات آبی', 'بات سبز', 'بات زرد'];
        let botCount = 0;
        while (Object.keys(gameData.players).length < 4) {
            const botId = 'bot_' + generateId();
            gameData.players[botId] = {
                name: botNames[botCount % botNames.length],
                isBot: true,
                finished: false,
                totalScore: 0,
                tokens: [0, 0, 0, 0],
                homeCount: 0
            };
            botCount++;
        }
        // رنگ‌ها و انتخاب رنگ
        const colorMap = {};
        const playerIds = Object.keys(gameData.players);
        playerIds.forEach(uid => {
            colorMap[uid] = { selected: false, colorIndex: -1 };
        });
        gameData.colorMap = colorMap;
        gameData.colorSelectionEnd = Date.now() + 7000;
        gameData.currentTurn = null;
        gameData.dice = 0;
        gameData.phase = 'roll';
        gameData.winner = null;
        gameData.boardPath = generateManchePath();
        gameData.turnOrder = [];
        for (const uid of Object.keys(gameData.players)) {
            gameData.players[uid].tokens = [0, 0, 0, 0];
            gameData.players[uid].homeCount = 0;
        }
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
// 🎲 تابع تولید مسیر استاندارد منچ
// ==========================================
function generateManchePath() {
    const path = [];
    // ضلع بالایی (از چپ به راست)
    for (let c = 1; c <= 6; c++) path.push({ r: 6, c: c });
    // سمت راست (از بالا به پایین)
    for (let r = 5; r >= 1; r--) path.push({ r: r, c: 6 });
    for (let r = 7; r <= 13; r++) path.push({ r: r, c: 6 });
    // ضلع پایینی (از راست به چپ)
    for (let c = 7; c <= 13; c++) path.push({ r: 13, c: c });
    // سمت چپ (از پایین به بالا)
    for (let r = 12; r >= 8; r--) path.push({ r: r, c: 13 });
    for (let r = 6; r >= 0; r--) path.push({ r: r, c: 13 });
    // ضلع بالایی (ادامه)
    for (let c = 12; c >= 8; c--) path.push({ r: 0, c: c });
    // سمت چپ (ادامه)
    for (let r = 1; r <= 5; r++) path.push({ r: r, c: 7 });
    for (let r = 7; r <= 12; r++) path.push({ r: r, c: 7 });
    // ضلع پایینی (ادامه - بازگشت به خانه شروع)
    for (let c = 6; c >= 1; c--) path.push({ r: 6, c: c });
    return path;
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
// 🃏 توابع مخصوص بازی حکم (Hokm)
// ==========================================
async function initHokmGame(gameId) {
    const game = await getGame(gameId);
    if (!game || game.type !== 'hokm') return;
    if (game.cards && Object.keys(game.cards).length > 0) return;
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let deck = [];
    for (let s of suits) for (let r of ranks) deck.push(r+s);
    shuffle(deck);
    const playerIds = Object.keys(game.players);
    const cardsPerPlayer = 5;
    const cards = {};
    let idx = 0;
    for (let uid of playerIds) {
        cards[uid] = deck.slice(idx, idx+cardsPerPlayer);
        idx += cardsPerPlayer;
    }
    const updates = {
        'cards': cards,
        'remaining': deck.slice(idx),
        'currentTurn': playerIds[0],
        'played': {},
        'lastWinner': null
    };
    await db.ref('games/' + gameId).update(updates);
}

async function playHokmCard(gameId, uid, card) {
    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'playing') throw new Error('بازی تمام شده');
    if (game.currentTurn !== uid) throw new Error('نوبت شما نیست');
    const hand = game.cards[uid];
    if (!hand) throw new Error('دست شما پیدا نشد');
    const index = hand.indexOf(card);
    if (index === -1) throw new Error('کارت در دست شما نیست');
    hand.splice(index, 1);
    const played = game.played || {};
    played[uid] = card;
    await db.ref('games/' + gameId + '/cards/' + uid).set(hand);
    await db.ref('games/' + gameId + '/played').set(played);
    const playerIds = Object.keys(game.players);
    const currentIdx = playerIds.indexOf(uid);
    let nextIdx = (currentIdx + 1) % playerIds.length;
    let nextPlayer = playerIds[nextIdx];
    if (Object.keys(played).length === playerIds.length) {
        let winner = null;
        let maxRank = -1;
        const rankOrder = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
        for (const [pid, cardStr] of Object.entries(played)) {
            const rank = rankOrder[cardStr.slice(0, -1)] || 0;
            if (rank > maxRank) {
                maxRank = rank;
                winner = pid;
            }
        }
        const winnerScore = (game.players[winner]?.totalScore || 0) + 1;
        await db.ref('games/' + gameId + '/players/' + winner + '/totalScore').set(winnerScore);
        await db.ref('games/' + gameId + '/played').set({});
        await db.ref('games/' + gameId + '/lastWinner').set(winner);
        let allEmpty = true;
        for (const pid of playerIds) {
            const h = (await db.ref('games/' + gameId + '/cards/' + pid).once('value')).val() || [];
            if (h.length > 0) allEmpty = false;
        }
        if (allEmpty) {
            await db.ref('games/' + gameId + '/status').set('finished');
        } else {
            const winnerIdx = playerIds.indexOf(winner);
            nextIdx = (winnerIdx + 1) % playerIds.length;
            nextPlayer = playerIds[nextIdx];
            await db.ref('games/' + gameId + '/currentTurn').set(nextPlayer);
        }
    } else {
        let found = false;
        for (let i = 0; i < playerIds.length; i++) {
            const idx = (currentIdx + 1 + i) % playerIds.length;
            const pid = playerIds[idx];
            const h = (await db.ref('games/' + gameId + '/cards/' + pid).once('value')).val() || [];
            if (h.length > 0) {
                await db.ref('games/' + gameId + '/currentTurn').set(pid);
                found = true;
                break;
            }
        }
        if (!found) {
            await db.ref('games/' + gameId + '/status').set('finished');
        }
    }
}

// ==========================================
// 🎲 توابع مخصوص بازی منچ (Manche) - نسخه استاندارد کامل
// ==========================================

// انتخاب رنگ توسط بازیکن
async function selectMancheColor(gameId, uid, colorIndex) {
    const game = await getGame(gameId);
    if (!game || game.status !== 'color_select') throw new Error('زمان انتخاب رنگ تمام شده');
    const colorMap = game.colorMap;
    for (const [key, val] of Object.entries(colorMap)) {
        if (val.colorIndex === colorIndex && key !== uid) {
            throw new Error('این رنگ قبلاً انتخاب شده است');
        }
    }
    colorMap[uid] = { selected: true, colorIndex: colorIndex };
    await db.ref('games/' + gameId + '/colorMap/' + uid).set(colorMap[uid]);
    const allSelected = Object.values(colorMap).every(v => v.selected === true);
    if (allSelected) {
        await finalizeMancheColors(gameId);
    }
}

// نهایی‌سازی انتخاب رنگ‌ها
async function finalizeMancheColors(gameId) {
    const game = await getGame(gameId);
    if (!game || game.status !== 'color_select') return;
    const colorMap = game.colorMap;
    const playerIds = Object.keys(game.players);
    const availableColors = [0, 1, 2, 3];
    const taken = [];
    for (const [uid, val] of Object.entries(colorMap)) {
        if (val.selected) taken.push(val.colorIndex);
    }
    const available = availableColors.filter(c => !taken.includes(c));
    for (const uid of playerIds) {
        if (!colorMap[uid] || !colorMap[uid].selected) {
            const randIdx = Math.floor(Math.random() * available.length);
            const colorIdx = available.splice(randIdx, 1)[0];
            colorMap[uid] = { selected: true, colorIndex: colorIdx };
            await db.ref('games/' + gameId + '/colorMap/' + uid).set(colorMap[uid]);
        }
    }
    const order = playerIds.sort((a, b) => colorMap[a].colorIndex - colorMap[b].colorIndex);
    await db.ref('games/' + gameId + '/turnOrder').set(order);
    await db.ref('games/' + gameId + '/currentTurn').set(order[0]);
    await db.ref('games/' + gameId + '/status').set('playing');
    await db.ref('games/' + gameId + '/phase').set('roll');
}

// تاس انداختن
async function rollDice(gameId, uid) {
    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'playing') throw new Error('بازی تمام شده');
    if (game.currentTurn !== uid) throw new Error('نوبت شما نیست');
    if (game.phase !== 'roll') throw new Error('اکنون زمان تاس انداختن نیست');
    const dice = Math.floor(Math.random() * 6) + 1;
    await db.ref('games/' + gameId + '/dice').set(dice);
    await db.ref('games/' + gameId + '/phase').set('move');
    return dice;
}

// حرکت مهره (نسخه استاندارد کامل)
async function moveMancheToken(gameId, uid, tokenIndex) {
    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (game.status !== 'playing') throw new Error('بازی تمام شده');
    if (game.currentTurn !== uid) throw new Error('نوبت شما نیست');
    if (game.phase !== 'move') throw new Error('اکنون زمان حرکت نیست');

    const player = game.players[uid];
    const dice = game.dice;
    const colorIdx = game.colorMap[uid].colorIndex;
    const colorNames = ['red', 'green', 'yellow', 'blue'];
    const colorName = colorNames[colorIdx];
    const boardPath = game.boardPath;
    const pathLength = boardPath.length; // 52

    let tokenPos = player.tokens[tokenIndex];
    const isSix = (dice === 6);

    // --- حالت 1: مهره در خانه است (0) و عدد 6 آمد ---
    if (tokenPos === 0 && isSix) {
        const startPos = colorIdx * 13 + 1; // 1, 14, 27, 40
        player.tokens[tokenIndex] = startPos;
        await db.ref('games/' + gameId + '/players/' + uid + '/tokens').set(player.tokens);
        await db.ref('games/' + gameId + '/phase').set('roll');
        await nextTurn(gameId, uid, true);
        return;
    }

    // --- حالت 2: مهره در مسیر اصلی یا ستون رنگی است ---
    if (tokenPos > 0 && tokenPos <= 57) {
        let newPos = tokenPos + dice;

        // --- بخش 2-1: حرکت در مسیر اصلی (1 تا 52) ---
        if (tokenPos <= pathLength) {
            // اگر از مسیر اصلی خارج شد، وارد ستون رنگی می‌شود
            if (newPos > pathLength) {
                let colPos = newPos - pathLength; // 1 تا 6
                if (colPos > 6) {
                    throw new Error('عدد تاس برای ورود به خانه دقیق نیست');
                }
                player.tokens[tokenIndex] = 52 + colPos;
                if (colPos === 6) {
                    player.homeCount = (player.homeCount || 0) + 1;
                    player.tokens[tokenIndex] = 0;
                    await db.ref('games/' + gameId + '/players/' + uid + '/homeCount').set(player.homeCount);
                    if (player.homeCount >= 4) {
                        await db.ref('games/' + gameId + '/winner').set(uid);
                        await db.ref('games/' + gameId + '/status').set('finished');
                        return;
                    }
                }
                await db.ref('games/' + gameId + '/players/' + uid + '/tokens').set(player.tokens);
                await db.ref('games/' + gameId + '/phase').set('roll');
                await nextTurn(gameId, uid, isSix);
                return;
            }

            // --- حرکت عادی در مسیر اصلی ---
            // بررسی خانه امن (مضرب 7)
            const isSafe = (newPos % 7 === 0);
            if (!isSafe) {
                // ضربه زدن به حریف
                for (const [otherUid, otherPlayer] of Object.entries(game.players)) {
                    if (otherUid === uid) continue;
                    const otherTokens = otherPlayer.tokens;
                    for (let i = 0; i < otherTokens.length; i++) {
                        if (otherTokens[i] === newPos && otherTokens[i] > 0 && otherTokens[i] <= pathLength) {
                            otherPlayer.tokens[i] = 0;
                            await db.ref('games/' + gameId + '/players/' + otherUid + '/tokens').set(otherPlayer.tokens);
                            break;
                        }
                    }
                }
            }
            player.tokens[tokenIndex] = newPos;
            await db.ref('games/' + gameId + '/players/' + uid + '/tokens').set(player.tokens);
            await db.ref('games/' + gameId + '/phase').set('roll');
            await nextTurn(gameId, uid, isSix);
            return;
        }

        // --- بخش 2-2: حرکت در ستون رنگی (53 تا 57) ---
        else if (tokenPos > pathLength && tokenPos < 58) {
            let colPos = tokenPos - pathLength; // 1 تا 5
            let newColPos = colPos + dice;
            if (newColPos > 6) {
                throw new Error('عدد تاس برای ورود به خانه دقیق نیست');
            }
            player.tokens[tokenIndex] = 52 + newColPos;
            if (newColPos === 6) {
                player.homeCount = (player.homeCount || 0) + 1;
                player.tokens[tokenIndex] = 0;
                await db.ref('games/' + gameId + '/players/' + uid + '/homeCount').set(player.homeCount);
                if (player.homeCount >= 4) {
                    await db.ref('games/' + gameId + '/winner').set(uid);
                    await db.ref('games/' + gameId + '/status').set('finished');
                    return;
                }
            }
            await db.ref('games/' + gameId + '/players/' + uid + '/tokens').set(player.tokens);
            await db.ref('games/' + gameId + '/phase').set('roll');
            await nextTurn(gameId, uid, isSix);
            return;
        }
    }
    throw new Error('مهره قابل حرکت نیست');
}

// چرخش نوبت
async function nextTurn(gameId, currentUid, isSix) {
    const game = await getGame(gameId);
    if (!game) return;
    if (game.status !== 'playing') return;

    const turnOrder = game.turnOrder;
    if (!turnOrder || turnOrder.length === 0) return;

    const currentIdx = turnOrder.indexOf(currentUid);
    let nextIdx = (currentIdx + 1) % turnOrder.length;

    if (isSix) {
        await db.ref('games/' + gameId + '/currentTurn').set(currentUid);
        await db.ref('games/' + gameId + '/phase').set('roll');
        return;
    }

    let attempts = 0;
    while (attempts < turnOrder.length) {
        const nextPlayer = turnOrder[nextIdx];
        if (!game.players[nextPlayer]?.finished) {
            await db.ref('games/' + gameId + '/currentTurn').set(nextPlayer);
            await db.ref('games/' + gameId + '/phase').set('roll');
            return;
        }
        nextIdx = (nextIdx + 1) % turnOrder.length;
        attempts++;
    }
    await db.ref('games/' + gameId + '/status').set('finished');
}

// اجرای نوبت بات
async function runBotTurn(gameId, botUid) {
    const game = await getGame(gameId);
    if (!game || game.status !== 'playing') return;
    if (game.currentTurn !== botUid) return;
    if (game.phase !== 'roll') return;

    const dice = Math.floor(Math.random() * 6) + 1;
    await db.ref('games/' + gameId + '/dice').set(dice);
    await db.ref('games/' + gameId + '/phase').set('move');

    const player = game.players[botUid];
    let moved = false;
    for (let i = 0; i < player.tokens.length; i++) {
        try {
            const tokenPos = player.tokens[i];
            if (tokenPos === 0 && dice !== 6) continue;
            if (tokenPos > 0 && tokenPos < 57) {
                await moveMancheToken(gameId, botUid, i);
                moved = true;
                break;
            }
        } catch (e) {
            continue;
        }
    }
    if (!moved) {
        await nextTurn(gameId, botUid, false);
    }
}

// ==========================================
// 📡 خروج از بازی
// ==========================================
async function leaveGame(gameId, uid) {
    const game = await getGame(gameId);
    if (!game) throw new Error('بازی پیدا نشد');
    if (!game.players[uid]) return;
    const lobbyId = game.lobbyId;
    await db.ref('games/' + gameId + '/players/' + uid).remove();
    await db.ref('lobbies/' + lobbyId + '/players/' + uid + '/inGame').set(false);
    const updatedGame = await getGame(gameId);
    if (updatedGame && Object.keys(updatedGame.players).length === 0) {
        await db.ref('games/' + gameId).remove();
        await db.ref('lobbies/' + lobbyId + '/gameId').remove();
        await db.ref('lobbies/' + lobbyId + '/status').set('waiting');
    } else if (updatedGame) {
        if (updatedGame.type === 'hokm' && updatedGame.currentTurn === uid) {
            const playerIds = Object.keys(updatedGame.players);
            if (playerIds.length > 0) {
                await db.ref('games/' + gameId + '/currentTurn').set(playerIds[0]);
            }
        } else if (updatedGame.type === 'manche' && updatedGame.currentTurn === uid) {
            const turnOrder = updatedGame.turnOrder || Object.keys(updatedGame.players);
            const currentIdx = turnOrder.indexOf(uid);
            let nextIdx = (currentIdx + 1) % turnOrder.length;
            let nextPlayer = turnOrder[nextIdx];
            let attempts = 0;
            while ((updatedGame.players[nextPlayer]?.finished || false) && attempts < turnOrder.length) {
                nextIdx = (nextIdx + 1) % turnOrder.length;
                nextPlayer = turnOrder[nextIdx];
                attempts++;
            }
            await db.ref('games/' + gameId + '/currentTurn').set(nextPlayer);
        }
    }
}

// ==========================================
// 📡 Polling
// ==========================================
function pollLobby(lobbyId, callback) {
    const ref = db.ref('lobbies/' + lobbyId);
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
        else callback(null);
    });
    return ref;
}

function pollGame(gameId, callback) {
    const ref = db.ref('games/' + gameId);
    ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
        else callback(null);
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
