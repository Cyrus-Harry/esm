<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>بازی با Firebase (Locked)</title>
    
    <!-- SDKهای Firebase -->
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
</head>
<body>
    <h1>🎮 تست Firebase - حالت Locked</h1>
    <div id="status">⏳ در حال اتصال...</div>
    <br>
    <button onclick="saveScore()">💾 ذخیره امتیاز</button>
    <button onclick="showScores()">📊 نمایش امتیازات</button>
    <hr>
    <div id="list"></div>

    <script>
        // ==========================================
        // 🔥 اینجا کد تنظیمات رو بچسبون
        // ==========================================
        const firebaseConfig = {
            apiKey: "AIzaSyAw5aIKg_mXeoKmGOl2mFpI074eSaonHmc", // ← عوض کن
            authDomain: "esm-famil-59c9d.firebaseapp.com",
            databaseURL: "https://esm-famil-59c9d-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "esm-famil-59c9d",
            storageBucket: "esm-famil-59c9d.firebasestorage.app",
            messagingSenderId: "123286091020",
            appId: "1:123286091020:web:3a05708c2515c4b3be8529",
            measurementId: "G-08WCQS7GZ7"
        };

        // ==========================================
        // راه‌اندازی
        // ==========================================
        firebase.initializeApp(firebaseConfig);
        const db = firebase.database();
        const auth = firebase.auth();

        // ==========================================
        // ورود خودکار (مهمان)
        // ==========================================
        auth.signInAnonymously()
            .then(() => {
                document.getElementById('status').innerHTML = '✅ متصل شدی! (حالت قفل)';
                document.getElementById('status').style.color = '#4caf50';
                console.log('✅ کاربر:', auth.currentUser.uid);
                showScores();
            })
            .catch((error) => {
                document.getElementById('status').innerHTML = '❌ خطا: ' + error.message;
                document.getElementById('status').style.color = '#e94560';
                console.error('خطا:', error);
            });

        // ==========================================
        // ذخیره امتیاز
        // ==========================================
        function saveScore() {
            if (!auth.currentUser) {
                alert('⏳ صبر کن تا وارد بشی...');
                return;
            }

            const name = prompt('👤 اسمت چیه؟') || 'ناشناس';
            const score = Math.floor(Math.random() * 1000);

            db.ref('scores').push({
                player: name,
                score: score,
                userId: auth.currentUser.uid,
                date: firebase.database.ServerValue.TIMESTAMP
            })
            .then(() => {
                alert('✅ امتیاز ذخیره شد!');
                showScores();
            })
            .catch((error) => {
                alert('❌ خطا: ' + error.message);
            });
        }

        // ==========================================
        // نمایش امتیازات
        // ==========================================
        function showScores() {
            db.ref('scores')
                .orderByChild('score')
                .limitToLast(10)
                .once('value')
                .then((snapshot) => {
                    const data = snapshot.val();
                    const container = document.getElementById('list');
                    
                    if (!data) {
                        container.innerHTML = '📭 هنوز امتیازی نیست';
                        return;
                    }
                    
                    const scores = Object.values(data);
                    scores.sort((a, b) => b.score - a.score);
                    
                    let html = '<h2>🏆 بهترین‌ها:</h2>';
                    scores.forEach((s, i) => {
                        html += `<p>${i+1}. ${s.player}: <b>${s.score}</b> امتیاز</p>`;
                    });
                    
                    container.innerHTML = html;
                })
                .catch((error) => {
                    document.getElementById('list').innerHTML = '❌ خطا: ' + error.message;
                });
        }
    </script>
</body>
</html>
