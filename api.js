// api.js
const API_URL = 'https://api.jsonbin.io/v3/b';
const KEY = '$2a$10$/5vpvMhVYT3akahPv1wWUOWQmg1ZunHHB2MAf.4QIPDRRrcpKwFRy';

// 3 تا Bin باید بسازی
const BINS = {
  users: '6a490fd7da38895dfe2d424c', // { users: [{id, name, score, online}] }
  lobbies: '6a491004da38895dfe2d42d4', // { lobbies: [{id, code, players, chat, gameId}] }
  games: '6a491026f5f4af5e295ed4b8' // { games: [{id, players, letter, words, status, startTime}] }
};

async function apiCall(bin, method = 'GET', data = null) {
  const url = `${API_URL}/${BINS[bin]}${method === 'GET'? '/latest' : ''}`;
  const opts = {
    method: method === 'GET'? 'GET' : 'PUT',
    headers: {
      'X-Master-Key': KEY,
      'Content-Type': 'application/json',
      'X-Bin-Meta': 'false'
    }
  };
  if (data) opts.body = JSON.stringify(data);

  const res = await fetch(url, opts);
  return await res.json();
}

// ثبت نام / ورود
async function login(name) {
  let data = await apiCall('users');
  if (!data.users) data = { users: [] };

  let user = data.users.find(u => u.name === name);
  if (!user) {
    user = {
      id: 'u' + Date.now(),
      name: name,
      score: 0,
      online: true,
      requests: []
    };
    data.users.push(user);
  } else {
    user.online = true;
  }

  await apiCall('users', 'PUT', data);
  localStorage.setItem('userId', user.id);
  localStorage.setItem('userName', user.name);
  return user;
}

// گرفتن کاربر فعلی
async function getCurrentUser() {
  const userId = localStorage.getItem('userId');
  if (!userId) return null;
  const data = await apiCall('users');
  return data.users.find(u => u.id === userId);
}

// ارسال درخواست بازی
async function sendGameRequest(toUserName) {
  const me = await getCurrentUser();
  const data = await apiCall('users');
  const target = data.users.find(u => u.name === toUserName);

  if (!target) throw new Error('کاربر پیدا نشد');
  if (!target.requests) target.requests = [];

  target.requests.push({
    from: me.id,
    fromName: me.name,
    time: Date.now()
  });

  await apiCall('users', 'PUT', data);
  return true;
}

// ساخت لابی
async function createLobby() {
  const me = await getCurrentUser();
  const data = await apiCall('lobbies');
  if (!data.lobbies) data.lobbies = [];

  const lobby = {
    id: 'l' + Date.now(),
    code: Math.random().toString(36).substr(2, 6).toUpperCase(),
    host: me.id,
    players: [{ id: me.id, name: me.name, ready: false }],
    chat: [],
    gameId: null,
    created: Date.now()
  };

  data.lobbies.push(lobby);
  await apiCall('lobbies', 'PUT', data);
  return lobby;
}

// جوین لابی با کد
async function joinLobby(code) {
  const me = await getCurrentUser();
  const data = await apiCall('lobbies');
  const lobby = data.lobbies.find(l => l.code === code);

  if (!lobby) throw new Error('لابی پیدا نشد');
  if (lobby.players.length >= 2) throw new Error('لابی پره');
  if (lobby.players.find(p => p.id === me.id)) return lobby;

  lobby.players.push({ id: me.id, name: me.name, ready: false });
  await apiCall('lobbies', 'PUT', data);
  return lobby;
}

// ارسال چت
async function sendChat(lobbyId, msg) {
  const me = await getCurrentUser();
  const data = await apiCall('lobbies');
  const lobby = data.lobbies.find(l => l.id === lobbyId);

  lobby.chat.push({
    userId: me.id,
    userName: me.name,
    msg: msg,
    time: Date.now()
  });

  await apiCall('lobbies', 'PUT', data);
}

// شروع بازی
async function startGame(lobbyId) {
  const lobbyData = await apiCall('lobbies');
  const lobby = lobbyData.lobbies.find(l => l.id === lobbyId);

  const gameData = await apiCall('games');
  if (!gameData.games) gameData.games = [];

  const letters = 'آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
  const letter = letters[Math.floor(Math.random() * letters.length)];

  const game = {
    id: 'g' + Date.now(),
    lobbyId: lobbyId,
    letter: letter,
    players: lobby.players.map(p => ({
      id: p.id,
      name: p.name,
      words: { name: '', family: '', city: '', country: '', food: '', object: '' },
      finished: false,
      finishTime: null
    })),
    status: 'playing',
    startTime: Date.now(),
    duration: 120000 // 2 دقیقه
  };

  gameData.games.push(game);
  lobby.gameId = game.id;

  await apiCall('games', 'PUT', gameData);
  await apiCall('lobbies', 'PUT', lobbyData);
  return game;
}

// ذخیره خودکار کلمه
async function saveWord(gameId, field, value) {
  const me = await getCurrentUser();
  const data = await apiCall('games');
  const game = data.games.find(g => g.id === gameId);
  const player = game.players.find(p => p.id === me.id);

  if (player &&!player.finished) {
    player.words[field] = value;
    await apiCall('games', 'PUT', data);
  }
}

// تمام کردن بازی
async function finishGame(gameId) {
  const me = await getCurrentUser();
  const data = await apiCall('games');
  const game = data.games.find(g => g.id === gameId);
  const player = game.players.find(p => p.id === me.id);

  player.finished = true;
  player.finishTime = Date.now();

  // اگه هر دو تموم کردن، امتیاز بده
  if (game.players.every(p => p.finished)) {
    game.status = 'finished';
    await calculateScore(game);
  }

  await apiCall('games', 'PUT', data);
  return game;
}

// محاسبه امتیاز
async function calculateScore(game) {
  const userData = await apiCall('users');

  game.players.forEach(player => {
    let score = 0;
    const fields = ['name', 'family', 'city', 'country', 'food', 'object'];

    fields.forEach(field => {
      const word = player.words[field].trim();
      if (word && word[0] === game.letter) {
        score += 10; // هر کلمه درست 10 امتیاز
      }
    });

    const user = userData.users.find(u => u.id === player.id);
    if (user) user.score += score;
    player.finalScore = score;
  });

  await apiCall('users', 'PUT', userData);
}

// Polling برای آپدیت
async function pollLobby(lobbyId, callback) {
  setInterval(async () => {
    const data = await apiCall('lobbies');
    const lobby = data.lobbies.find(l => l.id === lobbyId);
    if (lobby) callback(lobby);
  }, 2000);
}

async function pollGame(gameId, callback) {
  setInterval(async () => {
    const data = await apiCall('games');
    const game = data.games.find(g => g.id === gameId);
    if (game) callback(game);
  }, 1000);
}
