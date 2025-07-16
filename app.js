document.addEventListener('DOMContentLoaded', () => {
    // DOM元素
    const setupContainer = document.getElementById('setup-container');
    const appContainer = document.getElementById('app-container');
    const bossMode = document.getElementById('boss-mode');
    const setupForm = document.getElementById('setup-form');
    const currentAmount = document.getElementById('current-amount');
    const dailyTarget = document.getElementById('daily-target');
    const workDuration = document.getElementById('work-duration');
    const timeUntilEnd = document.getElementById('time-until-end');
    const perSecond = document.getElementById('per-second');
    const settingsBtn = document.getElementById('settings-btn');
    const bossKeyBtn = document.getElementById('boss-key-btn');
    const themeBtn = document.getElementById('theme-btn');
    const moneyAnimation = document.getElementById('money-animation');
    const ctx = moneyAnimation.getContext('2d');

    // 应用状态
    let userSettings = null;
    let isBossMode = false;
    let isDarkMode = localStorage.getItem('薪球崛起_主题') === 'dark';
    let animationFrameId = null;
    let coins = [];

    // 初始化主题
    function initTheme() {
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // 切换主题
    function toggleTheme() {
        isDarkMode = !isDarkMode;
        localStorage.setItem('薪球崛起_主题', isDarkMode ? 'dark' : 'light');
        initTheme();
    }
    let lastEarnings = 0;
    let achievements = [];

    // 初始化画布
    function initCanvas() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        moneyAnimation.width = moneyAnimation.offsetWidth;
        moneyAnimation.height = moneyAnimation.offsetHeight;
    }

    // 从localStorage加载设置
    function loadSettings() {
        const saved = localStorage.getItem('薪球崛起_用户设置');
        if (saved) {
            userSettings = JSON.parse(saved);
            return true;
        }
        return false;
    }

    // 保存设置到localStorage
    function saveSettings(settings) {
        localStorage.setItem('薪球崛起_用户设置', JSON.stringify(settings));
        userSettings = settings;
    }

    // 格式化时间显示
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}`;
    }

    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    // 计算工作时间和赚取金额
    function calculateEarnings() {
        const now = new Date();
        const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        // 解析设置的时间
        const [startHour, startMinute] = userSettings.workStart.split(':').map(Number);
        const [endHour, endMinute] = userSettings.workEnd.split(':').map(Number);
        const [lunchStartHour, lunchStartMinute] = userSettings.lunchStart ? userSettings.lunchStart.split(':').map(Number) : [0, 0];
        const [lunchEndHour, lunchEndMinute] = userSettings.lunchEnd ? userSettings.lunchEnd.split(':').map(Number) : [0, 0];

        const workStartTime = startHour * 3600 + startMinute * 60;
        const workEndTime = endHour * 3600 + endMinute * 60;
        const lunchStartTime = lunchStartHour * 3600 + lunchStartMinute * 60;
        const lunchEndTime = lunchEndHour * 3600 + lunchEndMinute * 60;

        // 检查是否在工作时间内
        if (currentTime < workStartTime || currentTime > workEndTime) {
            return {
                inWorkingHours: false,
                earnings: 0,
                workDuration: 0,
                timeUntilEnd: 0
            };
        }

        // 计算已工作时间（扣除午休）
        let elapsedSeconds;
        if (currentTime < lunchStartTime || currentTime > lunchEndTime) {
            elapsedSeconds = currentTime - workStartTime;
            // 扣除午休时间（如果已经过了午休）
            if (currentTime > lunchEndTime) {
                elapsedSeconds -= (lunchEndTime - lunchStartTime);
            }
        } else {
            // 当前在午休时间
            elapsedSeconds = lunchStartTime - workStartTime;
        }

        // 计算距离下班时间
        let remainingSeconds = workEndTime - currentTime;
        if (currentTime < lunchStartTime) {
            remainingSeconds += (lunchEndTime - lunchStartTime);
        }

        // 计算赚取金额
        const hourlyRate = userSettings.salaryType === 'hourly' ? 
            parseFloat(userSettings.salaryAmount) : 
            userSettings.salaryType === 'daily' ? 
            parseFloat(userSettings.salaryAmount) / 8 : 
            parseFloat(userSettings.salaryAmount) / (22 * 8); // 月薪按22天/月、8小时/天计算

        const earnings = (hourlyRate * elapsedSeconds) / 3600;
        const perSecondEarnings = hourlyRate / 3600;

        return {
            inWorkingHours: true,
            earnings: earnings.toFixed(2),
            perSecond: perSecondEarnings.toFixed(4),
            workDuration: elapsedSeconds,
            timeUntilEnd: remainingSeconds,
            dailyTarget: userSettings.salaryType === 'daily' ? 
                parseFloat(userSettings.salaryAmount).toFixed(2) : 
                userSettings.salaryType === 'monthly' ? 
                (parseFloat(userSettings.salaryAmount) / 22).toFixed(2) : 
                (hourlyRate * 8).toFixed(2)
        };
    }

    // 更新UI显示
    function updateDisplay() {
        const data = calculateEarnings();

        if (!data.inWorkingHours) {
            currentAmount.textContent = `${userSettings.currency}0.00`;
            workDuration.textContent = '00:00:00';
            timeUntilEnd.textContent = '不在工作时间';
            perSecond.textContent = `${userSettings.currency}0.0000/秒`;
            return;
        }

        // 更新金额显示
        currentAmount.textContent = `${userSettings.currency}${data.earnings}`;
        dailyTarget.textContent = `${userSettings.currency}${data.dailyTarget}`;
        workDuration.textContent = formatTime(data.workDuration);
        timeUntilEnd.textContent = data.timeUntilEnd > 0 ? formatTime(data.timeUntilEnd) : '已下班';
        perSecond.textContent = `${userSettings.currency}${data.perSecond}/秒`;

        // 检查成就
        checkAchievements(parseFloat(data.earnings));

        // 添加金币动画（当金额增加时）
        if (parseFloat(data.earnings) > lastEarnings) {
            addCoins(Math.floor((parseFloat(data.earnings) - lastEarnings) * 30)); // 增加金币数量
            lastEarnings = parseFloat(data.earnings);
        }
    }

    // 成就系统
    function checkAchievements(earnings) {
        const milestones = [100, 500, 1000, 2000, 5000];
        const newAchievements = milestones.filter(milestone => 
            earnings >= milestone && !achievements.includes(milestone)
        );

        newAchievements.forEach(milestone => {
            achievements.push(milestone);
            showAchievementNotification(`恭喜！已赚取${userSettings.currency}${milestone}！`);
        });

        // 检查是否达成日薪目标
        const dailyTarget = parseFloat(userSettings.salaryType === 'daily' ? 
            userSettings.salaryAmount : (parseFloat(userSettings.salaryAmount) * 8).toFixed(2));

        if (earnings >= dailyTarget && !achievements.includes('dailyTarget')) {
            achievements.push('dailyTarget');
            showAchievementNotification(`🎉 今日工资已到手！🎉`);
        }
    }

    function showAchievementNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(212, 175, 55, 0.9)';
        notification.style.color = 'white';
        notification.style.padding = '15px';
        notification.style.borderRadius = '10px';
        notification.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8)';
        notification.style.zIndex = '1000';
        notification.style.transition = 'all 0.3s ease';
        notification.style.transform = 'translateY(100px)';
        notification.style.opacity = '0';

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
            notification.style.opacity = '1';
        }, 10);

        // 3秒后移除
        setTimeout(() => {
            notification.style.transform = 'translateY(100px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // 金币动画系统
    function addCoins(count) {
        // 保持画面上的金币数量在合理范围内
        const maxCoins = 200; // 增加最大数量以实现更密集的效果
        if (coins.length > maxCoins) return;

        for (let i = 0; i < count; i++) {
            // 随机选择起始位置，实现更分散的效果
            const startX = Math.random() * moneyAnimation.width;
            const startY = -20 - Math.random() * 50; // 随机起始高度

            // 随机选择类型：金粉、金币或钞票
            const type = Math.random() < 0.6 ? 'dust' : Math.random() < 0.8 ? 'coin' : 'note';
            const size = type === 'dust' ? Math.random() * 4 + 2 : // 金粉较小
                        type === 'coin' ? Math.random() * 10 + 8 : // 金币中等
                        Math.random() * 15 + 10; // 钞票较大

            coins.push({
                x: startX,
                y: startY,
                size: size,
                speedY: Math.random() * 8 + 6, // 增加基础下落速度
                speedX: (Math.random() - 0.5) * 3, // 增加水平漂移速度
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4, // 增加旋转速度
                opacity: type === 'dust' ? Math.random() * 0.3 + 0.7 : Math.random() * 0.4 + 0.6,
                type: type,
                sparkleSpeed: Math.random() * 0.2 + 0.1, // 增加闪烁速度
                sparklePhase: Math.random() * Math.PI * 2
            });
        }
    }

    // 自动添加效果
    function autoAddCoins() {
        if (!isBossMode) {
            addCoins(5); // 每次添加更多粒子
        }
        setTimeout(autoAddCoins, 30); // 更快的生成频率
    }

    function updateCoins() {
        ctx.clearRect(0, 0, moneyAnimation.width, moneyAnimation.height);

        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i];

            // 更新位置
            coin.y += coin.speedY;
            coin.x += coin.speedX;
            coin.rotation += coin.rotationSpeed;

            // 金粉的闪烁效果
            if (coin.type === 'dust') {
                coin.sparklePhase += coin.sparkleSpeed;
                coin.opacity = 0.7 + Math.sin(coin.sparklePhase) * 0.3;
            }

            // 飘落效果
            coin.x += Math.sin(coin.y / 50) * 0.3;

            ctx.save();
            ctx.globalAlpha = coin.opacity;
            ctx.translate(coin.x, coin.y);
            ctx.rotate(coin.rotation);

            if (coin.type === 'dust') {
                // 金粉效果
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coin.size);
                gradient.addColorStop(0, '#FFD700');
                gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (coin.type === 'coin') {
                // 金币效果
                ctx.beginPath();
                ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(-coin.size/3, -coin.size/3, 0, 0, 0, coin.size);
                gradient.addColorStop(0, '#FFD700');
                gradient.addColorStop(1, '#D4AF37');
                ctx.fillStyle = gradient;
                ctx.fill();

                // 金币纹理
                ctx.beginPath();
                ctx.arc(0, 0, coin.size * 0.7, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                // 钞票效果
                ctx.fillStyle = '#85BB65';
                ctx.fillRect(-coin.size, -coin.size/3, coin.size * 2, coin.size * 0.6);
                ctx.strokeStyle = 'rgba(0, 64, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(-coin.size, -coin.size/3, coin.size * 2, coin.size * 0.6);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = `${coin.size * 0.3}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('¥', 0, 0);
            }
            ctx.restore();

            // 移除超出屏幕的粒子
            if (coin.y > moneyAnimation.height + coin.size) {
                coins.splice(i, 1);
                i--;
            }
        }

        animationFrameId = requestAnimationFrame(updateCoins);
    }

    // 在初始化应用时启动自动金币系统
    function initApp() {
        if (loadSettings()) {
            setupContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            dailyTarget.textContent = `${userSettings.currency}${userSettings.salaryType === 'daily' ? userSettings.salaryAmount : (parseFloat(userSettings.salaryAmount) * 8).toFixed(2)}`;

            // 初始化动画
            initCanvas();
            updateDisplay();
            updateCoins();
            autoAddCoins(); // 启动自动金币系统

            // 设置每秒更新
            setInterval(updateDisplay, 1000);
        } else {
            setupContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    }

    // 老板键功能
    function toggleBossMode() {
        isBossMode = !isBossMode;
        if (isBossMode) {
            appContainer.classList.add('hidden');
            bossMode.classList.remove('hidden');
        } else {
            appContainer.classList.remove('hidden');
            bossMode.classList.add('hidden');
        }
    }

    // 事件监听器
    // 初始化主题
    initTheme();

    // 主题切换按钮
    themeBtn.addEventListener('click', toggleTheme);

    setupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = {
            salaryType: document.getElementById('salary-type').value,
            salaryAmount: document.getElementById('salary-amount').value,
            currency: document.getElementById('currency').value,
            workStart: document.getElementById('work-start').value,
            workEnd: document.getElementById('work-end').value,
            lunchStart: document.getElementById('lunch-start').value,
            lunchEnd: document.getElementById('lunch-end').value
        };

        saveSettings(formData);
        setupContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        dailyTarget.textContent = `${formData.currency}${formData.salaryType === 'daily' ? formData.salaryAmount : (parseFloat(formData.salaryAmount) * 8).toFixed(2)}`;

        // 初始化动画
        initCanvas();
        updateDisplay();
        updateCoins();

        // 设置每秒更新
        setInterval(updateDisplay, 1000);
    });

    // 老板键按钮
    bossKeyBtn.addEventListener('click', toggleBossMode);

    // 键盘快捷键 (B键或空格键)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'b' || e.key === 'B' || e.key === ' ') {
            toggleBossMode();
        }
    });

    // 设置按钮 - 简单实现，显示设置面板
    settingsBtn.addEventListener('click', () => {
        if (confirm('是否要重置设置？')) {
            localStorage.removeItem('薪球崛起_用户设置');
            location.reload();
        }
    });

    // 初始化应用
    function initApp() {
        if (loadSettings()) {
            setupContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            dailyTarget.textContent = `${userSettings.currency}${userSettings.salaryType === 'daily' ? userSettings.salaryAmount : (parseFloat(userSettings.salaryAmount) * 8).toFixed(2)}`;

            // 初始化动画
            initCanvas();
            updateDisplay();
            updateCoins();

            // 设置每秒更新
            setInterval(updateDisplay, 1000);
        } else {
            setupContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    }

    // 启动应用
    initApp();

    // 清理函数
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationFrameId);
    });
});