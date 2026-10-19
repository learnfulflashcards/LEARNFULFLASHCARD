// --- ⚙️ ตั้งค่า Firebase ของนาย ---
const firebaseConfig = {
  apiKey: "AIzaSyC3S1cCoYqUZGOz4gr1ybzn1JKSJPJPi14",
  authDomain: "learnful-flashcard-new.firebaseapp.com",
  projectId: "learnful-flashcard-new",
  storageBucket: "learnful-flashcard-new.firebasestorage.app",
  messagingSenderId: "244528248749",
  appId: "1:244528248749:web:286c006d430d51dee75324"
};

// เริ่มต้นเชื่อมต่อ Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const STORAGE_USERS = 'Learnful_flash_users';
const STORAGE_CURRENT_USER = 'Learnful_flash_session';
const STORAGE_DECKS = 'Learnful_flash_all_decks';
const STORAGE_POSTS = 'Learnful_flash_posts';
const STORAGE_REPORTS = 'Learnful_flash_reports';
const STORAGE_CHATS = 'Learnful_flash_chats';
const STORAGE_QUIZZES = 'Learnful_flash_custom_quizzes';
const STORAGE_PROGRESS = 'Learnful_flash_word_progress_';

let currentUser = null;
let selectedAvatar = { icon: 'fa-user', bg: '#7A9A83' };
let selectedPostImages = [];
let tempDeckCards = [];
let tempCardImage = null;

let currentStudyDeck = null;
let studyQueue = [];
let studyIndex = 0;
let isShowingAnswer = false;

let viewTargetUser = null;
let activeChatEmail = null;
let currentEditData = { type: null, postId: null, commentId: null, replyId: null };

let activeQuizId = null;
let quizState = { timer: null, timeLeft: 0, questions: [] };
let tempCustomQuizQuestions = [];
let tempQuizImage = null;

const AVATAR_OPTIONS = [
  { icon: 'fa-user', bg: '#7A9A83' },
  { icon: 'fa-cat', bg: '#D97757' },
  { icon: 'fa-seedling', bg: '#8A9A86' },
  { icon: 'fa-book-open', bg: '#B8860B' },
  { icon: 'fa-heart', bg: '#C27BA0' }
];

// ฟังก์ชันดึงข้อมูลจาก Cloud Firestore ของจริง
async function getCloudData(path) {
  try {
    const docRef = db.collection('learnful_database').doc(path);
    const doc = await docRef.get();
    if (doc.exists) {
      return doc.data().value;
    }
    return null;
  } catch (error) {
    console.error("Error reading cloud data:", error);
    return null;
  }
}

// ฟังก์ชันบันทึกข้อมูลลง Cloud Firestore ของจริง
async function saveCloudData(path, data) {
  try {
    const docRef = db.collection('learnful_database').doc(path);
    await docRef.set({ value: data });
  } catch (error) {
    console.error("Error writing cloud data:", error);
  }
}

async function ensureAdminAccount() {
  let users = await getCloudData(STORAGE_USERS) || [];
  if (!users.some(u => u.isAdmin)) {
    users.push({
      email: 'learnful.flashcard.official@gmail.com',
      password: '1L7F0_3F2C0O0F9',
      name: 'Admin Learnful',
      isAdmin: true,
      bio: 'ผู้ดูแลระบบ Learnful',
      avatarStatus: 'approved',
      customImg: null,
      followers: [],
      following: [],
      lastActive: Date.now()
    });
    await saveCloudData(STORAGE_USERS, users);
  }
}
ensureAdminAccount();

document.addEventListener('DOMContentLoaded', () => {
  renderAvatarPicker();
  checkSession();
  setInterval(updateOnlineHeartbeat, 60000);
});

async function updateOnlineHeartbeat() {
  if (!currentUser) return;
  let users = await getCloudData(STORAGE_USERS) || [];
  let idx = users.findIndex(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
  if (idx !== -1) {
    users[idx].lastActive = Date.now();
    await saveCloudData(STORAGE_USERS, users);
  }
}

function toggleMobileMenu() {
  document.getElementById('navLinksContainer').classList.toggle('show');
}

function switchAuthTab(tab) {
  const isReg = tab === 'register';
  document.getElementById('tabLogin').classList.toggle('active', !isReg);
  document.getElementById('tabRegister').classList.toggle('active', isReg);
  document.getElementById('groupName').style.display = isReg ? 'block' : 'none';
  document.getElementById('groupAvatar').style.display = isReg ? 'block' : 'none';
  document.getElementById('groupTerms').style.display = 'block';
  document.getElementById('authTitle').innerText = isReg ? 'สร้างบัญชีใหม่เพื่อเริ่มต้น' : 'ยินดีต้อนรับสู่พื้นที่แสนอบอุ่น';
  document.getElementById('authSubmitBtn').innerText = isReg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
}

function renderAvatarPicker() {
  const picker = document.getElementById('avatarPicker');
  if (!picker) return;
  picker.innerHTML = AVATAR_OPTIONS.map((av, i) => `
    <div onclick="selectAvatar(${i})" class="avatar-opt ${i === 0 ? 'selected' : ''}" style="width: 40px; height: 40px; border-radius: 50%; background: ${av.bg}; display: inline-flex; align-items: center; justify-content: center; color: white; cursor: pointer; border: 2px solid ${i === 0 ? 'var(--text-main)' : 'transparent'};">
      <i class="fa-solid ${av.icon}"></i>
    </div>
  `).join('');
}

function selectAvatar(index) {
  selectedAvatar = AVATAR_OPTIONS[index];
  document.querySelectorAll('.avatar-opt').forEach((el, i) => {
    el.style.borderColor = i === index ? 'var(--text-main)' : 'transparent';
  });
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('inputPassword');
  const icon = document.getElementById('togglePasswordIcon');
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pwdInput.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

async function handleAuth(e) {
  e.preventDefault();
  if (!document.getElementById('chkTerms').checked) {
    return alert('กรุณาอ่านและยอมรับกฎการใช้งานก่อนเข้าสู่ระบบ');
  }

  const isRegister = document.getElementById('tabRegister').classList.contains('active');
  const email = document.getElementById('inputEmail').value.trim();
  const password = document.getElementById('inputPassword').value;
  
  let users = await getCloudData(STORAGE_USERS) || [];

  if (isRegister) {
    const name = document.getElementById('inputName').value.trim() || 'ผู้เรียน';
    
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return alert('อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น');
    }

    const isNameTaken = users.some(u => u.name && u.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (isNameTaken) {
      return alert('ชื่อแสดงผลนี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น');
    }

    const newUser = {
      email, password, name,
      avatar: selectedAvatar,
      customImg: null,
      avatarStatus: 'approved',
      bio: 'สวัสดี ฉันใช้ Learnful',
      followers: [],
      following: [],
      lastActive: Date.now()
    };
    
    users.push(newUser);
    await saveCloudData(STORAGE_USERS, users);
    loginUser(newUser);
  } else {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    loginUser(user);
  }
}

async function loginUser(user) {
  currentUser = user;
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';

  if (currentUser.isAdmin) {
    document.getElementById('btnNavAdmin').style.display = 'inline-block';
  }
  await updateOnlineHeartbeat();
  updateProfileDisplay();
  switchTab('dashboard');
}

function checkSession() {
  const session = localStorage.getItem(STORAGE_CURRENT_USER);
  if (session) loginUser(JSON.parse(session));
}

function logout() {
  localStorage.removeItem(STORAGE_CURRENT_USER);
  currentUser = null;
  location.reload();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('navLinksContainer').classList.remove('show');

  if (tabName === 'dashboard') {
    document.getElementById('tab-dashboard').style.display = 'block';
    renderDashboardStats();
    renderAdminNoticeBoard();
  } else if (tabName === 'decks') {
    document.getElementById('tab-decks').style.display = 'block';
    loadDecks();
  } else if (tabName === 'quizHub') {
    document.getElementById('tab-quizHub').style.display = 'block';
    renderQuizHub();
  } else if (tabName === 'feed') {
    document.getElementById('tab-feed').style.display = 'block';
    renderFeed();
  } else if (tabName === 'chatSelect') {
    document.getElementById('tab-chatSelect').style.display = 'block';
    renderChatUsersList();
  } else if (tabName === 'admin') {
    document.getElementById('tab-admin').style.display = 'block';
    renderAdminDashboard();
  }
}

function updateProfileDisplay() {
  document.getElementById('userNameDisplay').innerText = currentUser.name;
  const avatarEl = document.getElementById('userAvatarIcon');
  if (currentUser.customImg) {
    avatarEl.innerHTML = `<img src="${currentUser.customImg}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    avatarEl.style.background = currentUser.avatar ? currentUser.avatar.bg : '#7A9A83';
    avatarEl.innerHTML = `<i class="fa-solid ${currentUser.avatar ? currentUser.avatar.icon : 'fa-user'}"></i>`;
  }
  document.getElementById('welcomeHeading').innerText = `สวัสดีคุณ ${currentUser.name}`;
}

async function renderDashboardStats() {
  let users = await getCloudData(STORAGE_USERS) || [];
  document.getElementById('totalUsersCount').innerText = `${users.length} คน`;

  const now = Date.now();
  const onlineCount = users.filter(u => u.lastActive && (now - u.lastActive < 180000)).length;
  document.getElementById('onlineUsersCount').innerText = `${onlineCount} คน`;

  const progressPath = STORAGE_PROGRESS + currentUser.email;
  const progress = await getCloudData(progressPath) || {};
  
  let studied = Object.keys(progress).length;
  let remembered = Object.values(progress).filter(v => v === 'remembered').length;
  let forgot = Object.values(progress).filter(v => v === 'forgot').length;

  document.getElementById('statStudiedCount').innerText = `${studied} คำ`;
  document.getElementById('statRememberedCount').innerText = `${remembered} คำ`;
  document.getElementById('statForgotCount').innerText = `${forgot} คำ`;
}

async function renderAdminNoticeBoard() {
  let posts = await getCloudData(STORAGE_POSTS) || [];
  let adminPosts = posts.filter(p => p.authorEmail === 'learnful.flashcard.official@gmail.com' || p.authorName === 'Admin Learnful');

  const container = document.getElementById('adminNoticeBoardContainer');
  if (adminPosts.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--text-muted); text-align:center; padding: 20px;">ยังไม่มีประกาศจากแอดมิน</p>`;
    return;
  }

  container.innerHTML = adminPosts.map(p => `
    <div class="post-card" style="border-left: 4px solid var(--accent-terracotta);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="color:var(--accent-terracotta);">🛡️ ${p.authorName} (ประกาศระบบ)</strong>
        <span style="font-size: 11px; color: var(--text-muted);">${p.createdAt}</span>
      </div>
      <p style="font-size: 14px; margin-bottom: 10px; white-space: pre-line;">${p.content}</p>
      ${p.images && p.images.length > 0 ? `<div class="post-images-grid">${p.images.map(img => `<img src="${img}">`).join('')}</div>` : ''}
    </div>
  `).join('');
}

async function openWordListModal(type) {
  const progressPath = STORAGE_PROGRESS + currentUser.email;
  const progress = await getCloudData(progressPath) || {};
  
  const titleMap = { studied: 'คำศัพท์ที่เรียนทั้งหมด', remembered: 'คำศัพท์ที่จำได้แม่นยำ', forgot: 'คำศัพท์ที่ยังจำไม่ได้' };
  document.getElementById('wordListTitle').innerText = titleMap[type];

  let filteredWords = Object.entries(progress).filter(([word, status]) => {
    if (type === 'studied') return true;
    return status === type;
  });

  const container = document.getElementById('wordListContainer');
  if (filteredWords.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--text-muted); text-align:center; padding: 20px;">ไม่พบรายการคำศัพท์</p>`;
  } else {
    container.innerHTML = filteredWords.map(([qa]) => {
      let parts = qa.split('|||');
      return `
        <div style="background: var(--bg-main); padding: 10px; border-radius: 6px; margin-bottom: 6px; font-size: 13px; display: flex; justify-content: space-between;">
          <span><strong>Q:</strong> ${parts[0]}</span>
          <span><strong>A:</strong> ${parts[1] || ''}</span>
        </div>
      `;
    }).join('');
  }
  document.getElementById('wordListModal').style.display = 'flex';
}

// -------------------------------------------------------------
// แฟลชการ์ด (เด็คคำศัพท์)
// -------------------------------------------------------------
async function loadDecks(searchKeyword = '') {
  let decks = await getCloudData(STORAGE_DECKS) || [];
  const grid = document.getElementById('decksGrid');

  const visibleDecks = decks.filter(d => {
    const isMine = d.authorEmail === currentUser.email;
    const isPublic = d.privacy !== 'private';
    return isMine || isPublic;
  });

  const filteredDecks = visibleDecks.filter(d => 
    d.name.toLowerCase().includes(searchKeyword.toLowerCase()) || 
    (d.authorName && d.authorName.toLowerCase().includes(searchKeyword.toLowerCase()))
  );

  if (filteredDecks.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">ไม่พบสำรับคำศัพท์ กดปุ่ม "สร้างสำรับใหม่" เพื่อเริ่มต้นได้เลย</p>`;
    return;
  }

  grid.innerHTML = filteredDecks.map(d => {
    const isMine = d.authorEmail === currentUser.email;
    return `
      <div class="deck-card" style="border-left: 4px solid ${d.privacy === 'private' ? 'var(--text-muted)' : 'var(--accent-sage)'};">
        <h3>${d.name}</h3>
        <p style="font-size: 12px; color: var(--accent-sage); margin-bottom: 4px;">สร้างโดย: ${d.authorName || 'ไม่ระบุ'} ${d.privacy === 'private' ? '🔒 (ส่วนตัว)' : '🌍 (สาธารณะ)'}</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">การ์ด: ${d.cards ? d.cards.length : 0} ใบ | ❤️ ${d.likes ? d.likes.length : 0} | เข้าใช้: ${d.viewCount || 0}</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn-primary" onclick="startStudy('${d.id}')">เริ่มเรียน</button>
          ${isMine ? `
            <button class="btn-secondary" onclick="openEditDeckModal('${d.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-secondary" onclick="deleteDeck('${d.id}')"><i class="fa-solid fa-trash"></i></button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterDecks() {
  const kw = document.getElementById('deckSearchInput').value.trim();
  loadDecks(kw);
}

function openCreateDeckModal() {
  document.getElementById('deckModalTitleText').innerText = 'สร้างสำรับแฟลชการ์ด';
  document.getElementById('editingDeckId').value = '';
  tempDeckCards = [];
  tempCardImage = null;
  document.getElementById('newDeckNameInput').value = '';
  document.getElementById('newDeckPrivacyInput').value = 'public';
  document.getElementById('newCardQ').value = '';
  document.getElementById('newCardA').value = '';
  document.getElementById('cardImgPreviewContainer').style.display = 'none';
  renderTempCards();
  document.getElementById('createDeckModal').style.display = 'flex';
}

async function openEditDeckModal(deckId) {
  let decks = await getCloudData(STORAGE_DECKS) || [];
  const deck = decks.find(d => d.id === deckId);
  if (!deck) return;

  document.getElementById('deckModalTitleText').innerText = 'แก้ไขสำรับแฟลชการ์ด';
  document.getElementById('editingDeckId').value = deck.id;
  document.getElementById('newDeckNameInput').value = deck.name;
  document.getElementById('newDeckPrivacyInput').value = deck.privacy || 'public';
  tempDeckCards = [...(deck.cards || [])];
  tempCardImage = null;
  document.getElementById('cardImgPreviewContainer').style.display = 'none';
  renderTempCards();
  document.getElementById('createDeckModal').style.display = 'flex';
}

function closeCreateDeckModal() {
  document.getElementById('createDeckModal').style.display = 'none';
}

function handleCardImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempCardImage = ev.target.result;
    document.getElementById('cardImgPreview').src = tempCardImage;
    document.getElementById('cardImgPreviewContainer').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function addCardToTempList() {
  const q = document.getElementById('newCardQ').value.trim();
  const a = document.getElementById('newCardA').value.trim();
  if (!q || !a) return alert('กรุณากรอกคำศัพท์และคำแปล');

  tempDeckCards.push({ q, a, image: tempCardImage });
  document.getElementById('newCardQ').value = '';
  document.getElementById('newCardA').value = '';
  document.getElementById('newCardImgFile').value = '';
  document.getElementById('cardImgPreviewContainer').style.display = 'none';
  tempCardImage = null;
  renderTempCards();
}

function renderTempCards() {
  const list = document.getElementById('tempCardsList');
  if (tempDeckCards.length === 0) {
    list.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center;">ยังไม่มีการ์ดถูกเพิ่ม</p>`;
    return;
  }
  list.innerHTML = tempDeckCards.map((c, i) => `
    <div style="font-size: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px; border-bottom: 1px solid var(--border-subtle);">
      <span><strong>${i+1}. ${c.q}</strong> - ${c.a} ${c.image ? '🖼️' : ''}</span>
      <button onclick="removeTempCard(${i})" style="background:none; border:none; color:red; cursor:pointer;">ลบ</button>
    </div>
  `).join('');
}

function removeTempCard(index) {
  tempDeckCards.splice(index, 1);
  renderTempCards();
}

async function saveNewDeck() {
  const name = document.getElementById('newDeckNameInput').value.trim();
  const privacy = document.getElementById('newDeckPrivacyInput').value;
  const editingId = document.getElementById('editingDeckId').value;

  if (!name) return alert('กรุณาตั้งชื่อสำรับคำศัพท์');
  if (tempDeckCards.length === 0) return alert('กรุณาเพิ่มการ์ดอย่างน้อย 1 ใบ');

  let decks = await getCloudData(STORAGE_DECKS) || [];

  if (editingId) {
    let deck = decks.find(d => d.id === editingId);
    if (deck) {
      deck.name = name;
      deck.privacy = privacy;
      deck.cards = tempDeckCards;
    }
  } else {
    decks.push({
      id: 'deck_' + Date.now(),
      name,
      privacy,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      cards: tempDeckCards,
      viewCount: 0,
      likes: [],
      comments: []
    });
  }
  
  await saveCloudData(STORAGE_DECKS, decks);
  closeCreateDeckModal();
  loadDecks();
}

async function deleteDeck(id) {
  if (!confirm('ยืนยันลบสำรับนี้?')) return;
  let decks = await getCloudData(STORAGE_DECKS) || [];
  decks = decks.filter(d => d.id !== id);
  await saveCloudData(STORAGE_DECKS, decks);
  loadDecks();
}

async function startStudy(deckId) {
  let decks = await getCloudData(STORAGE_DECKS) || [];
  const deck = decks.find(d => d.id === deckId);
  if (!deck || !deck.cards || deck.cards.length === 0) return alert('สำรับนี้ไม่มีการ์ดคำศัพท์');

  deck.viewCount = (deck.viewCount || 0) + 1;
  await saveCloudData(STORAGE_DECKS, decks);

  currentStudyDeck = deck;
  studyQueue = [...deck.cards];
  studyIndex = 0;
  isShowingAnswer = false;

  document.getElementById('studyDeckTitle').innerText = deck.name;
  document.getElementById('studyDeckAuthor').innerText = `สร้างโดย: ${deck.authorName || 'ไม่ระบุ'}`;
  document.getElementById('studyViewerCount').innerHTML = `<i class="fa-solid fa-users"></i> ${deck.viewCount}`;
  
  updateDeckLikeUI();
  renderDeckComments();

  document.getElementById('studyModal').style.display = 'flex';
  showCurrentCard();
}

function showCurrentCard() {
  const card = studyQueue[studyIndex];
  const textEl = document.getElementById('cardText');
  const imgContainer = document.getElementById('cardImageContainer');
  const imgEl = document.getElementById('cardDisplayImg');

  textEl.innerText = isShowingAnswer ? card.a : card.q;
  if (card.image) {
    imgEl.src = card.image;
    imgContainer.style.display = 'block';
  } else {
    imgContainer.style.display = 'none';
  }
}

function flipCard() {
  isShowingAnswer = !isShowingAnswer;
  showCurrentCard();
}

async function rateCard(rating) {
  const card = studyQueue[studyIndex];
  const progressPath = STORAGE_PROGRESS + currentUser.email;
  let progress = await getCloudData(progressPath) || {};
  
  const key = `${card.q}|||${card.a}`;
  progress[key] = (rating === 4) ? 'remembered' : 'forgot';

  await saveCloudData(progressPath, progress);

  studyIndex++;
  isShowingAnswer = false;
  if (studyIndex < studyQueue.length) {
    showCurrentCard();
  } else {
    alert('ทบทวนครบทุกการ์ดแล้ว เก่งมาก!');
    closeStudyModal();
  }
}

function closeStudyModal() {
  document.getElementById('studyModal').style.display = 'none';
  loadDecks();
}

function speakCurrentCardText() {
  const card = studyQueue[studyIndex];
  const textToSpeak = isShowingAnswer ? card.a : card.q;
  if (!('speechSynthesis' in window)) return alert('เบราว์เซอร์ไม่รองรับระบบเสียงพูด');

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

async function toggleLikeDeck() {
  let decks = await getCloudData(STORAGE_DECKS) || [];
  const deck = decks.find(d => d.id === currentStudyDeck.id);
  if (!deck) return;

  deck.likes = deck.likes || [];
  const idx = deck.likes.indexOf(currentUser.email);
  if (idx > -1) deck.likes.splice(idx, 1);
  else deck.likes.push(currentUser.email);

  currentStudyDeck = deck;
  await saveCloudData(STORAGE_DECKS, decks);
  updateDeckLikeUI();
}

function updateDeckLikeUI() {
  const likes = currentStudyDeck.likes || [];
  const isLiked = likes.includes(currentUser.email);
  const btn = document.getElementById('studyLikeBtn');
  btn.style.color = isLiked ? 'var(--accent-terracotta)' : 'var(--text-muted)';
  document.getElementById('studyLikeCount').innerText = likes.length;
}

async function addDeckComment() {
  const input = document.getElementById('deckCommentInput');
  const text = input.value.trim();
  if (!text) return;

  let decks = await getCloudData(STORAGE_DECKS) || [];
  const deck = decks.find(d => d.id === currentStudyDeck.id);
  if (!deck) return;

  deck.comments = deck.comments || [];
  deck.comments.push({ name: currentUser.name, text, time: new Date().toLocaleDateString() });

  currentStudyDeck = deck;
  await saveCloudData(STORAGE_DECKS, decks);
  input.value = '';
  renderDeckComments();
}

function renderDeckComments() {
  const container = document.getElementById('deckCommentsContainer');
  const comments = currentStudyDeck.comments || [];
  if (comments.length === 0) {
    container.innerHTML = `<p style="font-size: 11px; color: var(--text-muted);">ยังไม่มีความคิดเห็น</p>`;
    return;
  }
  container.innerHTML = comments.map(c => `
    <div style="background: var(--bg-main); padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 12px;">
      <strong>${c.name}:</strong> ${c.text}
    </div>
  `).join('');
}

async function reportDeck() {
  let reports = await getCloudData(STORAGE_REPORTS) || [];
  reports.push({
    id: 'rep_' + Date.now(),
    reporter: currentUser.email,
    targetType: 'deck',
    targetId: currentStudyDeck.id,
    createdAt: new Date().toLocaleString()
  });
  await saveCloudData(STORAGE_REPORTS, reports);
  alert('ส่งรายงานสำรับนี้ให้แอดมินเรียบร้อย!');
}

// -------------------------------------------------------------
// ศูนย์รวมแบบทดสอบ (Quiz Hub) + รองรับแก้ไขชุดข้อสอบ
// -------------------------------------------------------------
async function renderQuizHub() {
  const grid = document.getElementById('quizHubGrid');
  let customQuizzes = await getCloudData(STORAGE_QUIZZES) || [];
  
  if (customQuizzes.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">ยังไม่มีชุดข้อสอบในระบบ กดปุ่ม "สร้างชุดข้อสอบใหม่" ด้านบนเพื่อเริ่มสร้างได้เลยครับ</p>`;
    return;
  }

  grid.innerHTML = customQuizzes.map(q => {
    const isMine = q.author === currentUser.email || currentUser.isAdmin;
    return `
      <div class="deck-card" style="border-left: 4px solid var(--accent-terracotta);">
        <h3>📝 ${q.title}</h3>
        <p style="font-size: 12px; color: var(--accent-sage); margin-bottom: 2px;">สร้างโดย: ${q.authorName || 'ผู้ดูแลระบบ'}</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">ข้อสอบ: ${q.questions.length} ข้อ | ❤️ ${q.likes ? q.likes.length : 0}</p>
        <div style="display: flex; gap: 6px;">
          <button class="btn-primary" onclick="openQuizSetup('${q.id}')">ทำข้อสอบ</button>
          ${isMine ? `
            <button class="btn-secondary" onclick="openEditCustomQuizModal('${q.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-secondary" onclick="deleteCustomQuiz('${q.id}')"><i class="fa-solid fa-trash"></i></button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openCreateCustomQuizModal() {
  tempCustomQuizQuestions = [];
  tempQuizImage = null;
  document.getElementById('quizModalTitleText').innerText = 'สร้างชุดข้อสอบใหม่';
  document.getElementById('editingQuizId').value = '';
  document.getElementById('customQuizTitleInput').value = '';
  document.getElementById('customQuizQ').value = '';
  document.getElementById('customQuizCorrectA').value = '';
  document.getElementById('customQuizWrong1').value = '';
  document.getElementById('customQuizWrong2').value = '';
  document.getElementById('quizImgPreviewContainer').style.display = 'none';
  renderTempCustomQuizList();
  document.getElementById('createCustomQuizModal').style.display = 'flex';
}

async function openEditCustomQuizModal(quizId) {
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const qObj = quizzes.find(q => q.id === quizId);
  if (!qObj) return;

  document.getElementById('quizModalTitleText').innerText = 'แก้ไขชุดข้อสอบ';
  document.getElementById('editingQuizId').value = qObj.id;
  document.getElementById('customQuizTitleInput').value = qObj.title;
  tempCustomQuizQuestions = [...(qObj.questions || [])];
  tempQuizImage = null;
  document.getElementById('quizImgPreviewContainer').style.display = 'none';
  renderTempCustomQuizList();
  document.getElementById('createCustomQuizModal').style.display = 'flex';
}

function handleQuizImgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempQuizImage = ev.target.result;
    document.getElementById('quizImgPreview').src = tempQuizImage;
    document.getElementById('quizImgPreviewContainer').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function addCustomQuizQuestion() {
  const q = document.getElementById('customQuizQ').value.trim();
  const correct = document.getElementById('customQuizCorrectA').value.trim();
  const w1 = document.getElementById('customQuizWrong1').value.trim();
  const w2 = document.getElementById('customQuizWrong2').value.trim();
  if (!q || !correct || !w1) return alert('กรอกคำถามและตัวเลือกอย่างน้อย 1 ตัวลวงให้ครบถ้วน');

  tempCustomQuizQuestions.push({ q, image: tempQuizImage, correct, choices: [correct, w1, w2].filter(Boolean) });
  
  document.getElementById('customQuizQ').value = '';
  document.getElementById('customQuizCorrectA').value = '';
  document.getElementById('customQuizWrong1').value = '';
  document.getElementById('customQuizWrong2').value = '';
  document.getElementById('customQuizImgFile').value = '';
  document.getElementById('quizImgPreviewContainer').style.display = 'none';
  tempQuizImage = null;
  renderTempCustomQuizList();
}

function renderTempCustomQuizList() {
  const list = document.getElementById('tempCustomQuizList');
  if (tempCustomQuizQuestions.length === 0) {
    list.innerHTML = `<p style="font-size: 11px; color: var(--text-muted); text-align: center;">ยังไม่มีข้อสอบ</p>`;
    return;
  }
  list.innerHTML = tempCustomQuizQuestions.map((item, i) => `<div style="font-size:11px; margin-bottom:2px;">ข้อ ${i+1}: ${item.q} ${item.image ? '🖼️' : ''}</div>`).join('');
}

async function saveCustomQuiz() {
  const title = document.getElementById('customQuizTitleInput').value.trim();
  const editingId = document.getElementById('editingQuizId').value;
  if (!title || tempCustomQuizQuestions.length === 0) return alert('กรุณากรอกชื่อชุดข้อสอบและเพิ่มข้อสอบอย่างน้อย 1 ข้อ');

  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];

  if (editingId) {
    let qObj = quizzes.find(q => q.id === editingId);
    if (qObj) {
      qObj.title = title;
      qObj.questions = tempCustomQuizQuestions;
    }
  } else {
    quizzes.push({ 
      id: 'quiz_' + Date.now(), 
      title, 
      questions: tempCustomQuizQuestions, 
      author: currentUser.email,
      authorName: currentUser.name,
      likes: [],
      comments: []
    });
  }

  await saveCloudData(STORAGE_QUIZZES, quizzes);
  document.getElementById('createCustomQuizModal').style.display = 'none';
  renderQuizHub();
}

async function deleteCustomQuiz(quizId) {
  if (!confirm('ยืนยันลบชุดข้อสอบนี้?')) return;
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  quizzes = quizzes.filter(q => q.id !== quizId);
  await saveCloudData(STORAGE_QUIZZES, quizzes);
  renderQuizHub();
}

function openQuizSetup(quizId) {
  activeQuizId = quizId;
  document.getElementById('quizSetupModal').style.display = 'flex';
}

async function confirmStartQuiz() {
  document.getElementById('quizSetupModal').style.display = 'none';
  const timeMins = parseInt(document.getElementById('quizTimeSelect').value);
  
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const qObj = quizzes.find(q => q.id === activeQuizId);
  if (!qObj) return;

  const questions = qObj.questions.map(item => ({
    q: item.q,
    image: item.image,
    correct: item.correct,
    choices: [...item.choices].sort(() => Math.random() - 0.5)
  }));

  quizState.questions = questions;
  quizState.timeLeft = timeMins * 60;
  
  document.getElementById('quizTitle').innerText = qObj.title;
  document.getElementById('quizAuthorDisplay').innerText = `สร้างโดย: ${qObj.authorName || 'ผู้ดูแลระบบ'}`;
  
  updateQuizLikeUI();
  renderQuizComments();

  document.getElementById('quizModal').style.display = 'flex';
  startQuizTimer(timeMins > 0);
  renderQuizQuestions();
}

function startQuizTimer(hasLimit) {
  clearInterval(quizState.timer);
  const display = document.getElementById('quizTimerDisplay');
  if (!hasLimit) { display.innerText = '⏱️ ไม่จำกัดเวลา'; return; }

  quizState.timer = setInterval(() => {
    quizState.timeLeft--;
    let m = Math.floor(quizState.timeLeft / 60);
    let s = quizState.timeLeft % 60;
    display.innerText = `⏱️ ${m}:${s < 10 ? '0' : ''}${s}`;
    if (quizState.timeLeft <= 0) {
      clearInterval(quizState.timer);
      alert('หมดเวลา!');
      submitQuizAnswers();
    }
  }, 1000);
}

function renderQuizQuestions() {
  const container = document.getElementById('quizBody');
  container.innerHTML = quizState.questions.map((item, idx) => `
    <div style="margin-bottom: 14px; padding: 12px; background: white; border-radius: 8px; border: 1px solid var(--border-subtle);">
      <p style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">ข้อ ${idx+1}: ${item.q}</p>
      ${item.image ? `<img src="${item.image}" style="max-height: 120px; border-radius: 6px; margin-bottom: 8px;">` : ''}
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${item.choices.map(choice => `
          <label style="font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="radio" name="q_${idx}" value="${choice.replace(/"/g, '&quot;')}"> ${choice}
          </label>
        `).join('')}
      </div>
    </div>
  `).join('') + `<button class="btn-primary" onclick="submitQuizAnswers()">ส่งคำตอบ</button>`;
}

async function toggleLikeQuiz() {
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const qObj = quizzes.find(q => q.id === activeQuizId);
  if (!qObj) return;

  qObj.likes = qObj.likes || [];
  const idx = qObj.likes.indexOf(currentUser.email);
  if (idx > -1) qObj.likes.splice(idx, 1);
  else qObj.likes.push(currentUser.email);

  await saveCloudData(STORAGE_QUIZZES, quizzes);
  updateQuizLikeUI();
}

async function updateQuizLikeUI() {
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const qObj = quizzes.find(q => q.id === activeQuizId);
  if (!qObj) return;

  const likes = qObj.likes || [];
  const isLiked = likes.includes(currentUser.email);
  const btn = document.getElementById('quizLikeBtn');
  btn.style.color = isLiked ? 'var(--accent-terracotta)' : 'var(--text-muted)';
  document.getElementById('quizLikeCount').innerText = likes.length;
}

async function addQuizComment() {
  const input = document.getElementById('quizCommentInput');
  const text = input.value.trim();
  if (!text) return;

  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const qObj = quizzes.find(q => q.id === activeQuizId);
  if (!qObj) return;

  qObj.comments = qObj.comments || [];
  qObj.comments.push({ name: currentUser.name, text, time: new Date().toLocaleDateString() });

  await saveCloudData(STORAGE_QUIZZES, quizzes);
  input.value = '';
  renderQuizComments();
}

function renderQuizComments() {
  getCloudData(STORAGE_QUIZZES).then(quizzes => {
    let qObj = (quizzes || []).find(q => q.id === activeQuizId);
    const container = document.getElementById('quizCommentsContainer');
    const comments = qObj ? (qObj.comments || []) : [];
    if (comments.length === 0) {
      container.innerHTML = `<p style="font-size: 11px; color: var(--text-muted);">ยังไม่มีความคิดเห็น</p>`;
      return;
    }
    container.innerHTML = comments.map(c => `
      <div style="background: var(--bg-main); padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 12px;">
        <strong>${c.name}:</strong> ${c.text}
      </div>
    `).join('');
  });
}

async function reportQuiz() {
  let reports = await getCloudData(STORAGE_REPORTS) || [];
  reports.push({
    id: 'rep_' + Date.now(),
    reporter: currentUser.email,
    targetType: 'quiz',
    targetId: activeQuizId,
    createdAt: new Date().toLocaleString()
  });
  await saveCloudData(STORAGE_REPORTS, reports);
  alert('ส่งรายงานชุดข้อสอบนี้ให้แอดมินเรียบร้อย!');
}

function submitQuizAnswers() {
  clearInterval(quizState.timer);
  let score = 0;
  let wrongList = [];

  quizState.questions.forEach((item, idx) => {
    const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
    const ans = selected ? selected.value : 'ไม่ได้ตอบ';
    if (ans === item.correct) score++;
    else wrongList.push({ q: item.q, correct: item.correct, ans });
  });

  const container = document.getElementById('quizBody');
  container.innerHTML = `
    <div style="text-align: center; padding: 16px;">
      <h2>🎉 คะแนนของคุณ</h2>
      <p style="font-size: 22px; font-weight: bold; color: var(--accent-sage); margin: 10px 0;">${score} / ${quizState.questions.length}</p>
      ${wrongList.length > 0 ? `
        <div style="text-align: left; background: #FFF5F5; padding: 10px; border-radius: 6px; font-size: 12px; max-height: 200px; overflow-y: auto;">
          <h4 style="color: #C53030; margin-bottom: 6px;">ข้อที่ตอบผิด:</h4>
          ${wrongList.map(w => `<p style="margin-bottom:4px;">Q: ${w.q}<br>ตอบ: ${w.ans} | เฉลย: ${w.correct}</p>`).join('')}
        </div>
      ` : '<p style="color: #2F855A; font-weight: bold;">ยอดเยี่ยม! ถูกหมดทุกข้อ</p>'}
      <button class="btn-primary" style="margin-top: 14px;" onclick="document.getElementById('quizModal').style.display='none'; renderQuizHub();">ปิดหน้าต่าง</button>
    </div>
  `;
}

// โพสต์ คอมเมนต์ และแชท
function handlePostImagesUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length > 5) return alert('แนบรูปได้ไม่เกิน 5 รูป');
  selectedPostImages = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      selectedPostImages.push(ev.target.result);
      document.getElementById('postImagesPreview').innerHTML = selectedPostImages.map(img => `<img src="${img}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">`).join('');
    };
    reader.readAsDataURL(file);
  });
}

async function createPost() {
  const content = document.getElementById('postContentInput').value.trim();
  if (!content) return alert('กรุณากรอกข้อความโพสต์');

  let posts = await getCloudData(STORAGE_POSTS) || [];
  posts.unshift({
    id: 'post_' + Date.now(),
    authorEmail: currentUser.email,
    authorName: currentUser.name,
    content,
    images: selectedPostImages,
    likes: [],
    comments: [],
    createdAt: new Date().toLocaleDateString()
  });

  await saveCloudData(STORAGE_POSTS, posts);
  document.getElementById('postContentInput').value = '';
  selectedPostImages = [];
  document.getElementById('postImagesPreview').innerHTML = '';
  renderFeed();
}

async function filterCommunity() {
  const kw = document.getElementById('communitySearchInput').value.trim().toLowerCase();
  const searchResultsContainer = document.getElementById('userSearchResultsContainer');

  if (!kw) {
    searchResultsContainer.style.display = 'none';
    renderFeed();
    return;
  }

  let users = await getCloudData(STORAGE_USERS) || [];
  const matchedUsers = users.filter(u => u.name.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw));

  if (matchedUsers.length > 0) {
    searchResultsContainer.style.display = 'block';
    searchResultsContainer.innerHTML = `
      <h4 style="font-size:14px; margin-bottom:8px; color:var(--accent-sage);">👤 พบผู้ใช้งาน (${matchedUsers.length}):</h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${matchedUsers.map(u => `
          <div style="background:white; padding:10px 14px; border-radius:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${u.name}</strong> <span style="font-size:12px; color:var(--text-muted);">(${u.email})</span>
            </div>
            <button class="btn-primary" style="width:auto; padding:4px 12px; font-size:12px;" onclick="openUserProfileModal('${u.email}')">ดูโปรไฟล์</button>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    searchResultsContainer.style.display = 'none';
  }

  renderFeed(kw);
}

async function renderFeed(searchKw = '') {
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const container = document.getElementById('feedContainer');

  const filteredPosts = posts.filter(p => 
    p.content.toLowerCase().includes(searchKw.toLowerCase()) || 
    p.authorName.toLowerCase().includes(searchKw.toLowerCase())
  );

  container.innerHTML = filteredPosts.map(p => {
    const myEmail = currentUser ? currentUser.email.trim().toLowerCase() : '';
    const postEmail = p.authorEmail ? p.authorEmail.trim().toLowerCase() : '';
    const isMyPost = currentUser && ((postEmail && myEmail === postEmail) || (!p.authorEmail && p.authorName === currentUser.name));
    const isLiked = p.likes && p.likes.includes(currentUser.email);

    return `
      <div class="post-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="cursor:pointer; color:var(--accent-sage);" onclick="openUserProfileModal('${p.authorEmail || ''}')">${p.authorName}</strong>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 11px; color: var(--text-muted);">${p.createdAt}</span>
            <button onclick="reportItem('post', '${p.id}')" class="btn-icon" style="font-size: 12px; color: var(--text-muted);" title="รายงานโพสต์"><i class="fa-solid fa-flag"></i></button>
            ${isMyPost ? `
              <button onclick="editPost('${p.id}')" class="btn-icon" style="font-size: 12px;" title="แก้ไขโพสต์"><i class="fa-solid fa-pen"></i></button>
              <button onclick="deletePost('${p.id}')" class="btn-icon" style="font-size: 12px; color: #D9534F;" title="ลบโพสต์"><i class="fa-solid fa-trash"></i></button>
            ` : ''}
          </div>
        </div>
        <p style="font-size: 14px; margin-bottom: 10px; white-space: pre-line;">${p.content}</p>
        ${p.images && p.images.length > 0 ? `
          <div class="post-images-grid">
            ${p.images.map(img => `<img src="${img}">`).join('')}
          </div>
        ` : ''}
        <div style="display: flex; gap: 16px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-subtle); font-size: 13px;">
          <button onclick="toggleLikePost('${p.id}')" style="background:none; border:none; cursor:pointer; color: ${isLiked ? 'var(--accent-terracotta)' : 'var(--text-muted)'};">
            <i class="fa-solid fa-heart"></i> ชอบ (${p.likes ? p.likes.length : 0})
          </button>
          <span><i class="fa-solid fa-comment"></i> ความเห็น (${p.comments ? p.comments.length : 0})</span>
        </div>

        <div style="margin-top: 10px;">
          ${p.comments ? p.comments.map(c => renderCommentItem(p.id, c)).join('') : ''}
          
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <input type="text" id="commentInput_${p.id}" placeholder="แสดงความคิดเห็น..." class="form-input" style="padding: 6px 10px; font-size: 12px;">
            <button class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 12px;" onclick="addComment('${p.id}')">ส่ง</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCommentItem(postId, c) {
  const myEmail = currentUser ? currentUser.email.trim().toLowerCase() : '';
  const commentEmail = c.email ? c.email.trim().toLowerCase() : '';
  const isMyComment = currentUser && ((commentEmail && myEmail === commentEmail) || (!c.email && c.name === currentUser.name));
  const isLiked = c.likes && c.likes.includes(currentUser.email);
  
  return `
    <div class="comment-item" style="position: relative; padding-top: 6px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="cursor:pointer; color:var(--accent-sage);" onclick="openUserProfileModal('${c.email || ''}')">${c.name}</strong>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button onclick="reportItem('comment', '${c.id}')" class="btn-icon" style="font-size: 11px; color: var(--text-muted);" title="รายงานคอมเมนต์"><i class="fa-solid fa-flag"></i></button>
          ${isMyComment ? `
            <button onclick="editComment('${postId}', '${c.id}')" class="btn-icon" style="font-size: 11px; color: var(--text-muted);" title="แก้ไขคอมเมนต์"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteComment('${postId}', '${c.id}')" class="btn-icon" style="font-size: 11px; color: #D9534F;" title="ลบคอมเมนต์"><i class="fa-solid fa-trash"></i></button>
          ` : ''}
        </div>
      </div>
      <p style="margin-top:4px; font-size:12px; white-space: pre-line;">${c.text}</p>
      <div class="comment-actions">
        <button onclick="toggleLikeComment('${postId}', '${c.id}')" style="color:${isLiked ? 'var(--accent-terracotta)' : 'var(--text-muted)'};">
          <i class="fa-solid fa-heart"></i> ชอบ (${c.likes ? c.likes.length : 0})
        </button>
        <button onclick="showReplyBox('${postId}', '${c.id}')"><i class="fa-solid fa-reply"></i> ตอบกลับ</button>
      </div>

      <div id="replyBox_${postId}_${c.id}" style="display:none; gap:6px; margin-top:6px;">
        <input type="text" id="replyInput_${postId}_${c.id}" placeholder="ตอบกลับ ${c.name}..." class="form-input" style="padding:4px 8px; font-size:11px;">
        <button class="btn-primary" style="width:auto; padding:4px 10px; font-size:11px;" onclick="addReply('${postId}', '${c.id}')">ส่ง</button>
      </div>

      ${c.replies ? c.replies.map(r => {
        const replyEmail = r.email ? r.email.trim().toLowerCase() : '';
        const isMyReply = currentUser && ((replyEmail && myEmail === replyEmail) || (!r.email && r.name === currentUser.name));
        const isReplyLiked = r.likes && r.likes.includes(currentUser.email);
        return `
          <div class="reply-item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="cursor:pointer; color:var(--accent-sage);" onclick="openUserProfileModal('${r.email}')">${r.name}</strong>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button onclick="reportItem('reply', '${r.id}')" class="btn-icon" style="font-size: 10px; color: var(--text-muted);" title="รายงานการตอบกลับ"><i class="fa-solid fa-flag"></i></button>
                ${isMyReply ? `
                  <button onclick="editReply('${postId}', '${c.id}', '${r.id}')" class="btn-icon" style="font-size: 10px; color: var(--text-muted);"><i class="fa-solid fa-pen"></i></button>
                  <button onclick="deleteReply('${postId}', '${c.id}', '${r.id}')" class="btn-icon" style="font-size: 10px; color: #D9534F;"><i class="fa-solid fa-trash"></i></button>
                ` : ''}
              </div>
            </div>
            <p style="margin-top:2px; font-size:11px; white-space: pre-line;">${r.text}</p>
            <div class="comment-actions">
              <button onclick="toggleLikeReply('${postId}', '${c.id}', '${r.id}')" style="color:${isReplyLiked ? 'var(--accent-terracotta)' : 'var(--text-muted)'};">
                <i class="fa-solid fa-heart"></i> ชอบ (${r.likes ? r.likes.length : 0})
              </button>
            </div>
          </div>
        `;
      }).join('') : ''}
    </div>
  `;
}

function openEditModal(type, postId, commentId, replyId, currentText) {
  currentEditData = { type, postId, commentId, replyId };
  document.getElementById('editModalInput').value = currentText;
  document.getElementById('editModalTitle').innerText = type === 'post' ? 'แก้ไขโพสต์' : (type === 'comment' ? 'แก้ไขความคิดเห็น' : 'แก้ไขการตอบกลับ');
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function saveEditedContent() {
  const newText = document.getElementById('editModalInput').value.trim();
  if (!newText) return alert('กรุณากรอกข้อความ');

  const { type, postId, commentId, replyId } = currentEditData;
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  if (type === 'post') {
    post.content = newText;
  } else if (type === 'comment') {
    const comment = post.comments.find(c => c.id === commentId);
    if (comment) comment.text = newText;
  } else if (type === 'reply') {
    const comment = post.comments.find(c => c.id === commentId);
    if (comment) {
      const reply = comment.replies.find(r => r.id === replyId);
      if (reply) reply.text = newText;
    }
  }

  await saveCloudData(STORAGE_POSTS, posts);
  closeEditModal();
  renderFeed();
}

function editPost(id) {
  getCloudData(STORAGE_POSTS).then(posts => {
    const post = (posts || []).find(p => p.id === id);
    if (!post) return;
    openEditModal('post', id, null, null, post.content);
  });
}

async function deletePost(id) {
  if (!confirm('ต้องการลบโพสต์นี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || [];
  let updatedPosts = posts.filter(p => String(p.id) !== String(id));
  await saveCloudData(STORAGE_POSTS, updatedPosts);
  renderFeed();
}

async function toggleLikePost(id) {
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === id);
  if (!post) return;
  post.likes = post.likes || [];
  const idx = post.likes.indexOf(currentUser.email);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(currentUser.email);
  
  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

async function addComment(postId) {
  const input = document.getElementById(`commentInput_${postId}`);
  const text = input.value.trim();
  if (!text) return;

  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  post.comments = post.comments || [];
  post.comments.push({
    id: 'cmt_' + Date.now(),
    email: currentUser.email,
    name: currentUser.name,
    text: text,
    likes: [],
    replies: []
  });

  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

function editComment(postId, commentId) {
  getCloudData(STORAGE_POSTS).then(posts => {
    const post = (posts || []).find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) return;
    openEditModal('comment', postId, commentId, null, comment.text);
  });
}

async function deleteComment(postId, commentId) {
  if (!confirm('ต้องการลบคอมเมนต์นี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  post.comments = post.comments.filter(c => c.id !== commentId);
  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

async function toggleLikeComment(postId, commentId) {
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  comment.likes = comment.likes || [];
  const idx = comment.likes.indexOf(currentUser.email);
  if (idx > -1) comment.likes.splice(idx, 1);
  else comment.likes.push(currentUser.email);
  
  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

function showReplyBox(postId, commentId) {
  const box = document.getElementById(`replyBox_${postId}_${commentId}`);
  if (box) {
    box.style.display = box.style.display === 'none' ? 'flex' : 'none';
  }
}

async function addReply(postId, commentId) {
  const input = document.getElementById(`replyInput_${postId}_${commentId}`);
  const text = input.value.trim();
  if (!text) return;

  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;

  comment.replies = comment.replies || [];
  comment.replies.push({
    id: 'rpl_' + Date.now(),
    email: currentUser.email,
    name: currentUser.name,
    text: text,
    likes: []
  });

  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

function editReply(postId, commentId, replyId) {
  getCloudData(STORAGE_POSTS).then(posts => {
    const post = (posts || []).find(p => p.id === postId);
    if (!post) return;
    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) return;
    const reply = comment.replies.find(r => r.id === replyId);
    if (!reply) return;
    openEditModal('reply', postId, commentId, replyId, reply.text);
  });
}

async function deleteReply(postId, commentId, replyId) {
  if (!confirm('ต้องการลบการตอบกลับนี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  comment.replies = comment.replies.filter(r => r.id !== replyId);
  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

async function toggleLikeReply(postId, commentId, replyId) {
  let posts = await getCloudData(STORAGE_POSTS) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  const reply = comment.replies.find(r => r.id === replyId);
  if (!reply) return;
  reply.likes = reply.likes || [];
  const idx = reply.likes.indexOf(currentUser.email);
  if (idx > -1) reply.likes.splice(idx, 1);
  else reply.likes.push(currentUser.email);
  
  await saveCloudData(STORAGE_POSTS, posts);
  renderFeed();
}

async function reportItem(targetType, targetId) {
  let reports = await getCloudData(STORAGE_REPORTS) || [];
  reports.push({
    id: 'rep_' + Date.now(),
    reporter: currentUser.email,
    targetType,
    targetId,
    createdAt: new Date().toLocaleString()
  });
  await saveCloudData(STORAGE_REPORTS, reports);
  alert('ส่งรายงานให้แอดมินเรียบร้อย!');
}

async function openUserProfileModal(userEmail) {
  if (!userEmail) return;
  if (userEmail === currentUser.email) {
    openMyProfileModal();
    return;
  }

  let users = await getCloudData(STORAGE_USERS) || [];
  const targetUser = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
  if (!targetUser) return alert('ไม่พบข้อมูลผู้ใช้นี้');

  viewTargetUser = targetUser;

  const avatarContainer = document.getElementById('viewProfileAvatar');
  if (targetUser.customImg) {
    avatarContainer.innerHTML = `<img src="${targetUser.customImg}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    avatarContainer.style.background = targetUser.avatar ? targetUser.avatar.bg : '#7A9A83';
    avatarContainer.innerHTML = `<i class="fa-solid ${targetUser.avatar ? targetUser.avatar.icon : 'fa-user'}"></i>`;
  }

  document.getElementById('viewProfileName').innerText = targetUser.name;
  document.getElementById('viewProfileEmail').innerText = targetUser.email;
  const isOnline = targetUser.lastActive && (Date.now() - targetUser.lastActive < 180000);
  document.getElementById('viewProfileOnlineStatus').className = `online-dot ${isOnline ? 'online' : 'offline'}`;
  document.getElementById('viewProfileStatusText').innerText = isOnline ? 'กำลังออนไลน์' : 'ออฟไลน์';
  document.getElementById('viewProfileBio').innerText = targetUser.bio || 'ไม่มีข้อความแนะนำตัว';

  const followers = targetUser.followers || [];
  const following = targetUser.following || [];
  document.getElementById('viewProfileFollowersCount').innerText = followers.length;
  document.getElementById('viewProfileFollowingCount').innerText = following.length;

  const btnFollow = document.getElementById('btnFollowUser');
  btnFollow.innerText = followers.includes(currentUser.email) ? 'ยกเลิกการติดตาม' : 'ติดตาม';

  let decks = await getCloudData(STORAGE_DECKS) || [];
  const userDecks = decks.filter(d => d.authorEmail && d.authorEmail.toLowerCase() === targetUser.email.toLowerCase() && d.privacy !== 'private');
  
  const decksListEl = document.getElementById('viewUserDecksList');
  if (userDecks.length === 0) {
    decksListEl.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">ผู้ใช้นี้ยังไม่มีสำรับสาธารณะ</p>`;
  } else {
    decksListEl.innerHTML = userDecks.map(d => `
      <div style="background:var(--bg-main); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:14px;">${d.name}</strong>
          <p style="font-size:11px; color:var(--text-muted);">การ์ด ${d.cards ? d.cards.length : 0} ใบ</p>
        </div>
        <button class="btn-primary" style="width:auto; padding:4px 12px; font-size:12px;" onclick="startStudy('${d.id}')">เข้าใช้</button>
      </div>
    `).join('');
  }

  let posts = await getCloudData(STORAGE_POSTS) || [];
  const userPosts = posts.filter(p => p.authorEmail && p.authorEmail.toLowerCase() === targetUser.email.toLowerCase());
  const postsListEl = document.getElementById('viewUserPostsList');
  if (userPosts.length === 0) {
    postsListEl.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">ผู้ใช้นี้ยังไม่มีโพสต์</p>`;
  } else {
    postsListEl.innerHTML = userPosts.map(p => `
      <div style="background:var(--bg-main); padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px;">
        <p style="white-space:pre-line;">${p.content}</p>
        <span style="font-size:10px; color:var(--text-muted);">${p.createdAt}</span>
      </div>
    `).join('');
  }

  document.getElementById('userProfileModal').style.display = 'flex';
}

function closeUserProfileModal() {
  document.getElementById('userProfileModal').style.display = 'none';
}

async function toggleFollowUser() {
  if (!viewTargetUser) return;
  let users = await getCloudData(STORAGE_USERS) || [];

  let target = users.find(u => u.email === viewTargetUser.email);
  let me = users.find(u => u.email === currentUser.email);

  target.followers = target.followers || [];
  me.following = me.following || [];

  const idx = target.followers.indexOf(currentUser.email);
  if (idx > -1) {
    target.followers.splice(idx, 1);
    me.following.splice(me.following.indexOf(target.email), 1);
  } else {
    target.followers.push(currentUser.email);
    me.following.push(target.email);
  }

  await saveCloudData(STORAGE_USERS, users);
  currentUser = me;
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));
  openUserProfileModal(target.email);
}

function openChatWithUser() {
  if (!viewTargetUser) return;
  closeUserProfileModal();
  activeChatEmail = viewTargetUser.email;
  document.getElementById('chatTargetName').innerText = `แชทกับ: ${viewTargetUser.name}`;
  renderChatMessages();
  document.getElementById('chatModal').style.display = 'flex';
}

async function renderChatUsersList() {
  let users = await getCloudData(STORAGE_USERS) || [];
  const list = document.getElementById('chatUsersList');
  const otherUsers = users.filter(u => u.email !== currentUser.email);
  const now = Date.now();

  if (otherUsers.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);">ยังไม่มีผู้ใช้อื่นในระบบ</p>`;
    return;
  }

  list.innerHTML = otherUsers.map(u => {
    const isOnline = u.lastActive && (now - u.lastActive < 180000);
    return `
      <div style="background:white; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="online-dot ${isOnline ? 'online' : 'offline'}"></span>
          <div>
            <strong>${u.name}</strong>
            <p style="font-size: 11px; color: var(--text-muted);">${isOnline ? '🟢 กำลังออนไลน์' : '⚪ ออฟไลน์'}</p>
          </div>
        </div>
        <button class="btn-primary" style="width:auto; padding:6px 14px; font-size:12px;" onclick="openUserProfileModal('${u.email}')">ดูโปรไฟล์ / แชท</button>
      </div>
    `;
  }).join('');
}

async function renderChatMessages() {
  let chats = await getCloudData(STORAGE_CHATS) || {};
  const chatKey = [currentUser.email, activeChatEmail].sort().join('_');
  const messages = chats[chatKey] || [];

  const box = document.getElementById('chatMessagesBox');
  box.innerHTML = messages.map(m => `
    <div class="chat-bubble ${m.sender === currentUser.email ? 'chat-me' : 'chat-other'}">
      ${m.text}
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !activeChatEmail) return;

  let chats = await getCloudData(STORAGE_CHATS) || {};
  const chatKey = [currentUser.email, activeChatEmail].sort().join('_');
  chats[chatKey] = chats[chatKey] || [];

  chats[chatKey].push({
    sender: currentUser.email,
    text,
    timestamp: Date.now()
  });

  await saveCloudData(STORAGE_CHATS, chats);
  input.value = '';
  renderChatMessages();
}

function closeChatModal() {
  document.getElementById('chatModal').style.display = 'none';
}

function openMyProfileModal() {
  const avatarContainer = document.getElementById('myModalAvatar');
  if (currentUser.customImg) {
    avatarContainer.innerHTML = `<img src="${currentUser.customImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarContainer.style.background = currentUser.avatar ? currentUser.avatar.bg : '#7A9A83';
    avatarContainer.innerHTML = `<i class="fa-solid ${currentUser.avatar ? currentUser.avatar.icon : 'fa-user'}"></i>`;
  }

  document.getElementById('myModalName').innerText = currentUser.name;
  document.getElementById('myModalEmail').innerText = currentUser.email;
  document.getElementById('inputBio').value = currentUser.bio || '';
  document.getElementById('myProfileModal').style.display = 'flex';
}

function closeMyProfileModal() {
  document.getElementById('myProfileModal').style.display = 'none';
}

async function saveProfileChanges() {
  const newBio = document.getElementById('inputBio').value.trim();
  const fileInput = document.getElementById('inputNewAvatarFile');

  let users = await getCloudData(STORAGE_USERS) || [];
  let idx = users.findIndex(u => u.email === currentUser.email);

  if (idx !== -1) {
    users[idx].bio = newBio;

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        users[idx].customImg = e.target.result;
        users[idx].avatarStatus = 'pending';

        await saveCloudData(STORAGE_USERS, users);
        currentUser = users[idx];
        localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));

        alert('บันทึกโปรไฟล์เรียบร้อย! รูปภาพโปรไฟล์ใหม่กำลังรอแอดมินอนุมัติ (ใช้เวลา 1-2 วัน)');
        closeMyProfileModal();
        updateProfileDisplay();
      };
      reader.readAsDataURL(fileInput.files[0]);
      return;
    }

    await saveCloudData(STORAGE_USERS, users);
    currentUser = users[idx];
    localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));

    alert('บันทึกโปรไฟล์เรียบร้อยแล้ว');
    closeMyProfileModal();
    updateProfileDisplay();
  }
}

async function renderAdminDashboard() {
  if (!currentUser || !currentUser.isAdmin) return;
  let users = await getCloudData(STORAGE_USERS) || [];
  let reports = await getCloudData(STORAGE_REPORTS) || [];
  let posts = await getCloudData(STORAGE_POSTS) || [];
  let decks = await getCloudData(STORAGE_DECKS) || [];
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  const container = document.getElementById('adminContainer');

  const pendingUsers = users.filter(u => u.customImg && u.avatarStatus === 'pending');

  container.innerHTML = `
    <div style="background:white; padding:20px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:20px;">
      <h3><i class="fa-solid fa-user-check"></i> รูปโปรไฟล์รออนุมัติ (${pendingUsers.length})</h3>
      ${pendingUsers.length === 0 ? '<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">ไม่มีรูปที่รออนุมัติ</p>' : ''}
      ${pendingUsers.map(u => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:10px; background:var(--bg-main); border-radius:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${u.customImg}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <span><strong>${u.name}</strong> (${u.email})</span>
          </div>
          <button class="btn-primary" style="width:auto; padding:6px 12px; font-size:12px;" onclick="approveAvatar('${u.email}')">อนุมัติรูป</button>
        </div>
      `).join('')}
    </div>

    <div style="background:white; padding:20px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
      <h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-terracotta);"></i> รายการถูกรายงาน (${reports.length})</h3>
      ${reports.length === 0 ? '<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">ไม่มีรายการที่ถูกรายงานเข้ามา</p>' : ''}
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
        ${reports.map(r => {
          let detailText = 'ไม่พบเนื้อหา (อาจถูกลบไปแล้ว)';
          
          if (r.targetType === 'post') {
            const p = posts.find(item => item.id === r.targetId);
            if (p) detailText = `<strong>โพสต์ของ ${p.authorName}:</strong> "${p.content}"`;
          } else if (r.targetType === 'deck') {
            const d = decks.find(item => item.id === r.targetId);
            if (d) detailText = `<strong>สำรับแฟลชการ์ดของ ${d.authorName}:</strong> "${d.name}"`;
          } else if (r.targetType === 'quiz') {
            const q = quizzes.find(item => item.id === r.targetId);
            if (q) detailText = `<strong>ชุดข้อสอบของ ${q.authorName}:</strong> "${q.title}"`;
          } else if (r.targetType === 'comment') {
            for (let p of posts) {
              const c = p.comments ? p.comments.find(item => item.id === r.targetId) : null;
              if (c) { detailText = `<strong>คอมเมนต์ของ ${c.name}:</strong> "${c.text}"`; break; }
            }
          }

          return `
            <div style="padding:12px; background:var(--bg-main); border-radius:8px; border:1px solid var(--border-subtle);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <div>
                  <span style="font-size:11px; background:var(--accent-terracotta); color:white; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${r.targetType}</span>
                  <span style="font-size:12px; color:var(--text-muted); margin-left:6px;">รายงานโดย: ${r.reporter} (${r.createdAt})</span>
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn-primary" style="width:auto; padding:4px 10px; font-size:11px; background:#D9534F;" onclick="deleteReportedItem('${r.id}', '${r.targetType}', '${r.targetId}')">
                    <i class="fa-solid fa-trash"></i> ลบเนื้อหานี้
                  </button>
                  <button class="btn-secondary" style="width:auto; padding:4px 10px; font-size:11px;" onclick="dismissReport('${r.id}')">
                    ยกเลิกรายงาน
                  </button>
                </div>
              </div>
              <p style="font-size:13px; color:var(--text-main); margin-top:4px;">${detailText}</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function deleteReportedItem(reportId, targetType, targetId) {
  if (!confirm('ยืนยันลบเนื้อหานี้ทิ้งตามที่มีผู้รายงานใช่หรือไม่?')) return;

  let posts = await getCloudData(STORAGE_POSTS) || [];
  let decks = await getCloudData(STORAGE_DECKS) || [];
  let quizzes = await getCloudData(STORAGE_QUIZZES) || [];
  let reports = await getCloudData(STORAGE_REPORTS) || [];

  if (targetType === 'post') {
    posts = posts.filter(p => p.id !== targetId);
    await saveCloudData(STORAGE_POSTS, posts);
  } else if (targetType === 'deck') {
    decks = decks.filter(d => d.id !== targetId);
    await saveCloudData(STORAGE_DECKS, decks);
  } else if (targetType === 'quiz') {
    quizzes = quizzes.filter(q => q.id !== targetId);
    await saveCloudData(STORAGE_QUIZZES, quizzes);
  }

  reports = reports.filter(r => r.id !== reportId);
  await saveCloudData(STORAGE_REPORTS, reports);

  alert('ลบเนื้อหาและจัดการรายงานเรียบร้อยแล้ว');
  renderAdminDashboard();
}

async function dismissReport(reportId) {
  let reports = await getCloudData(STORAGE_REPORTS) || [];
  reports = reports.filter(r => r.id !== reportId);
  await saveCloudData(STORAGE_REPORTS, reports);
  renderAdminDashboard();
}

async function approveAvatar(email) {
  let users = await getCloudData(STORAGE_USERS) || [];
  let u = users.find(x => x.email === email);
  if (u) {
    u.avatarStatus = 'approved';
    await saveCloudData(STORAGE_USERS, users);
    alert('อนุมัติรูปเรียบร้อย');
    renderAdminDashboard();
  }
}

function openTermsModal(e) {
  e.preventDefault();
  document.getElementById('termsModal').style.display = 'flex';
}
function closeTermsModal(e) {
  e.preventDefault();
  document.getElementById('termsModal').style.display = 'none';
}