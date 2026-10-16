const STORAGE_USERS = 'Learnful_flash_users';
const STORAGE_CURRENT_USER = 'Learnful_flash_session';
const STORAGE_DECKS = 'Learnful_flash_decks_';
const STORAGE_POSTS = 'Learnful_flash_posts';
const STORAGE_REPORTS = 'Learnful_flash_reports';
const STORAGE_CHATS = 'Learnful_flash_chats';

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

const AVATAR_OPTIONS = [
  { icon: 'fa-user', bg: '#7A9A83' },
  { icon: 'fa-cat', bg: '#D97757' },
  { icon: 'fa-seedling', bg: '#8A9A86' },
  { icon: 'fa-book-open', bg: '#B8860B' },
  { icon: 'fa-heart', bg: '#C27BA0' }
];

async function getCloudData(path) {
  try {
    const docRef = db.collection('learnful_cloud_data').doc(path);
    const doc = await docRef.get();
    if (doc.exists) {
      return doc.data().value;
    }
    return null;
  } catch (error) {
    console.error("Error getting cloud data: ", error);
    return null;
  }
}

async function saveCloudData(path, data) {
  try {
    const docRef = db.collection('learnful_cloud_data').doc(path);
    await docRef.set({ value: data });
  } catch (error) {
    console.error("Error saving cloud data: ", error);
  }
}

async function ensureAdminAccount() {
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
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
      following: []
    });
    await saveCloudData(STORAGE_USERS, users);
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  }
}
ensureAdminAccount();

document.addEventListener('DOMContentLoaded', () => {
  renderAvatarPicker();
  checkSession();
});

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
  
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');

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
      following: []
    };
    
    users.push(newUser);
    await saveCloudData(STORAGE_USERS, users);
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    loginUser(newUser);
  } else {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    loginUser(user);
  }
}

function loginUser(user) {
  currentUser = user;
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';

  if (currentUser.isAdmin) {
    document.getElementById('btnNavAdmin').style.display = 'inline-block';
  }
  updateProfileDisplay();
  loadDecks();
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

  if (tabName === 'dashboard') {
    document.getElementById('tab-dashboard').style.display = 'block';
  } else if (tabName === 'decks') {
    document.getElementById('tab-decks').style.display = 'block';
    loadDecks();
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

async function loadDecks(searchKeyword = '') {
  const path = STORAGE_DECKS + currentUser.email;
  const decks = await getCloudData(path) || JSON.parse(localStorage.getItem(path) || '[]');
  const grid = document.getElementById('decksGrid');

  const filteredDecks = decks.filter(d => d.name.toLowerCase().includes(searchKeyword.toLowerCase()));

  if (filteredDecks.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">ไม่พบสำรับคำศัพท์ กดปุ่ม "สร้างสำรับใหม่" เพื่อเริ่มต้นได้เลย</p>`;
    return;
  }

  grid.innerHTML = filteredDecks.map(d => `
    <div class="deck-card">
      <h3>${d.name}</h3>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">จำนวนการ์ด: ${d.cards ? d.cards.length : 0} ใบ | เข้าใช้แล้ว: ${d.viewCount || 0} ครั้ง</p>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" onclick="startStudy('${d.id}')">เริ่มเรียน</button>
        <button class="btn-secondary" onclick="deleteDeck('${d.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function filterDecks() {
  const kw = document.getElementById('deckSearchInput').value.trim();
  loadDecks(kw);
}

function openCreateDeckModal() {
  tempDeckCards = [];
  tempCardImage = null;
  document.getElementById('newDeckNameInput').value = '';
  document.getElementById('newCardQ').value = '';
  document.getElementById('newCardA').value = '';
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
  if (!name) return alert('กรุณาตั้งชื่อสำรับคำศัพท์');
  if (tempDeckCards.length === 0) return alert('กรุณาเพิ่มการ์ดอย่างน้อย 1 ใบ');

  const path = STORAGE_DECKS + currentUser.email;
  let decks = await getCloudData(path) || JSON.parse(localStorage.getItem(path) || '[]');
  decks.push({
    id: 'deck_' + Date.now(),
    name,
    cards: tempDeckCards,
    viewCount: 0
  });
  
  await saveCloudData(path, decks);
  localStorage.setItem(path, JSON.stringify(decks));
  closeCreateDeckModal();
  loadDecks();
}

async function deleteDeck(id) {
  if (!confirm('ยืนยันลบสำรับนี้?')) return;
  const path = STORAGE_DECKS + currentUser.email;
  let decks = await getCloudData(path) || JSON.parse(localStorage.getItem(path) || '[]');
  decks = decks.filter(d => d.id !== id);
  
  await saveCloudData(path, decks);
  localStorage.setItem(path, JSON.stringify(decks));
  loadDecks();
}

async function startStudy(deckId, ownerEmail = null) {
  const targetEmail = ownerEmail || currentUser.email;
  const path = STORAGE_DECKS + targetEmail;
  let decks = await getCloudData(path) || JSON.parse(localStorage.getItem(path) || '[]');
  const deck = decks.find(d => d.id === deckId);
  if (!deck || !deck.cards || deck.cards.length === 0) return alert('สำรับนี้ไม่มีการ์ดคำศัพท์');

  deck.viewCount = (deck.viewCount || 0) + 1;
  await saveCloudData(path, decks);
  localStorage.setItem(path, JSON.stringify(decks));

  currentStudyDeck = deck;
  studyQueue = [...deck.cards];
  studyIndex = 0;
  isShowingAnswer = false;

  document.getElementById('studyDeckTitle').innerText = deck.name;
  document.getElementById('studyViewerCount').innerHTML = `<i class="fa-solid fa-users"></i> เข้าใช้งานแล้ว ${deck.viewCount} คน`;
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

function rateCard(rating) {
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

  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
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

  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
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
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  
  const isMyComment = currentUser && (
    (commentEmail && myEmail === commentEmail) || 
    (!c.email && c.name === currentUser.name)
  );
  
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
        const isMyReply = currentUser && (
          (replyEmail && myEmail === replyEmail) || 
          (!r.email && r.name === currentUser.name)
        );
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
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  closeEditModal();
  renderFeed();
}

function editPost(id) {
  let posts = JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === id);
  if (!post) return;
  openEditModal('post', id, null, null, post.content);
}

async function deletePost(id) {
  if (!confirm('ต้องการลบโพสต์นี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  let updatedPosts = posts.filter(p => String(p.id) !== String(id));
  
  await saveCloudData(STORAGE_POSTS, updatedPosts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(updatedPosts));
  renderFeed();
}

async function toggleLikePost(id) {
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === id);
  if (!post) return;
  post.likes = post.likes || [];
  const idx = post.likes.indexOf(currentUser.email);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(currentUser.email);
  
  await saveCloudData(STORAGE_POSTS, posts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

async function addComment(postId) {
  const input = document.getElementById(`commentInput_${postId}`);
  const text = input.value.trim();
  if (!text) return;

  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

function editComment(postId, commentId) {
  let posts = JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  openEditModal('comment', postId, commentId, null, comment.text);
}

async function deleteComment(postId, commentId) {
  if (!confirm('ต้องการลบคอมเมนต์นี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  post.comments = post.comments.filter(c => c.id !== commentId);
  
  await saveCloudData(STORAGE_POSTS, posts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

async function toggleLikeComment(postId, commentId) {
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  comment.likes = comment.likes || [];
  const idx = comment.likes.indexOf(currentUser.email);
  if (idx > -1) comment.likes.splice(idx, 1);
  else comment.likes.push(currentUser.email);
  
  await saveCloudData(STORAGE_POSTS, posts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
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

  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

function editReply(postId, commentId, replyId) {
  let posts = JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  const reply = comment.replies.find(r => r.id === replyId);
  if (!reply) return;
  openEditModal('reply', postId, commentId, replyId, reply.text);
}

async function deleteReply(postId, commentId, replyId) {
  if (!confirm('ต้องการลบการตอบกลับนี้ใช่ไหม?')) return;
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;
  comment.replies = comment.replies.filter(r => r.id !== replyId);
  
  await saveCloudData(STORAGE_POSTS, posts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

async function toggleLikeReply(postId, commentId, replyId) {
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  renderFeed();
}

async function reportItem(targetType, targetId) {
  let reports = await getCloudData(STORAGE_REPORTS) || JSON.parse(localStorage.getItem(STORAGE_REPORTS) || '[]');
  reports.push({
    id: 'rep_' + Date.now(),
    reporter: currentUser.email,
    targetType,
    targetId,
    createdAt: new Date().toLocaleString()
  });
  await saveCloudData(STORAGE_REPORTS, reports);
  localStorage.setItem(STORAGE_REPORTS, JSON.stringify(reports));
  alert('ส่งรายงานให้แอดมินเรียบร้อย! แอดมินจะใช้เวลาตรวจสอบและดำเนินการภายใน 1-2 วัน');
}

async function openUserProfileModal(userEmail) {
  if (!userEmail) return;
  if (userEmail === currentUser.email) {
    openMyProfileModal();
    return;
  }

  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
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
  document.getElementById('viewProfileBio').innerText = targetUser.bio || 'ไม่มีข้อความแนะนำตัว';

  const followers = targetUser.followers || [];
  const following = targetUser.following || [];
  document.getElementById('viewProfileFollowersCount').innerText = followers.length;
  document.getElementById('viewProfileFollowingCount').innerText = following.length;

  const btnFollow = document.getElementById('btnFollowUser');
  btnFollow.innerText = followers.includes(currentUser.email) ? 'ยกเลิกการติดตาม' : 'ติดตาม';

  const decksPath = STORAGE_DECKS + targetUser.email;
  const decks = await getCloudData(decksPath) || JSON.parse(localStorage.getItem(decksPath) || '[]');
  const decksListEl = document.getElementById('viewUserDecksList');
  if (decks.length === 0) {
    decksListEl.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">ผู้ใช้นี้ยังไม่ได้เปิดใช้งานแฟลชการ์ด</p>`;
  } else {
    decksListEl.innerHTML = decks.map(d => `
      <div style="background:var(--bg-main); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:14px;">${d.name}</strong>
          <p style="font-size:11px; color:var(--text-muted);">การ์ด ${d.cards ? d.cards.length : 0} ใบ</p>
        </div>
        <button class="btn-primary" style="width:auto; padding:4px 12px; font-size:12px;" onclick="startStudy('${d.id}', '${targetUser.email}')">เข้าใช้ฟรี</button>
      </div>
    `).join('');
  }

  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');

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
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
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
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  const list = document.getElementById('chatUsersList');
  const otherUsers = users.filter(u => u.email !== currentUser.email);

  if (otherUsers.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);">ยังไม่มีผู้ใช้อื่นในระบบ</p>`;
    return;
  }

  list.innerHTML = otherUsers.map(u => `
    <div style="background:white; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>${u.name}</strong>
        <p style="font-size:12px; color:var(--text-muted);">${u.email}</p>
      </div>
      <button class="btn-primary" style="width:auto; padding:6px 14px; font-size:12px;" onclick="openUserProfileModal('${u.email}')">ดูโปรไฟล์ / แชท</button>
    </div>
  `).join('');
}

async function renderChatMessages() {
  let chats = await getCloudData(STORAGE_CHATS) || JSON.parse(localStorage.getItem(STORAGE_CHATS) || '{}');
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

  let chats = await getCloudData(STORAGE_CHATS) || JSON.parse(localStorage.getItem(STORAGE_CHATS) || '{}');
  const chatKey = [currentUser.email, activeChatEmail].sort().join('_');
  chats[chatKey] = chats[chatKey] || [];

  chats[chatKey].push({
    sender: currentUser.email,
    text,
    timestamp: Date.now()
  });

  await saveCloudData(STORAGE_CHATS, chats);
  localStorage.setItem(STORAGE_CHATS, JSON.stringify(chats));
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

  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  let idx = users.findIndex(u => u.email === currentUser.email);

  if (idx !== -1) {
    users[idx].bio = newBio;

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        users[idx].customImg = e.target.result;
        users[idx].avatarStatus = 'pending';

        await saveCloudData(STORAGE_USERS, users);
        localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
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
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    currentUser = users[idx];
    localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));

    alert('บันทึกโปรไฟล์เรียบร้อยแล้ว');
    closeMyProfileModal();
    updateProfileDisplay();
  }
}

async function renderAdminDashboard() {
  if (!currentUser || !currentUser.isAdmin) return;
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  let reports = await getCloudData(STORAGE_REPORTS) || JSON.parse(localStorage.getItem(STORAGE_REPORTS) || '[]');
  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
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
          } else if (r.targetType === 'comment') {
            for (let p of posts) {
              const c = p.comments ? p.comments.find(item => item.id === r.targetId) : null;
              if (c) { detailText = `<strong>คอมเมนต์ของ ${c.name}:</strong> "${c.text}"`; break; }
            }
          } else if (r.targetType === 'reply') {
            for (let p of posts) {
              if (p.comments) {
                for (let c of p.comments) {
                  const reply = c.replies ? c.replies.find(item => item.id === r.targetId) : null;
                  if (reply) { detailText = `<strong>ตอบกลับของ ${reply.name}:</strong> "${reply.text}"`; break; }
                }
              }
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

  let posts = await getCloudData(STORAGE_POSTS) || JSON.parse(localStorage.getItem(STORAGE_POSTS) || '[]');
  let reports = await getCloudData(STORAGE_REPORTS) || JSON.parse(localStorage.getItem(STORAGE_REPORTS) || '[]');

  if (targetType === 'post') {
    posts = posts.filter(p => p.id !== targetId);
  } else if (targetType === 'comment') {
    posts.forEach(p => {
      if (p.comments) p.comments = p.comments.filter(c => c.id !== targetId);
    });
  } else if (targetType === 'reply') {
    posts.forEach(p => {
      if (p.comments) {
        p.comments.forEach(c => {
          if (c.replies) c.replies = c.replies.filter(r => r.id !== targetId);
        });
      }
    });
  }

  reports = reports.filter(r => r.id !== reportId);

  await saveCloudData(STORAGE_POSTS, posts);
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
  await saveCloudData(STORAGE_REPORTS, reports);
  localStorage.setItem(STORAGE_REPORTS, JSON.stringify(reports));

  alert('ลบเนื้อหาและจัดการรายงานเรียบร้อยแล้ว');
  renderAdminDashboard();
  renderFeed();
}

async function dismissReport(reportId) {
  let reports = await getCloudData(STORAGE_REPORTS) || JSON.parse(localStorage.getItem(STORAGE_REPORTS) || '[]');
  reports = reports.filter(r => r.id !== reportId);
  await saveCloudData(STORAGE_REPORTS, reports);
  localStorage.setItem(STORAGE_REPORTS, JSON.stringify(reports));
  renderAdminDashboard();
}

async function approveAvatar(email) {
  let users = await getCloudData(STORAGE_USERS) || JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  let u = users.find(x => x.email === email);
  if (u) {
    u.avatarStatus = 'approved';
    await saveCloudData(STORAGE_USERS, users);
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
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