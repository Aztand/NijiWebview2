window.hasUnsavedChanges = () => {
    const writePage = document.getElementById('write-page');
    // 如果当前不可编辑，直接返回false
    if (writePage.dataset.ownerType !== 'self') return false;
        const title = document.getElementById('title-input').value;
        const content = document.getElementById('diary-input').value.replace(/\r\n|\r/g, '\n');
        return title !== writePage.dataset.title || content !== writePage.dataset.content.replace(/\r\n|\r/g, '\n');
    }

const _showSaveDialog = () => new Promise(resolve => {
    const saveFirst = confirm("当前日记有未保存修改，是否保存？");
    if (saveFirst) return resolve('save');
    
    const confirmDiscard = confirm("确定要放弃修改吗？");
    resolve(confirmDiscard ? 'discard' : 'cancel');
});

const _handleSwitchError = (error) => {
    console.error(`日记切换失败: ${error.stack}`);
    alert(`操作失败：${error.message}`);
};

const _handleDeleteSuccess = (deletedId) => {
    const writePage = document.getElementById('write-page');
    const deletedCard = document.getElementById(deletedId);
    const cardList = document.getElementById('diary-card-list');
    // 1. 查找下篇日记（DOM顺序即时间顺序）
    const getNextDiary = () => {
        if (!deletedCard) return null;
        
        // 先尝试找后续卡片（更早的日记）
        let nextCard = deletedCard.nextElementSibling;
        // 跳过月份标题（h1元素）
        while(nextCard && nextCard.tagName !== 'DIV') {
            nextCard = nextCard.nextElementSibling;
        }

        // 没有后续则找前序卡片（更新的日记）
        if (!nextCard) {
            nextCard = deletedCard.previousElementSibling;
            while(nextCard && nextCard.tagName !== 'DIV') {
                nextCard = nextCard.previousElementSibling;
            }
        }
        return nextCard;
    };

    // 2. 执行切换或清空
    const nextCard = getNextDiary();
    if (nextCard) {
        nextCard.click(); // 触发点击切换
    } else {
        // 无其他日记时的处理
        document.getElementById('title-input').value = '';
        document.getElementById('diary-input').value = '';
        document.getElementById('saveMenuButton').hidden = true;
        document.getElementById('deleteMenuButton').hidden = true;
    }


    // 3. 显示操作反馈      这其实应该是第五步，但发现实际上要用户点击这个alert之后，才会开始删除卡片、月份，这会导致无法正确删除月份。
    alert('日记已永久删除');


    // 4. 移除被删卡片（带动画）
    if (deletedCard) {
        deletedCard.classList.add('fade-out');
        setTimeout(() => deletedCard.remove(), 300);
    }

    // 5.清理名下没有日记卡片的所有月份标题
    // 获取所有month-text元素
    var monthTextElements = document.querySelectorAll('.month-text');
    // 遍历month-text元素   用settimeout是因为那玩意儿播完淡出动画才消失……
    setTimeout(() => monthTextElements.forEach(function(monthText) {
    // 检查month-text元素后面是否紧跟了一个diary-card元素或者是否存在下一个兄弟元素
    var nextElement = monthText.nextElementSibling;
    console.log("cleaning");
    if (!nextElement || !nextElement.classList.contains('diary-card')) {
        // 如果后面没有紧跟diary-card或者没有下一个兄弟元素，则删除该month-text元素
        monthText.remove();
    }
    }), 350);

};

const monthRegistry = new Map(); // { 'YYYY-MM': HTMLElement }

window.addMonthCard = (year, month) => {
    const monthStr = `${year}年${parseInt(month)}月`;
    const key = `${year}-${month.toString().padStart(2,'0')}`;
    
    if (monthRegistry.has(key)) return;

    const element = document.createElement('h1');
    element.className = 'month-text';
    element.textContent = monthStr;
    element.dataset.sortKey = key;
    element.dataset.createdDate = getLastDayOfMonth(year,month);

    // 倒序插入月份标题
    const existing = [...document.querySelectorAll('.month-text')];
    const insertPos = existing.find(el => el.dataset.sortKey < key);
    const container = document.getElementById('diary-card-list');

    insertPos ? container.insertBefore(element, insertPos) 
             : container.appendChild(element);

    monthRegistry.set(key, element);
};

window.addDiaryCard = (data) => {
    const dateStr = data.createdDate //|| new Date().toISOString().split('T')[0];
    const dateObj = new Date(dateStr);
    const key = `${dateObj.getFullYear()}-${(dateObj.getMonth()+1).toString().padStart(2,'0')}`;

    // 确保月份存在
    if (!monthRegistry.has(key)) {
        window.addMonthCard(dateObj.getFullYear(), dateObj.getMonth()+1);
    }

    // 生成卡片
    const template = document.getElementById('diary-card-template').innerHTML;
    const html = Object.entries(data).reduce((acc, [k,v]) => 
        acc.replace(new RegExp(`{{${k}}}`, 'g'), v), template);
    
    const card = document.createElement('div');
    card.innerHTML = html;
    const cardEl = card.firstElementChild;
    cardEl.dataset.createdDate = dateStr;

    // 插入到正确位置（倒序）
    const siblings = [...document.getElementById('diary-card-list').children];
    const insertPos = siblings.find(el => {
        const elDate = el.dataset?.createdDate;
        const elUserId = el.dataset?.userId;
        const elDateObj = new Date(elDate);
        const isMonth = el.classList.contains("month-text");

        const isSameDay = elDateObj.getTime() === dateObj.getTime();
        const userIdMismatch = elUserId !== String(userId);

        return (isSameDay && userIdMismatch && !isMonth) || elDateObj < dateObj;
    });

    insertPos ? insertPos.before(cardEl) 
             : document.getElementById('diary-card-list').appendChild(cardEl);

    // 更新最新日期
    const currentDate = document.getElementById('date-input').value;
    if (!currentDate || new Date(dateStr) > new Date(currentDate)) {
        document.getElementById('date-input').value = dateStr;
    }

    if (shouldAutoLoadFirstDiary && data.cardOwner == "self") { //只自动查看自己日记。防止匹配对方有隐私需求。
        shouldAutoLoadFirstDiary = false; // 立即置为false防止重复

        // 直接使用传入参数加载日记
        window.switchDiary({
            userId: data.cardUserID.toString(),
            diaryId: data.cardDiaryId.toString(),
            owner: data.cardOwner,
            mode: 'preview'
        });
    }

};

function getLastDayOfMonth(year, month) {//辅助addMonthCard设置月份虚拟日期
    // 设置下一个月的第一天
    const nextMonth = new Date(year, month, 1);
    // 减去一天得到当前月的最后一天
    const lastDay = new Date(nextMonth - 1);
    // 返回格式化的日期字符串
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
}

// 保存更改的操作
window.writeDiary = async function() {
    const diaryInput = document.getElementById("diary-input");
    const titleInput = document.getElementById("title-input");
    const dateInput = document.getElementById("date-input");
    const writePage = document.getElementById('write-page');
    
    const selectedDate = dateInput.value || writePage.dataset.createdDate;
    const title = titleInput.value;
    const content = diaryInput.value;

    try {
        // 输入验证
        if (!content.trim()) throw new Error('日记正文内容不能为空');
        if (!selectedDate){ throw new Error('请选择日记日期');}
        
        // 调用aardio接口
        const result = JSON.parse(await aardio.writeDiary(
            selectedDate,
            title,
            content
        ));

        if (result.status !== "Success") {
            throw new Error(result.message || '保存失败');
        }

        // 更新界面状态
        writePage.dataset.title = title;
        writePage.dataset.content = content;
        writePage.dataset.date = selectedDate; // 记录当前日期

        //更新日记卡片简介——————————————————————————————————————————————
        //确认当前日记存在卡片。如果是新建的日记则不用处理
        var isDiaryIdMatched = false;
        var diaryCards = document.querySelectorAll('#diary-card-list .diary-card'); // 获取所有的日记卡片
            for (var i = 0; i < diaryCards.length; i++) {                               // 遍历所有日记卡片
                // 检查当前日记卡片的id是否与currentDiaryId相同
                // 找到匹配的日记卡片后，执行操作退出循环
                if (diaryCards[i].dataset.createdDate == selectedDate && diaryCards[i].getAttribute("owner") == "self") {
                    isDiaryIdMatched = true;
                    diaryCards[i].getElementsByClassName("card-time")[0].textContent = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });//ai写的，别问
                    diaryCards[i].getElementsByClassName("card-title")[0].textContent = title ? title.replace(/\s/g, ' ') : selectedDate;
                    diaryCards[i].getElementsByClassName("card-simple")[0].textContent = content.replace(/\s/g, ' ') ? content : content;
                    break; 
                }
            }//此代码块用于检查是否是卡片列表不存在的新建日记
        //—————————————————————————————————————————————————————————————
        if (!isDiaryIdMatched) {    //添加日记卡片
            // 获取当前时间
            let now = new Date();
            let hours = now.getHours();
            let minutes = now.getMinutes();
            // 格式化小时和分钟，确保它们是两位数
            let formattedHours = hours.toString().padStart(2, '0');
            let formattedMinutes = minutes.toString().padStart(2, '0');

            const newDiaryCardData = {
                cardDiaryId: result.newDiaryId,
                cardUserID: writePage.dataset.currentUserId,
                cardOwner: writePage.dataset.ownerType,
                cardDay: new Date(selectedDate).getDate(),
                cardWeek: "星期" + ['日', '一', '二', '三', '四', '五', '六'][new Date(selectedDate).getDay()],
                cardWriteTime: `${formattedHours}:${formattedMinutes}`,
                cardTitle: title || selectedDate,
                cardSimple: content.length > 19 ? content.substring(0, 19) + '...' : content , // 截取前19字作为简介
                createdDate: selectedDate,
                cardStyle: "card-self",
                cardReadmark: 0,
            };

            // 将新日记卡片插入到左侧列表顶部
            addDiaryCard(newDiaryCardData);

            //切换卡片列表选中卡片
            const currentDiaryCard = document.getElementById(writePage.dataset.currentDiaryId)
            const targetCard = document.getElementById(result.newDiaryId);
                
            currentDiaryCard ? currentDiaryCard.style.backgroundColor = "var(--color-bg-element)" : null;     //当前卡片切换回默认样式
            currentDiaryCard ? currentDiaryCard.style.opacity = "1" : null;     //当前卡片切换回默认样式
            currentDiaryCard ? currentDiaryCard.classList.toggle(`card-${currentDiaryCard.getAttribute('owner')}`) : null;
            targetCard.style.backgroundColor = `var(--color-${targetCard.getAttribute('owner')})`;  //新打开的卡片切换到选中样式
            targetCard.style.opacity = "0.85";  //颜色淡一点会比较舒服。字体白色，所以直接设置透明度即可
            targetCard.classList.toggle(`card-${targetCard.getAttribute('owner')}`);

                // 更新当前日记ID
            writePage.dataset.currentDiaryId = result.newDiaryId;
        }
        return result;

    } catch (error) {
        alert(`保存失败：${error.message}`);
        return { status: "Error", message: error.message };
    }
};

// 更改稿纸内容  在setWritePage中增加权限控制
window.setWritePage = async function(userId, diaryId, cardOwner, mode) {
    const writePage = document.getElementById('write-page');
    writePage.dataset.currentUserId = String(userId);  // 新增当前用户标记
    writePage.dataset.currentDiaryId = String(diaryId); // 新增当前日记标识
    writePage.dataset.ownerType = cardOwner;        // 明确归属类型
    const saveBtn = document.getElementById('saveMenuButton');
    const deleteBtn = document.getElementById('deleteMenuButton');
    const readmark = document.getElementById(diaryId).dataset.readmark;
    try {
        // 获取日记数据
        const targetDiary = JSON.parse(await aardio.getDiary(userId, diaryId));
        
        // 更新界面
        document.getElementById('title-input').value = targetDiary.title || '';
        document.getElementById('diary-input').value = targetDiary.content || '';
        document.getElementById('date-input').value = targetDiary.createddate || '';
        
        // 设置编辑状态
        const isEditable = cardOwner === 'self'; 
        writePage.dataset.editable = isEditable;

        // 按钮显示控制（新建始终显示）
        document.getElementById('newMenuButton').hidden = false;
        document.getElementById('saveMenuButton').hidden = !isEditable;
        document.getElementById('deleteMenuButton').hidden = !isEditable;
        
        // 设置输入框状态
        document.getElementById('diary-input').disabled = !isEditable;
        document.getElementById('title-input').disabled = !isEditable;
        
        // 更新缓存状态
        writePage.dataset.title = targetDiary.title;
        writePage.dataset.content = targetDiary.content;
        writePage.dataset.editable = isEditable; // 新增可编辑状态标记
        writePage.dataset.createdDate = targetDiary.createddate;

        previewDiv.innerHTML = convertContentToPreview(textarea.value);
        hljs.highlightAll();
        readmark > 0 ? readmarkText.textContent = `，${pairedGenderHan}${formatTimeAgo(readmark)}看了这篇日记` : readmarkText.textContent = "";
        wordCountText.textContent = `${targetDiary.content.length}字`;
        switchMode(mode);

    } catch (error) {
        console.error('日记加载失败:', error);
        alert('无法加载日记内容');
    }
};

//切换日记
window.switchDiary = async function(target) {
    const writePage = document.getElementById('write-page');
    const { userId, diaryId, owner, mode } = target;
    try {
        // 保存检查流程
        const isCurrentEditable = writePage.dataset.ownerType === 'self';
        if (isCurrentEditable && hasUnsavedChanges()) {
            const choice = await _showSaveDialog();
            if (choice === 'cancel') return false;
            if (choice === 'save' && !await window.writeDiary()) return false;
        }

        // 执行切换
        const currentDiaryCard = document.getElementById(writePage.dataset.currentDiaryId)
        const targetCard = document.getElementById(diaryId);
        
        currentDiaryCard ? currentDiaryCard.style.backgroundColor = "var(--color-bg-element)" : null;     //当前卡片切换回默认样式
        currentDiaryCard ? currentDiaryCard.style.opacity = "1" : null;     //当前卡片切换回默认样式
        currentDiaryCard ? currentDiaryCard.classList.toggle(`card-${currentDiaryCard.getAttribute('owner')}`) : null;
        targetCard.style.backgroundColor = `var(--color-${targetCard.getAttribute('owner')})`;  //新打开的卡片切换到选中样式
        targetCard.style.opacity = "0.85";  //颜色淡一点会比较舒服。字体白色，所以直接设置透明度即可
        targetCard.classList.toggle(`card-${targetCard.getAttribute('owner')}`);

        await setWritePage(userId, diaryId, owner, mode);
        return true;

    } catch (error) {
        console.error('日记切换失败:', error);
        alert(`操作失败: ${error.message}`);
        return false;
    }
};

let shouldAutoLoadFirstDiary = true;

document.getElementById('diary-card-list').addEventListener('click', async (event) => {     //监听点击列表切换卡片
    const card = event.target.closest('.diary-card');
    if (!card) return;

    // 从卡片元素获取关键数据
    const diaryInfo = {
        id: card.id,
        diaryId: card.id,
        userId: card.dataset.userId,
        owner: card.getAttribute('owner'), // 关键属性
        mode: 'preview'
    };

    try {
        await window.switchDiary(diaryInfo);
    } catch (error) {
        const handleSwitchError = (error) => {
            console.error('切换失败:', error);
            alert(`操作出错: ${error.message}`);
        };
    }
});

// 监听输入变化
const diaryInput = document.getElementById('diary-input');
const wordCountText = document.getElementById('word-count');
const readmarkText = document.getElementById('readmark-text');

diaryInput.addEventListener('input', function() {               //检测当前日记是否可编辑，以改变悬浮按钮显隐。以及字数统计监视。
    const saveBtn = document.getElementById('saveMenuButton');
    const writePage = document.getElementById('write-page');
    
    const hasContent = this.value.trim().length > 0;
    const isEditable = writePage.dataset.editable === 'true';
    
    saveMenuButton.hidden = !isEditable;
    saveMenuButton.style.opacity = hasContent ? 1 : 0.5;
    saveMenuButton.disabled = !hasContent;
    wordCountText.textContent = `${this.value.length}字`;
});

document.getElementById('newMenuButton').addEventListener('click', async () => {        //新建日记按钮（其实就是切换到今天）
    // 检查是否存在当天日期日记
    // 创建一个新的Date对象表示当前日期和时间
    var currentDate = new Date();
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth() + 1;
    var day = currentDate.getDate();
    // 将月份和日期格式化为两位数，如果它们小于10，则在前面添加0
    month = month < 10 ? '0' + month : month;
    day = day < 10 ? '0' + day : day;
    // 构建格式化的当日日期字符串
    var formattedDate = year + '-' + month + '-' + day;

    var diaryCards = document.querySelectorAll('.diary-card');
    // 遍历diary-card元素
    diaryCards.forEach(function(diaryCard) {
    if ( diaryCard.dataset.createdDate === formattedDate && diaryCard.dataset.userId == userId) {//如果当天有日记
        window.switchDiary({
            userId: diaryCard.dataset.userId,
            diaryId: diaryCard.id,
            owner: diaryCard.getAttribute('owner'),
            mode: 'edit'
        });
        return true;
    }
    });

    //如果遍历完了都没有，那就只能新建空白日记了
    const writePage = document.getElementById('write-page');
    try {
        // 保存检查流程
        const isCurrentEditable = writePage.dataset.ownerType === 'self';
        if (isCurrentEditable && hasUnsavedChanges()) {
            const choice = await _showSaveDialog();
            if (choice === 'cancel') return false;
            if (choice === 'save' && !await window.writeDiary()) return false;
        }

        //取消卡片列表选择
        const currentDiaryCard = document.getElementById(writePage.dataset.currentDiaryId)
        currentDiaryCard ? currentDiaryCard.style.backgroundColor = "var(--color-bg-element)" : null;     //当前卡片切换回默认样式
        currentDiaryCard ? currentDiaryCard.style.opacity = "1" : null;     //当前卡片切换回默认样式
        currentDiaryCard ? currentDiaryCard.classList.toggle(`card-${currentDiaryCard.getAttribute('owner')}`) : null;

        // 执行切换
        writePage.dataset.currentUserId = String(userId);  // 新增当前用户标记
        writePage.dataset.currentDiaryId = ""; // 清空当前日记标识
        writePage.dataset.ownerType = "self";        // 明确归属类型
        writePage.dataset.createdDate = formattedDate;
        const saveBtn = document.getElementById('saveMenuButton');
        const deleteBtn = document.getElementById('deleteMenuButton');
        // 更新界面
        document.getElementById('title-input').value = '';
        document.getElementById('diary-input').value = '';
        document.getElementById('date-input').value = formattedDate;
        wordCountText.textContent = `0字`;
        readmarkText.textContent = '';
        // 设置编辑状态
        const isEditable = true; 
        writePage.dataset.editable = isEditable;
        // 按钮全显示
        document.getElementById('newMenuButton').hidden = false;
        document.getElementById('saveMenuButton').hidden = false;
        document.getElementById('deleteMenuButton').hidden = false;
        // 解锁输入框
        document.getElementById('diary-input').disabled = false;
        document.getElementById('title-input').disabled = false;
        // 更新缓存状态
        writePage.dataset.title = "";
        writePage.dataset.content = "";
        writePage.dataset.editable = isEditable; // 新增可编辑状态标记
        switchMode('edit');

        return true;

    } catch (error) {
        console.error('打开空白日记失败:', error);
        alert(`操作失败: ${error.message}`);
        return false;
    }

});

document.getElementById('saveMenuButton').addEventListener('click', async () => {       //保存日记按钮
    const saveBtn = document.getElementById('saveMenuButton');
    const writePage = document.getElementById('write-page');        
    const dateInput = document.getElementById('date-input');
    const selectedDate = dateInput.value || writePage.dataset.createdDate;    
    
    try {
        // 保存前状态反馈
        saveBtn.classList.add('loading-spinner');
        saveBtn.disabled = true; // 防止重复点击

        var diaryCards = document.querySelectorAll('#diary-card-list .diary-card'); // 获取所有的日记卡片
            var isDiaryIdMatched = false;                                               // 初始化一个标志变量，用于表示是否找到匹配的日记卡片
            for (var i = 0; i < diaryCards.length; i++) {                               // 遍历所有日记卡片
                // 检查当前日记卡片的id是否与currentDiaryId相同
                if (diaryCards[i].dataset.createdDate == selectedDate && diaryCards[i].getAttribute("owner") == "self") {
                    isDiaryIdMatched = true;
                    if(selectedDate != writePage.dataset.createdDate){
                        if(!confirm("在"+writePage.dataset.createdDate+"已有一篇日记，是否确认覆盖保存？")){
                            return 0;//取消保存
                        }
                    }
                    break; // 找到匹配的日记卡片后，退出循环
                }
            }//此代码块用于检查是否是卡片列表不存在的新建日记

        // 执行保存
        const result = await window.writeDiary();
        
        if (result.status === "Success") {
            // 成功反馈
            saveBtn.style.transform = 'scale(1.2)';
            setTimeout(() => {
                saveBtn.style.transform = 'scale(1)';
                saveBtn.classList.remove('loading-spinner');
            }, 300);

            // 如果是新建日记，添加到左侧列表

            alert('保存成功！');
        } else {
            throw new Error(result.message || '保存失败');
        }
    } catch (error) {
        console.error('保存失败:', error);
        alert(`保存失败: ${error.message}`);
    } finally {
        saveBtn.classList.remove('loading-spinner');
        saveBtn.disabled = false;
    }
});

document.getElementById('deleteMenuButton').addEventListener('click', async () => {     //删除日记按钮
    try {
        const writePage = document.getElementById('write-page');
        const { currentUserId, currentDiaryId, ownerType } = writePage.dataset;

        // 权限验证
        if (ownerType !== 'self') {
            alert('无权限删除他人日记');
            return;
        }

        // 二次确认
        const confirmDelete = confirm('确定要永久删除这篇日记吗？此操作不可撤销！');
        if (!confirmDelete) return;

        // 执行删除
        const result = await aardio.deleteDiary(currentUserId, currentDiaryId);
        if (result !== "Success") throw new Error('删除操作未成功');

        // 删除成功处理
        _handleDeleteSuccess(currentDiaryId);
        
    } catch (error) {
        console.error('删除失败:', error);
        alert(`删除失败: ${error.message}`);
    }
});

document.getElementById('logout').addEventListener('click', async () => {    //退出登录
    if(hasUnsavedChanges()){
        const choice = await _showSaveDialog();
        if (choice === 'cancel') return false;
        if (choice === 'save' && !await window.writeDiary()) return false;      //检查未保存日记
    }

    aardio.logout();
});

document.addEventListener('wheel', function(e) {//禁止滚轮缩放
    if(e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('beforeunload', function(e) {//阻止返回上一页面
    e.preventDefault();
    e.returnValue = ''; // 对于某些浏览器，需要设置returnValue
});

window.addEventListener('pageshow', function(e) {//监听页面刷新
    // if (performance.navigation.type === 1) {//performance.navigation.type 的值可以为以下几种：0：表示页面是通过点击链接、表单提交等方式加载的。1：表示页面是通过刷新加载的。2：表示页面是通过“前进”或“后退”按钮加载的。
        aardio.loadPage();
    // }
});

let userId = "";
let port = "";
let uploadPort = "";
let pairedId = "";
let pairedGenderHan = "";
let isMember = false;

window.setPairedGender = function(e){
    if(e=="girl")
        pairedGenderHan = "她";
    else if(e=="boy")
        pairedGenderHan = "他";
    else
        pairedGenderHan = "Ta";
}

window.setUserId = function(e){
    userId = e;
}
window.setPort = function(e){
    port = e;
    document.getElementById("QRcode-img").src = `http://127.0.0.1:${port}/upload_temp/QRcode.jpg`
}
window.setUploadPort = function(e){
    uploadPort = e;
}
window.setPairedId = function(e){
    pairedId = e;
}

window.setUserColor = function(self,paired){
    const root = document.documentElement;
    self = self ? self : "boy";
    paired = paired ? paired : "girl";
    colorJson = {
        boy : "#4988b4",
        girl : "#ff7074"
    }
    root.style.setProperty('--color-self',colorJson[self]);
    root.style.setProperty('--color-paired',colorJson[paired]);
    document.querySelectorAll('.floatMenuButton').forEach(element => {element.style.backgroundColor = colorJson[self];});

}

window.setUserInfoCard = function(username, description, pairedInfo, writeStatistic, isMemberAar){
    document.getElementById("username-h3").textContent = username;
    document.getElementById("description").textContent = description;
    document.getElementById("paired-info").textContent = pairedInfo;
    document.getElementById("write-statistic").textContent = writeStatistic;
    if(isMemberAar){
        isMember = true
        document.getElementById("pro-tag").classList.remove("hidden")
    }
}

window.setPairSpan = function( role, pairname ){
    window.setPairedGender(role);
    var cardName = pairname ? pairname : "Ta";
    document.getElementById("paired-name-span").style.color = "var(--color-paired)";
    document.getElementById("paired-name-span").textContent = cardName;
        
}

window.setAvatar = function(avatarPath){
    document.getElementById("avatar-img").setAttribute("src",avatarPath);
}

const md = window.markdownit({
    html: true,
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } 
        catch (e) {}
      }
      return '';
    }
  });

function convertContentToPreview(content) {
    const userId = document.getElementById('write-page').dataset.currentUserId;
    // 使用正则表达式匹配包含 [hh:mm:ss] 的整行，不检查时间的合法性
    transformedContent = content.replace(/^(.*?)\[([0-9]{2}):([0-9]{2}):([0-9]{2})\](.*?)$/gm, '<span class="timetag-line"><span class="time-icon">🕘</span> $1$2:$3:$4$5</span>');
    //md.render或marked.parse
    return md.render( transformedContent.replace(/\[图(\d+)\]/g, (match, p1) => 
        `<img src="http://127.0.0.1:${port}/${userId}/${p1}.jpg" 
            style="max-width: 80%; margin: 5px 0;" title = "图${p1}" loading = "lazy" alt="图${p1}不存在，或者您的pro已过期">`
    ));
}

function formatTimeAgo(ts) {                    //ts为秒级readmark时间戳
    return moment.unix(ts)                      //来自你记的官方源码哇咔咔咔咔咔咔
        .locale('zh-cn')
        .fromNow()
        .replace(' ', '');
}

// 优化后的切换逻辑
const editBtn = document.getElementById('edit-mode');
const previewBtn = document.getElementById('preview-mode');
const toggleBtn = document.getElementById('toggle-mode');
const textarea = document.getElementById('diary-input');
const previewDiv = document.getElementById('preview-content');
const previewEle = {
    edit: [textarea, editBtn],
    preview: [previewDiv, previewBtn]
};

function switchMode(mode) {     //切换写作页面编辑、预览模式
    Object.entries(previewEle).forEach(([key, [el, btn]]) => {
        el.classList.toggle('hidden', key !== mode);
        el.setAttribute('data-mode', key === mode ? 'active' : '');
        btn.classList.toggle('active', key === mode);
    });
}

editBtn.addEventListener('click', () => switchMode('edit'));    //编辑、预览按钮添加事件监听器
previewBtn.addEventListener('click', () => {
    previewDiv.innerHTML = convertContentToPreview(textarea.value);
    hljs.highlightAll();
    switchMode('preview');
});

const diaryPage = document.getElementById('right-diary');
const diaryIcon = document.getElementById('write-logo');
const galleryPage = document.getElementById('right-gallery');
const picLsIcon = document.getElementById('gallery-logo'); 
const pairSysPage = document.getElementById('right-pair-sys');
const pairSysIcon = document.getElementById('pair-sys-logo');
const pagesEle = {
    diary: [diaryPage, diaryIcon],
    gallery: [galleryPage, picLsIcon],
    pairSys: [pairSysPage, pairSysIcon]
}

function switchPage(page) {     //切换写作页面编辑、预览模式
    Object.entries(pagesEle).forEach(([key, [el, btn]]) => {
        el.classList.toggle('hidden', key !== page);
        el.setAttribute('data-mode', key === page ? 'active' : '');
        btn.classList.toggle('active', key === page);
    });
}
diaryIcon.addEventListener('click', () => switchPage('diary'));    //左侧导航栏事件监听器
picLsIcon.addEventListener('click', () => switchPage('gallery')); 
pairSysIcon.addEventListener('click', () => switchPage('pairSys')); 

// 初始化模式
switchMode('preview');
switchPage('diary');

document.getElementById('pic-upload').addEventListener('change', function(event) {   //用户在图库选择上传文件时，先自动上传到本地服务端。再由aardio后台压图、上传你记服务器。
    // 获取用户选择的所有文件
    const files = event.target.files;

    // 遍历文件并逐个上传
    Array.from(files).forEach(file => {
        uploadFile(file); // 调用上传函数
    });
});

function uploadFile(file) {
    const formData = new FormData(); // 创建 FormData 对象
    formData.append('file', file); // 将文件添加到 FormData

    // 使用 Fetch API 上传文件
    fetch(`http://127.0.0.1:${uploadPort}/upload/`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json()) // 解析 JSON 数据
    .then(data => null)   // 处理数据
    .catch(error => console.error('Error:', error)); // 错误处理
}

document.addEventListener('DOMContentLoaded', (event) => {
    const uploadFrame = document.getElementById('upload-frame');

    // 添加拖拽事件监听器
    uploadFrame.addEventListener('dragover', (e) => {
        e.preventDefault(); // 阻止默认行为
    });

    uploadFrame.addEventListener('dragleave', (e) => {
        e.preventDefault(); // 阻止默认行为
    });

    uploadFrame.addEventListener('drop', (e) => {
        e.preventDefault(); // 阻止默认行为

        // 获取拖拽的文件
        const files = e.dataTransfer.files;
        // 遍历文件并上传
        Array.from(files).forEach(file => {
            uploadFile(file);
        });
    });

    // 确保其他元素不会干扰拖拽上传
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault(); // 阻止默认行为
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault(); // 阻止默认行为
    });
});


window.addUploadPreview = (uploadNum) => {
    // 获取模板
    const template = document.getElementById('upload-preview-template').content;
    const previewList = document.getElementById('upload-preview-list');

    // 克隆模板
    const clone = document.importNode(template, true);

    // 替换占位符
    clone.querySelector('.preview-container').id = `preview-${uploadNum}`;
    clone.querySelector('.preview-container').dataset.num = uploadNum;
    clone.querySelector('span').setAttribute('onclick', `removePreview('preview-${uploadNum}')`)
    clone.querySelector('img').src = `http://127.0.0.1:${port}/upload_temp/${uploadNum}.jpg`;

    // 插入到 gallery-container 中
    previewList.classList.remove('hidden');
    previewList.appendChild(clone);
}

window.addPicture = (picNum) => {
    // 获取模板
    const template = document.getElementById('pic-template').content;
    // 克隆模板
    const clone = document.importNode(template, true);
    // 父元素
    const parentElement = document.getElementById('gallery-container');

    // 替换占位符
    clone.querySelector('img').id = `pic-${picNum}`;
    clone.querySelector('img').src = `http://127.0.0.1:${port}/${userId}/${picNum}.jpg`;
    clone.querySelector('p').textContent = `图${picNum}`;

    // 插入到 gallery-container 中
    if (parentElement.firstChild) {
        parentElement.insertBefore(clone, parentElement.firstChild);
    } else {
        parentElement.appendChild(clone);
    }
}

function removePreview(previewId) {         //用于前端主动叉掉图像并且清除后端列表
    const previewElement = document.getElementById(previewId);
    if (previewElement) {
        var previewNum = previewElement.dataset.num;
        aardio.removePreview(previewNum);
        delUploadPreview(previewNum);
    }
}

window.delUploadPreview = (previewNum) => { //用于服务端上传成功后删除前端预览
    const previewList = document.getElementById('upload-preview-list');
    const previewContainer = document.getElementById(`preview-${previewNum}`);
    previewContainer.remove();
    if(previewList.querySelectorAll('img').length == 0){
        previewList.classList.add('hidden');
    }
}

document.getElementById('upload-btn').addEventListener('click', async () => {     //上传图片按钮
    if(isMember){
        aardio.uploadImage();
    }
    else{
        alert("因为服务器成本过高，\n图片功能仅对pro用户开放");
    }
});


//自动重载加载失败的图片——————————————————————————————————————————————————————————————————————
function handleImageError(img) {
    const src = img.src;
    img.src = ''; // 清空src，触发重新加载
    img.src = src;
}

// 为所有图片添加错误事件监听器
function addErrorListeners() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', () => handleImageError(img));
    });
}

// 监听DOM变化，确保动态插入的图片也能被处理
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.tagName === 'IMG') {
                node.addEventListener('error', () => handleImageError(node));
            }
        });
    });
});

// 开始观察整个文档的DOM变化
observer.observe(document.body, { childList: true, subtree: true });

// 初始时，为所有已存在的图片添加错误事件监听器
addErrorListeners();
//———————————————————————————————————————————————————————————————————————————————————————————

function unpair(){
    if(confirm("你确定要关闭「虫洞」吗？")){
        if(confirm("你真的要关闭「虫洞」吗？！")){
            aardio.unpair();
            alert("「虫洞」已关闭！")
            location.reload();
        }
    }
}