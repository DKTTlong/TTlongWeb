// js/app.js
import * as Auth from './auth.js';
import * as Data from './data.js';
// ⬇️ 新增：导入 supabase 实例，用于 storage 操作
import { supabase } from './data.js'; 
import { QWEN_API_KEY, QWEN_MODEL, QWEN_API_URL } from './config.js';

// 全局状态
let currentUser = null;
let isPasswordMode = false;

// DOM 元素缓存
const UI = {
    fabBtn: document.getElementById('fabButton'),
    publishModal: document.getElementById('publishModal'),
    authModal: document.getElementById('authModal'),
    closeModals: document.querySelectorAll('.close-modal'),
    goLoginBtn: document.getElementById('goLoginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // 用户信息展示
    userInfo: document.getElementById('userInfo'),
    userNameDisplay: document.getElementById('userNameDisplay'),
    myUsername: document.getElementById('myUsername'),
    myEmail: document.getElementById('myEmail'),
    myAvatar: document.getElementById('myAvatar'),
    loginPrompt: document.getElementById('loginPrompt'),
    myWishList: document.getElementById('myWishList'),

    // 表单输入
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    usernameInput: document.getElementById('usernameInput'),
    wishInput: document.getElementById('wishInput'),
    
    // 按钮与提示
    authActionBtn: document.getElementById('authActionBtn'),
    toggleAuthModeBtn: document.getElementById('toggleAuthModeBtn'),
    authMessage: document.getElementById('authMessage'),
    addWishBtn: document.getElementById('addWishBtn'),
    
    // 视图
    homeView: document.getElementById('home-view'),
    myView: document.getElementById('my-view'),
    tabItems: document.querySelectorAll('.tab-item'),
	
	// ⬇️ 新增：发现页相关元素
    discoverView: document.getElementById('discover-view'),
    randomCard: document.getElementById('randomCard'),
    randomPlaceholder: document.getElementById('randomPlaceholder'),
    randomContent: document.getElementById('randomContent'),
    randomUser: document.getElementById('randomUser'),
    randomText: document.getElementById('randomText'),
    randomDate: document.getElementById('randomDate'),
    drawAgainBtn: document.getElementById('drawAgainBtn'),
	
	// ⬇️ 新增：AI 视图相关元素
    aiView: document.getElementById('ai-view'),
    chatHistory: document.getElementById('chatHistory'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    typingIndicator: document.getElementById('typingIndicator'), // 如果需要可以加一个 loading 元素
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🌟 许愿星 App 启动");
    
    // 1. 检查初始会话
    await initAuth();
    
    // 2. 绑定事件
    bindEvents();
    
    // 3. 加载首页数据
    loadHomeWishes();
});

// ⬇️ 新增：在 UI 对象中增加个人资料相关的元素引用
// 确保你的 HTML 中有 id="profileAvatar", id="profileUsernameInput", id="saveProfileBtn", id="avatarFileInput"
const ProfileUI = {
    avatarImg: document.getElementById('myAvatar'), // 复用原来的头像显示区，或者新建一个
    usernameInput: document.getElementById('profileUsernameInput'), // 个人中心里的昵称输入框
    avatarInput: document.getElementById('avatarFileInput'),        // 文件选择框
    saveBtn: document.getElementById('saveProfileBtn'),             // 保存按钮
    avatarPreview: document.getElementById('avatarPreview')         // 上传前的预览图
};

// 初始化认证状态
async function initAuth() {
    try {
        const session = await Auth.getSession();
        if (session) {
            currentUser = session.user;
            updateUIForLoggedIn(currentUser);
        } else {
            updateUIForGuest();
        }

        // 监听后续变化 (如点击邮件链接回来)
        Auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                updateUIForLoggedIn(currentUser);
                loadHomeWishes(); // 刷新数据
                closeModal(UI.authModal);
                showMsg("登录成功！", "success");
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                updateUIForGuest();
            }
        });
    } catch (err) {
        console.error("初始化认证失败:", err);
        updateUIForGuest();
    }
}

function bindEvents() {
    console.log("🔧 开始绑定事件...");

    // --- 重点修复：FAB 按钮 (+号) ---
    const fabBtn = document.getElementById('fabButton');
    
    if (!fabBtn) {
        console.error("❌ 找不到 #fabButton");
    } else {
        // 1. 先移除旧监听器，防止重复绑定
        const newFabBtn = fabBtn.cloneNode(true);
        fabBtn.parentNode.replaceChild(newFabBtn, fabBtn);
        
        // 2. 重新获取并绑定
        const freshFabBtn = document.getElementById('fabButton');
        
        freshFabBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 阻止默认行为
            e.stopPropagation(); // 阻止冒泡
            console.log("🖱️ [SUCCESS] +号按钮被点击了！事件目标:", e.target);
            
            // 视觉反馈：点击时闪一下
            freshFabBtn.style.transform = "scale(0.9)";
            setTimeout(() => freshFabBtn.style.transform = "scale(1)", 150);

            if (!currentUser) {
                console.log("🔒 未登录 -> 打开登录框");
                openModal(UI.authModal);
            } else {
                console.log("🔓 已登录 -> 打开发布框");
                openModal(UI.publishModal);
            }
        });
        
        console.log("✅ +号按钮事件绑定成功 (已去重)");
    }

    // --- 关闭弹窗逻辑 ---
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) closeModal(modal);
        });
    });

    // --- 其他原有逻辑 ---
    UI.toggleAuthModeBtn?.addEventListener('click', toggleAuthMode);
    UI.authActionBtn?.addEventListener('click', handleAuthSubmit);
    UI.logoutBtn?.addEventListener('click', handleLogout);
    UI.addWishBtn?.addEventListener('click', handlePublishSubmit);
    
    if (ProfileUI.saveBtn) {
        ProfileUI.saveBtn.addEventListener('click', handleProfileUpdate);
    }

    // --- Tab 切换逻辑 ---
    document.querySelectorAll('.tab-item').forEach(item => {
        item.addEventListener('click', () => {
            // 特殊处理：如果点击的是中间的 "+" (假如你以后加在 tab 里)
            // 目前你的 tab 只有 home, discover, msg, my
            const tabName = item.getAttribute('data-tab');
            
            // 移除所有 active
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            
            switchView(tabName);
        });
    });

	// ⬇️ 新增：绑定“再抽一次”事件
	// 在 bindEvents 函数中，添加以下代码：
	if (UI.drawAgainBtn) {
		UI.drawAgainBtn.addEventListener('click', (e) => {
			e.stopPropagation(); // 防止触发卡片的点击
			drawRandomWish();
		});
	}

	// 也可以让点击整个卡片也能抽取
	if (UI.randomCard) {
		UI.randomCard.addEventListener('click', () => {
			// 如果内容已经显示，点击卡片也可以重抽，或者只做视觉反馈
			// 这里设定为：只要点了就重抽
			drawRandomWish();
		});
	}
	
	// ⬇️ 新增：AI 发送按钮事件
    if (UI.sendBtn) {
        UI.sendBtn.addEventListener('click', handleSendChat);
    }
    
    // 支持回车发送
    if (UI.chatInput) {
        UI.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendChat();
        });
    }
    console.log("🏁 所有事件绑定完成。");
}

// ✅ 修改 updateUIForLoggedIn：加载用户资料并同步到全局状态
async function updateUIForLoggedIn(user) {
    const userId = user.id;
    
    // 1. 先显示基础信息 (防闪烁)
    const defaultName = user.email?.split('@')[0] || '用户';
    if (UI.userInfo) UI.userInfo.style.display = 'flex';
    if (UI.userNameDisplay) UI.userNameDisplay.textContent = defaultName;
    if (UI.loginPrompt) UI.loginPrompt.style.display = 'none';
    if (UI.goLoginBtn) UI.goLoginBtn.style.display = 'none';
    if (UI.logoutBtn) UI.logoutBtn.style.display = 'block';
    
    // 2. 从 profiles 表获取详细资料 (昵称 + 头像)
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', userId)
            .single();

        if (!error && profile) {
            // 🔥 关键修复：将最新昵称同步到全局 currentUser 对象
            // 这样其他地方读取 currentUser.username 就能拿到最新值了
            currentUser.username = profile.username || defaultName; 
            
            const finalName = currentUser.username;
            const finalAvatar = profile.avatar_url || '<i class="fas fa-user" style="font-size:30px;color:#333;"></i>';

            // 更新顶部导航栏
            if (UI.userNameDisplay) UI.userNameDisplay.textContent = finalName;
            if (UI.myUsername) UI.myUsername.textContent = finalName;
            
            // 更新个人中心头像
            if (UI.myAvatar) {
                if (profile.avatar_url) {
                    UI.myAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">`;
                } else {
                    UI.myAvatar.innerHTML = '<i class="fas fa-user" style="font-size:30px;color:#333;"></i>';
                }
            }

            // 填充个人中心的编辑表单
            if (ProfileUI.usernameInput) ProfileUI.usernameInput.value = finalName;
            if (ProfileUI.avatarPreview && profile.avatar_url) {
                ProfileUI.avatarPreview.src = profile.avatar_url;
                ProfileUI.avatarPreview.style.display = 'block';
            }
        } else {
            // 如果没查到 profile，至少把 email 前缀同步进去
            currentUser.username = defaultName;
        }
    } catch (err) {
        console.error("加载个人资料失败:", err);
        // 出错时也保底设置一个名字
        currentUser.username = defaultName;
    }
}

// ✅ 新增：处理个人资料保存 (昵称 + 头像上传)
// ✅ 修复版：带详细调试日志的个人资料更新函数
async function handleProfileUpdate() {
    console.log("🔍 [调试] 开始更新资料...");

    // 1. 严格检查用户状态
    if (!currentUser) {
        console.error("❌ 错误：currentUser 为空");
        return alert("请先登录！(用户对象为空)");
    }
    
    if (!currentUser.id) {
        console.error("❌ 错误：currentUser.id 为空", currentUser);
        return alert("用户 ID 获取失败，请尝试重新登录。");
    }

    console.log("✅ 当前用户 ID:", currentUser.id);

    // 2. 获取输入值并检查 DOM 元素是否存在
    const usernameEl = ProfileUI.usernameInput;
    const fileEl = ProfileUI.avatarInput;

    if (!usernameEl) {
        console.error("❌ 错误：找不到 nickname 输入框 (id='profileUsernameInput')");
        return alert("系统错误：找不到昵称输入框，请检查 HTML。");
    }

    const newUsername = usernameEl.value.trim();
    const file = fileEl?.files[0];
    
    if (!newUsername) {
        return alert("昵称不能为空");
    }

    console.log("📝 新昵称:", newUsername);
    console.log("📁 是否有新图片:", !!file);

    setLoading(ProfileUI.saveBtn, true);

    try {
        let avatarUrl = null;

        // 3. 处理图片上传
        if (file) {
            console.log("⬆️ 开始上传图片...");
            const fileExt = file.name.split('.').pop();
            // 确保文件名安全
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error("❌ 上传失败:", uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
            console.log("✅ 图片上传成功，URL:", avatarUrl);
        }

        // 4. 准备更新数据
        const updateData = {
            username: newUsername,
            updated_at: new Date().toISOString()
        };
        if (avatarUrl) updateData.avatar_url = avatarUrl;

        console.log("💾 准备写入数据库:", updateData);
        console.log("🎯 匹配条件: id =", currentUser.id);

        // 5. 执行更新 (关键步骤)
        const { data: dbData, error: dbError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', currentUser.id)
            .select(); // ⭐️ 加上 .select() 可以返回更新后的数据，方便验证

        if (dbError) {
            console.error("❌ 数据库报错:", dbError);
            throw dbError;
        }

        // 6. 验证是否真的更新了
        console.log("📊 数据库返回结果:", dbData);
        
        if (!dbData || dbData.length === 0) {
            console.warn("⚠️ 警告：数据库操作成功，但没有返回任何行！");
            console.warn("这通常意味着 .eq('id', ...) 没有匹配到任何记录。");
            console.warn("请检查数据库中 profiles 表是否真的存在 id 为 " + currentUser.id + " 的记录。");
            
            // 尝试诊断：去查一下这条记录存不存在
            const { data: checkData } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', currentUser.id)
                .single();
            
            if (!checkData) {
                return alert("⚠️ 更新看似成功，但未找到您的档案记录！\n\n可能原因：您刚注册，触发器未生效。\n\n建议：请尝试注销后重新注册一次，或联系管理员手动创建档案。");
            }
        }

        alert("✨ 资料更新成功！");
        
        // 7. 刷新 UI
        await updateUIForLoggedIn(currentUser);

    } catch (err) {
        console.error("💥 全局捕获错误:", err);
        alert("更新失败：" + err.message);
    } finally {
        setLoading(ProfileUI.saveBtn, false);
    }
}

function updateUIForGuest() {
    if (UI.userInfo) UI.userInfo.style.display = 'none';
    if (UI.userNameDisplay) UI.userNameDisplay.textContent = '游客';
    if (UI.loginPrompt) UI.loginPrompt.style.display = 'block';
    if (UI.goLoginBtn) UI.goLoginBtn.style.display = 'block';
    if (UI.logoutBtn) UI.logoutBtn.style.display = 'none';
    if (UI.myUsername) UI.myUsername.textContent = '未登录';
    if (UI.myEmail) UI.myEmail.textContent = '';
    if (UI.myAvatar) UI.myAvatar.innerHTML = '';
}

// ⬇️ 修改 switchView 函数，增加 AI 视图处理
function switchView(tabName) {
    // 隐藏所有视图
    if (UI.homeView) UI.homeView.style.display = 'none';
    if (UI.myView) UI.myView.style.display = 'none';
    if (UI.discoverView) UI.discoverView.style.display = 'none';
    if (UI.aiView) UI.aiView.style.display = 'none'; // 隐藏 AI 视图

    // 移除所有 Tab 激活状态
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    // 激活当前 Tab (简单匹配)
    const activeTab = document.querySelector(`.tab-item[data-tab="${tabName}"]`);
    if(activeTab) activeTab.classList.add('active');

    if (tabName === 'my') {
        UI.myView.style.display = 'block';
        loadMyWishes();
    } else if (tabName === 'discover') {
        UI.discoverView.style.display = 'block';
        if (!window.hasDrawnToday) drawRandomWish();
    } else if (tabName === 'ai') {
        // ⬇️ 新增：AI 视图逻辑
        UI.aiView.style.display = 'flex'; // 使用 flex 布局
        // 滚动到底部
        scrollToBottom();
    } else {
        // home
        UI.homeView.style.display = 'block';
        loadHomeWishes();
    }
}

// ⬇️ 新增：滚动到底部辅助函数
function scrollToBottom() {
    if (UI.chatHistory) {
        UI.chatHistory.scrollTop = UI.chatHistory.scrollHeight;
    }
}

// ⬇️ 新增：添加消息到界面
function appendMessage(role, text) {
    if (!UI.chatHistory) return;
    
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    div.textContent = text; // 防止 XSS
    
    UI.chatHistory.appendChild(div);
    scrollToBottom();
}

// ⬇️ 新增：显示/隐藏加载状态
function showTyping(show) {
    // 这里简单处理：如果有 loading 元素可以显示，或者直接在最后加一个临时消息
    // 为了简单，我们不在 DOM 里永久保留 loading，而是由用户感知延迟
    // 如果需要更精细的控制，可以在 HTML 加一个 id="typingIndicator" 的元素
}

// ⬇️ 新增：调用通义千问 API
async function callQwenAPI(messages) {
    if (!QWEN_API_KEY || QWEN_API_KEY === 'YOUR_DASHSCOPE_API_KEY') {
        throw new Error("⚠️ 未配置 API Key！请在 config.js 中填写 QWEN_API_KEY。");
    }

    const response = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${QWEN_API_KEY}`
        },
        body: JSON.stringify({
            model: QWEN_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'API 请求失败');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// ⬇️ 新增：处理发送消息
let chatContext = [
    { role: "system", content: "你是一个温暖、鼓励人心的 AI 许愿助手。用户会和你分享他们的愿望或烦恼。请用积极、 supportive 的语气回复，适当给出建议，但不要说教。保持回复简洁（100字以内）。" }
];

async function handleSendChat() {
    const input = UI.chatInput;
    const text = input.value.trim();
    if (!text) return;

    // 1. 显示用户消息
    appendMessage('user', text);
    input.value = '';
    
    // 2. 添加到上下文
    chatContext.push({ role: "user", content: text });

    // 3. 禁用输入框防止重复发送
    input.disabled = true;
    UI.sendBtn.disabled = true;

    // 4. 显示加载中提示 (可选：在界面上加一个 "AI 正在思考..." 的临时气泡)
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.style.opacity = '0.7';
    loadingDiv.textContent = '✨ 正在连接宇宙大脑...';
    UI.chatHistory.appendChild(loadingDiv);
    scrollToBottom();

    try {
        // 5. 调用 API
        const reply = await callQwenAPI(chatContext);
        
        // 6. 移除加载提示
        UI.chatHistory.removeChild(loadingDiv);
        
        // 7. 显示 AI 回复
        appendMessage('assistant', reply);
        chatContext.push({ role: "assistant", content: reply });
        
    } catch (err) {
        UI.chatHistory.removeChild(loadingDiv);
        appendMessage('assistant', `❌ 出错了：${err.message}`);
        console.error(err);
    } finally {
        input.disabled = false;
        UI.sendBtn.disabled = false;
        input.focus();
    }
}

// ⬇️ 新增：随机抽取愿望函数
// ⬇️ 新增：随机抽取愿望函数 (修复版：使用内存随机)
async function drawRandomWish() {
    const card = UI.randomCard;
    const placeholder = UI.randomPlaceholder;
    const content = UI.randomContent;
    
    if (!card) {
        console.error("❌ 找不到随机卡片元素");
        return;
    }

    // 1. 动画反馈
    card.style.transform = "scale(0.95)";
    setTimeout(() => card.style.transform = "scale(1)", 150);

    // 2. 显示加载状态
    if (placeholder) {
        placeholder.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--accent-color);"></i><p style="margin-top:10px;">连接宇宙中...</p>';
        placeholder.style.display = 'block';
    }
    if (content) content.style.display = 'none';

    try {
        // 3. 【修复核心】先获取所有愿望 (限制最多 100 条以防性能问题)
        // 不再使用 .order('random()')，因为它会导致 400 错误
        const { data, error } = await supabase
            .from('wishes')
            .select('username, content, created_at')
            .limit(100); // 只取最新的 100 条作为池子

        if (error) {
            console.error("Supabase 查询错误:", error);
            throw new Error("网络信号不佳：" + error.message);
        }

        if (!data || data.length === 0) {
            throw new Error("宇宙还是空的，快来许第一个愿吧！");
        }

        // 4. 【JS 内存随机】从返回的数组中随机选一个
        const randomIndex = Math.floor(Math.random() * data.length);
        const selectedWish = data[randomIndex];

        console.log("🎲 随机抽取结果:", selectedWish);

        // 5. 渲染数据
        const user = selectedWish.username || '匿名星人';
        const text = selectedWish.content || '（无内容）';
        const dateStr = selectedWish.created_at 
            ? new Date(selectedWish.created_at).toLocaleDateString() 
            : '未知日期';

        if (UI.randomUser) UI.randomUser.textContent = user;
        if (UI.randomText) UI.randomText.textContent = `"${text}"`;
        if (UI.randomDate) UI.randomDate.textContent = dateStr;

        // 6. 切换显示
        if (placeholder) placeholder.style.display = 'none';
        if (content) content.style.display = 'block';
        
        // 标记已抽取
        window.hasDrawnToday = true;

    } catch (err) {
        console.error("❌ 抽取失败:", err);
        if (placeholder) {
            placeholder.innerHTML = `
                <i class="fas fa-exclamation-circle" style="font-size: 40px; color: #ff4757;"></i>
                <p style="margin-top:10px; color:#ff4757; font-size: 0.9rem;">${err.message}</p>
            `;
            placeholder.style.display = 'block';
        }
        if (content) content.style.display = 'none';
    }
}




// --- 业务逻辑处理 ---

function toggleAuthMode() {
    isPasswordMode = !isPasswordMode;
    if (isPasswordMode) {
        UI.passwordInput.style.display = 'block';
        UI.authActionBtn.textContent = '登录 / 注册';
        UI.toggleAuthModeBtn.textContent = '切换回魔法链接';
    } else {
        UI.passwordInput.style.display = 'none';
        UI.authActionBtn.textContent = '发送魔法链接';
        UI.toggleAuthModeBtn.textContent = '切换到密码登录';
    }
}

// ✅ 修复的核心函数：处理登录/注册提交
async function handleAuthSubmit() {
    const email = UI.emailInput.value.trim();
    const password = UI.passwordInput.value;
    
    if (!email) {
        showMsg("请输入邮箱", "error");
        return;
    }

    setLoading(UI.authActionBtn, true);
    showMsg("", "normal");

    try {
        if (isPasswordMode && password) {
            // --- 密码模式逻辑 (已修复) ---
            console.log("尝试密码登录/注册...", email);
            
            try {
                // 1. 先尝试登录
                await Auth.signInWithPassword(email, password);
                showMsg("登录成功！", "success");
                // 登录成功后，initAuth 中的监听器会自动处理 UI 更新和关闭弹窗
            } catch (e) {
                // 2. 如果登录失败且提示用户不存在，则尝试注册
                if (e.message.includes('Invalid') || e.message.includes('User not found') || e.message.includes('credentials')) {
                    showMsg("未找到账户，正在自动注册...", "normal");
                    await Auth.signUpWithPassword(email, password);
                    showMsg("注册成功！请检查邮箱验证。", "success");
                } else {
                    // 其他错误直接抛出
                    throw e;
                }
            }
            // --- 密码模式逻辑结束 ---
            
        } else {
            // --- 魔法链接模式逻辑 ---
            console.log("发送魔法链接...", email);
            await Auth.sendMagicLink(email);
            showMsg("✨ 魔法链接已发送！请查收邮箱。", "success");
        }
    } catch (err) {
        console.error("认证错误:", err);
        
        // 针对频率限制的友好提示
        if (err.message.includes('rate limit') || err.message.includes('Email rate limit')) {
            showMsg("⚠️ 发送太频繁啦！\n建议：点击'切换到密码登录'直接测试，或 1 小时后再试。", "error");
        } else {
            showMsg(err.message || "操作失败", "error");
        }
    } finally {
        setLoading(UI.authActionBtn, false);
    }
}

async function handleLogout() {
    if (!confirm("确定要退出登录吗？")) return;

    try {
        await Auth.signOut();
        
        // 1. 清空本地状态
        currentUser = null;
        window.hasDrawnToday = false;

        // 2. 更新顶部 UI (显示"游客", 隐藏退出按钮)
        updateUIForGuest();

        // ================= 🔴 关键修复开始 =================
        
        // A. 强制隐藏“个人资料编辑区”
        // 请确保您的 HTML 中，包裹头像/昵称输入框的那个 div 有 id="profileSection"
        // 如果没有这个 ID，请看下面的【重要提示】去加一下
        const profileSec = document.getElementById('profileSection');
        if (profileSec) {
            profileSec.style.display = 'none'; // 直接隐藏
            console.log("🔒 已隐藏个人资料表单");
        }

        // B. 重置“我的愿望列表”区域为引导页
        // 这样用户看到的就是“请登录”，而不是空列表或旧数据
        const listContainer = document.getElementById('myWishList');
        if (listContainer) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-user-lock" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3 style="color: #666;">登录后查看您的愿望</h3>
                    <button id="forceLoginBtn" style="
                        background: var(--accent-color, #6a11cb); 
                        color: white; 
                        border: none; 
                        padding: 10px 25px; 
                        border-radius: 20px; 
                        margin-top: 15px;
                        cursor: pointer;
                    ">立即登录</button>
                </div>
            `;
            
            // 绑定新按钮事件
            setTimeout(() => {
                const btn = document.getElementById('forceLoginBtn');
                if(btn) btn.addEventListener('click', () => openModal(UI.authModal));
            }, 0);
        }

        // ================= 🔴 关键修复结束 =================

        // 3. 关闭所有弹窗
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        });

        console.log("✅ 退出完成，界面已重置");

    } catch (err) {
        alert("退出失败：" + err.message);
    }
}

async function handlePublishSubmit() {
    if (!currentUser) {
        openModal(UI.authModal);
        return;
    }
    
    const content = UI.wishInput.value.trim();
    
    // 🔥 关键修复：优先级调整
    // 1. 优先使用全局同步的最新昵称 (currentUser.username)
    // 2. 如果用户手动在弹窗填了，以弹窗为准 (允许临时覆盖)
    // 3. 最后才回退到邮箱
    const manualNickname = UI.usernameInput.value.trim();
    const nickname = manualNickname || currentUser.username || currentUser.email.split('@')[0];
    
    if (!content) {
        alert("愿望内容不能为空");
        return;
    }

    setLoading(UI.addWishBtn, true);

    try {
        // 传入确定的 nickname
        await Data.createWish(content, nickname, currentUser.id);
        alert("🚀 愿望发射成功！");
        
        // 清空输入框
        UI.wishInput.value = '';
        UI.usernameInput.value = ''; 
        
        closeModal(UI.publishModal);
        loadHomeWishes();
    } catch (err) {
        alert("发射失败：" + err.message);
    } finally {
        setLoading(UI.addWishBtn, false);
    }
}

// --- 数据加载渲染 ---

async function loadHomeWishes() {
    if (!UI.homeView) return;
    UI.homeView.innerHTML = '<div class="loading">正在加载愿望...</div>';
    
    try {
        const wishes = await Data.fetchAllWishes();
        renderWishList(UI.homeView, wishes);
    } catch (err) {
        UI.homeView.innerHTML = `<p style="color:red;text-align:center;">加载失败：${err.message}</p>`;
    }
}

async function loadMyWishes() {
    const container = document.getElementById('myWishList'); // 假设这是列表容器
    const profileSection = document.getElementById('profileSection'); // ⚠️ 假设您的表单在一个 id="profileSection" 的 div 里
    
    // 🔴 关键检查：如果没有登录
    if (!currentUser) {
        console.log("🔒 未登录，渲染登录引导页...");

        // 1. 隐藏个人资料编辑区 (如果存在独立容器)
        if (profileSection) profileSection.style.display = 'none';

        // 2. 如果列表容器存在，将其内容替换为登录引导卡片
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; animation: fadeIn 0.5s;">
                    <div style="
                        width: 80px; height: 80px; 
                        background: #f0f0f0; 
                        border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center; 
                        margin: 0 auto 20px;
                    ">
                        <i class="fas fa-user-lock" style="font-size: 32px; color: #6a11cb;"></i>
                    </div>
                    <h3 style="color: #333; margin-bottom: 10px;">登录后查看个人资料</h3>
                    <p style="color: #666; margin-bottom: 25px; font-size: 14px;">
                        登录后您可以修改昵称、上传头像，<br>并管理您许下的愿望。
                    </p>
                    <button id="guestLoginBtn" style="
                        background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                        color: white;
                        border: none;
                        padding: 12px 35px;
                        border-radius: 25px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(106, 17, 203, 0.3);
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        立即登录 / 注册
                    </button>
                </div>
            `;

            // 3. 绑定新按钮的点击事件
            setTimeout(() => {
                const btn = document.getElementById('guestLoginBtn');
                if (btn) {
                    btn.addEventListener('click', () => {
                        openModal(UI.authModal);
                    });
                }
            }, 0);
        }
        return; // 🛑 停止执行，不再加载数据
    }

    // ✅ 如果已登录，继续原有逻辑
    if (container) container.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">加载中...</p>';
    
    // 确保登录时显示资料编辑区
    if (profileSection) profileSection.style.display = 'block';

    try {
        const wishes = await Data.fetchUserWishes(currentUser.id);
        renderWishList(container, wishes, true);
    } catch (err) {
        if (container) container.innerHTML = `<p style="color:red; text-align:center;">加载失败：${err.message}</p>`;
    }
}

function renderWishList(container, wishes, isMine = false) {
    container.innerHTML = '';
    if (!wishes || wishes.length === 0) {
        container.innerHTML = '<p style="color:#aaa;text-align:center;margin-top:20px;">暂无愿望</p>';
        return;
    }
    
    wishes.forEach(w => {
        const card = document.createElement('div');
        card.className = 'wish-card';
        if (isMine) card.style.borderLeft = "4px solid #6a11cb";
        card.innerHTML = `
            <h4>${escapeHtml(w.username || '匿名')}</h4>
            <p>${escapeHtml(w.content)}</p>
            <div class="wish-meta"><span>${new Date(w.created_at).toLocaleDateString()}</span></div>
        `;
        container.appendChild(card);
    });
}

// --- 工具函数 ---
function openModal(modal) { 
    if(modal) { 
        modal.style.display='flex'; 
        setTimeout(()=>modal.classList.add('show'), 10); 
    } 
}

function closeModal(modal) { 
    if(modal) { 
        modal.classList.remove('show'); 
        setTimeout(()=>modal.style.display='none', 300); 
    } 
}

function setLoading(btn, isLoading) { 
    if(!btn) return; 
    if(isLoading) { 
        btn.disabled=true; 
        btn.dataset.orig=btn.textContent; 
        btn.textContent='处理中...'; 
    } else { 
        btn.disabled=false; 
        btn.textContent=btn.dataset.orig||btn.textContent; 
    } 
}

function showMsg(text, type) {
    if(!UI.authMessage) return;
    UI.authMessage.textContent = text;
    UI.authMessage.style.color = type === 'error' ? '#ff4757' : (type === 'success' ? '#2ed573' : '#666');
}

function escapeHtml(text) {
    if(!text) return '';
    return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}