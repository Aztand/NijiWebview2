window.hasUnsavedChanges = () => {
    const writePage = document.getElementById('write-page');
    // 如果当前不可编辑，直接返回false
    if (writePage.dataset.ownerType !== 'self') return false;
        const title = document.getElementById('title-input').value;
        const content = document.getElementById('diary-input').value.replace(/\r\n|\r/g, '\n');
        return title !== writePage.dataset.title || content !== writePage.dataset.content.replace(/\r\n|\r/g, '\n');
    }

const _showSaveDialog = () => new Promise(resolve => {
    
    swalMsg.fire({
        text: "当前日记有未保存修改，是否保存？",
        confirmButtonText: "确定",
        showCancelButton: true
    }).then((result) => {
        if( result.isConfirmed ){
            resolve('save');
        }
        else{
            swalMsg.fire({
                text: "确定要放弃修改吗？",
                confirmButtonText: "确定",
                showCancelButton: true
            }).then((result) => {
                resolve( result.isConfirmed  ? 'discard' : 'cancel' )
            });
        }
    });

});

const _handleSwitchError = (error) => {
    console.error(`日记切换失败: ${error.stack}`);
    swalMsg.fire({
        text: `操作失败：${error.message}`
    });
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
    swalMsg.fire({
        text: "日记已永久删除"
    });


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
        swalMsg.fire({
            text: `保存失败：${error.message}`
        });
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
        swalMsg.fire({
            text: '无法加载日记内容'
        });
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
        swalMsg.fire({
            text: `操作失败: ${error.message}`
        });
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
            swalMsg.fire({
                text: `操作出错: ${error.message}`
            });
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
        swalMsg.fire({
            text: `操作失败: ${error.message}`
        });
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
                        // 位于检查日记是否存在的逻辑块中
                        const overwriteResult = await swalMsg.fire({
                            text: `在 ${writePage.dataset.createdDate} 已有一篇日记，是否确认覆盖保存？`,
                            showCancelButton: true,
                            confirmButtonText: "确定",
                        });

                        if (!overwriteResult.isConfirmed) {
                            Swal.close();
                            return;
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

            swalMsg.fire({
                text: '保存成功！'
            });
        } else {
            throw new Error(result.message || '保存失败');
        }
    } catch (error) {
        console.error('保存失败:', error);
        swalMsg.fire({
            text: `保存失败: ${error.message}`
        });
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
            swalMsg.fire({
                text: '无权限删除他人日记'
            });
            return;
        }

        const result = await swalMsg.fire({
            text: '确定要永久删除这篇日记吗？此操作不可撤销！',
            showCancelButton: true,
            confirmButtonText: "确定",
        });
        
        if (!result.isConfirmed) return;

        // 执行删除
        if(currentDiaryId){
            const delResult = await aardio.deleteDiary(currentUserId, currentDiaryId);
            if (delResult !== "Success") throw new Error('删除操作未成功');
        }

        // 删除成功处理
        _handleDeleteSuccess(currentDiaryId);
        
    } catch (error) {
        console.error('删除失败:', error);
        swalMsg.fire({
            text: `删除失败: ${error.message}`
        });
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

function insertTabAtCursor(areaId) {    //Tab缩进代码
    var textArea = document.getElementById(areaId);
    var scrollPos = textArea.scrollTop;
    var cursorPos = textArea.selectionStart;

    var front = (textArea.value).substring(0, textArea.selectionStart);
    var back = (textArea.value).substring(textArea.selectionEnd, textArea.value.length);
    
    textArea.value = front + "    " + back;
    cursorPos = cursorPos + 4;
    textArea.selectionStart = cursorPos;
    textArea.selectionEnd = cursorPos;
    textArea.focus();
    textArea.scrollTop = scrollPos;
}

function insertPrivateAtCursor(areaId) {    //Tab缩进代码
    var textArea = document.getElementById(areaId);
    var scrollPos = textArea.scrollTop;
    var cursorPos = textArea.selectionStart;

    var front = (textArea.value).substring(0, textArea.selectionStart);
    var back = (textArea.value).substring(textArea.selectionEnd, textArea.value.length);
    
    textArea.value = front + '[隐私区域开始]\n        \n[隐私区域结束]' + back;
    cursorPos = cursorPos + 17;
    textArea.selectionStart = cursorPos;
    textArea.selectionEnd = cursorPos;
    textArea.focus();
    textArea.scrollTop = scrollPos;
}

function handleTabKey(e) {
    if (e.keyCode === 9) { // Tab key
        e.preventDefault(); // Prevent default tab behavior
        insertTabAtCursor('diary-input');
    }
}

function insertTextAtCursor(areaId, text) {     //快捷键插入日期时间代码
    var textArea = document.getElementById(areaId);
    var scrollPos = textArea.scrollTop;
    var cursorPos = textArea.selectionStart;
  
    var front = textArea.value.substring(0, cursorPos);
    var back = textArea.value.substring(cursorPos, textArea.value.length);
  
    textArea.value = front + text + back;
    cursorPos += text.length;
    textArea.selectionStart = cursorPos;
    textArea.selectionEnd = cursorPos;
    textArea.focus();
    textArea.scrollTop = scrollPos;
  }
  
function handleSpecialKeys(e) {
    if (e.ctrlKey) {
        if (e.keyCode === 68) { // Ctrl+D
            e.preventDefault(); // Prevent default Shift+D behavior
            var date = new Date();
            var dateString = date.getFullYear() + "/" +
                            ("0" + (date.getMonth() + 1)).slice(-2) + "/" +
                            ("0" + date.getDate()).slice(-2) + " [" +
                            ("0" + date.getHours()).slice(-2) + ":" +
                            ("0" + date.getMinutes()).slice(-2) + ":" +
                            ("0" + date.getSeconds()).slice(-2) + "]";
            insertTextAtCursor('diary-input', dateString);
        } else if (e.keyCode === 84) { // Ctrl+T
            e.preventDefault(); // Prevent default Shift+T behavior
            var time = new Date();
            var timeString = "[" +
                            ("0" + time.getHours()).slice(-2) + ":" +
                            ("0" + time.getMinutes()).slice(-2) + ":" +
                            ("0" + time.getSeconds()).slice(-2) + "]";
            insertTextAtCursor('diary-input', timeString);
        } else if (e.keyCode === 83 ){  // Ctrl+S
            if(!document.getElementById('saveMenuButton').hasAttribute('hidden')){
                document.getElementById('saveMenuButton').click();
            }
        } else if (e.keyCode === 80){   //Ctrl+P
            e.preventDefault();
            insertPrivateAtCursor('diary-input');
        }
    }
}

function windowSpecialKeys(e) {
    if (e.ctrlKey) {
        if (e.keyCode === 77 ) {// Ctrl+M
            e.preventDefault();
            markdownCheckbox.click();
        }
    }
}

// 绑定事件监听器到textarea
diaryInput.addEventListener('keydown', handleSpecialKeys);
window.addEventListener('keydown', windowSpecialKeys);

function ToggleHotkeyTipsShow() {
    // 选择所有具有'.Hotkey-tips'类的元素
    const hotkeyTipsElements = document.querySelectorAll('.Hotkey-tips');

    // 遍历所有选中的元素，并切换'hidden'类
    hotkeyTipsElements.forEach(element => {
    element.classList.toggle('hidden');
    });

}

let userId = "";
let port = "";
let uploadPort = "";
let pairedId = "";
let pairedName = "";
let pairedGenderHan = "";
let useMarkdown = false;
let closeUpgrade = false;
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
    var colorJson = {
        boy : "#4988b4",
        girl : "#ff7074"
    }

    root.style.setProperty('--color-self',colorJson[self]);
    root.style.setProperty('--color-paired',colorJson[paired]);
    root.style.setProperty('--img-unpair-logo',`var(--img-${self})`);
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
    pairedName = pairname ? pairname : "Ta";
    PAGE_CONFIGS['paired']['paragraphs'][1] = `正在与<span id = "paired-name-span">${pairedName}</span>交换日记中。如需停止，请关闭「虫洞」。`
    setPairPage('paired');
}

window.setAvatar = function(avatarPath){
    var elements = document.getElementsByClassName("avatar-img");
    Array.from(elements).forEach(function(element) {
      element.setAttribute("src", avatarPath);
    });    
}

// 所有的选项列表（默认情况下）
var md = window.markdownit({
    html:         false,        // 在源码中启用 HTML 标签
    xhtmlOut:     false,        // 使用 '/' 来闭合单标签 （比如 <br />）。
                                // 这个选项只对完全的 CommonMark 模式兼容。
    breaks:       false,        // 转换段落里的 '\n' 到 <br>。
    langPrefix:   'language-',  // 给围栏代码块的 CSS 语言前缀。对于额外的高亮代码非常有用。
    linkify:      false,        // 将类似 URL 的文本自动转换为链接。
  
    // 启用一些语言中立的替换 + 引号美化
    typographer:  false,
  
    // 双 + 单引号替换对，当 typographer 启用时。
    // 或者智能引号等，可以是 String 或 Array。
    // 比方说，你可以支持 '«»„“' 给俄罗斯人使用， '„“‚‘'  给德国人使用。
    // 还有 ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] 给法国人使用（包括 nbsp）。
    quotes: '“”‘’',
  
    // 高亮函数，会返回转义的HTML。
    // 或 '' 如果源字符串未更改，则应在外部进行转义。
    // 如果结果以 <pre ... 开头，内部包装器则会跳过。
    highlight: (str, lang) => {
        const autoDetect = !lang; // 未指定语言时自动检测
        const result = autoDetect ? 
          hljs.highlightAuto(str) : 
          hljs.highlight(str, { language: lang || 'plaintext' });
        
        return `<pre><code class="hljs language-${result.language}">${result.value}</code></pre>`;
    }
    
}).disable('code');

function convertContentToPreview(content) {

    const userId = document.getElementById('write-page').dataset.currentUserId;

    if( !useMarkdown ){ //优先渲染你记标准格式
        transformedContent = content;
        // 使用正则表达式匹配包含 [hh:mm:ss] 的整行，不检查时间的合法性
        transformedContent = transformedContent.replace(/^(.*?)\[([0-9]{2}):([0-9]{2}):([0-9]{2})\](.*?)$/gm, '<span class="timetag-line"><span class="time-icon">🕘</span> $1$2:$3:$4$5</span>');
        // 处理图片标签
        transformedContent = transformedContent.replace(/\[图(\d+)\]/g, (match, p1) => 
            `<img src="http://127.0.0.1:${port}/${userId}/${p1}.jpg" 
                style="max-width: 80%; margin: 5px 0;" title = "图${p1}" loading = "lazy" alt="图${p1}不存在，或者您的pro已过期">`
        );
        return transformedContent;
    }
    else{
        transformedContent = content;
        transformedContent = transformedContent.replace(/\[图(\d+)\]/g, (match, p1) => 
            `![图${p1}不存在，或者您的pro已过期](http://127.0.0.1:${port}/${userId}/${p1}.jpg "图${p1}")`
        );
        transformedContent = md.render(transformedContent);
        return transformedContent;
    }

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
        swalMsg.fire({
            text: "因为服务器成本过高，\n图片功能仅对pro用户开放"
        });
    }
});


//自动重载加载失败的图片—————————————————————START—————————————————————————————————————————————————
// 使用 WeakMap 存储图片的重试次数（避免内存泄漏）
const retryCountMap = new WeakMap();

function handleImageError(img) {
    const currentCount = retryCountMap.get(img) || 0;
    
    if (currentCount < 3) {
        retryCountMap.set(img, currentCount + 1);
        
        // 使用 setTimeout 延迟重试
        setTimeout(() => {
            // 确保图片仍然在文档中
            if (document.body.contains(img)) {
                const src = img.src;
                img.src = '';
                img.src = src;
            }
        }, 3000); // 5秒间隔
    } else {
        // 超过最大重试次数则移除监听器
        img.removeEventListener('error', handleImageError);
    }
}

// 为所有图片添加错误事件监听器
function addErrorListeners() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        // 初始化重试计数器
        if (!retryCountMap.has(img)) {
            retryCountMap.set(img, 0);
        }
        img.addEventListener('error', () => handleImageError(img));
    });
}

// 监听DOM变化，确保动态插入的图片也能被处理
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.tagName === 'IMG') {
                // 初始化新图片的重试计数器
                retryCountMap.set(node, 0);
                node.addEventListener('error', () => handleImageError(node));
            }
        });
    });
});

// 开始观察整个文档的DOM变化
observer.observe(document.body, { childList: true, subtree: true });

// 初始时，为所有已存在的图片添加错误事件监听器
addErrorListeners();
//—————————————————————————————————————————END——————————————————————————————————————————————————



//虫洞页面设置及功能函数————————————————————START—————————————————————————————————————————————————

// 页面配置函数
function setPairPage(configName) {

    var config = PAGE_CONFIGS[configName];

    const container = document.getElementById('pair-container');
    
    // 清空之前的内容
    container.querySelector('.pair-text').innerHTML = '';
    container.querySelector('.pair-buttons').innerHTML = '';

    // 设置返回按钮
    const backBtn = container.querySelector('.pair-back-btn');
    backBtn.className = config.showBack ? 'pair-back-btn' : 'pair-back-btn hidden';
    if(config.backAction) {
        backBtn.onclick = config.backAction;
    }

    // 设置输入框
    const input = container.querySelector('.pair-input');
    input.className = config.showInput ? 'pair-input' : 'pair-input hidden';

    // 设置Logo
    const logo = container.querySelector('.pair-logo');
    logo.className = `pair-logo ${config.logoClass || ''}`;

    //处理未求名时特殊Logo样式
    const unknowContainer = container.querySelector('.unknow-name-container');
    if(config.unknowName){
        logo.classList.toggle("hidden",true);
        unknowContainer.classList.toggle('hidden',false);
    }
    else{
        logo.classList.toggle("hidden",false);
        unknowContainer.classList.toggle('hidden',true);
    }

    // 设置标题
    container.querySelector('#pair-title').textContent = config.title;

    // 设置文本段落
    const textContainer = container.querySelector('.pair-text');
    config.paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.innerHTML = text;
        textContainer.appendChild(p);
    });

    // 设置按钮
    const btnContainer = container.querySelector('.pair-buttons');
    config.buttons.forEach(btnConfig => {
        const btn = document.createElement('button');
        btn.className = `${btnConfig.className || ''}`;
        btn.innerHTML = `${btnConfig.text} ${btnConfig.icon || ''}`;
        btn.onclick = btnConfig.action;
        btnContainer.appendChild(btn);
    });

    return '切换成功';
}

// 预定义的页面配置库
PAGE_CONFIGS = {
    // 未匹配初始
    unpair: {
        logoClass: "unpair-logo-img",
        title: "平行空间",
        showInput: false,
        paragraphs: [
            "虫洞关闭",
            '当两人互相开启「虫洞」后，异性的图标便会点亮。然后便能看到对方的日记。<br />当一方写了新的日记，或更新了已有的日记时，另一方会收到推送通知。<br />「虫洞」开启之后可以随时关闭。'
        ],
        buttons: [
            {
                text: "随机匹配",
                className: "random-btn",
                icon: '<span class="Ionicon-xl"></span>',
                action: () => setPairPage('wormhole')
            },
            {
                text: "定向开启", 
                className: "direct-btn",
                icon: '<span class="Ionicon-xl"></span>',
                action: () => setPairPage('directPair')
            }
        ]
    },

    // 虫洞介绍页
    wormhole: {
        logoClass: "wormhole-logo",
        title: "随机匹配",
        showBack: true,
        backAction: () => setPairPage('unpair'),
        showInput: false,
        paragraphs: [
            "在宇宙空间里，漂浮着很多个「时空涡旋」。",
            '如果你想和别的世界「随机匹配」，不妨进入一个「涡旋」',
            '当里面的世界足够多时，「时空涡旋」便会炸裂。这时，它里面的世界们便会随机配对。'
        ],
        buttons: [
            {
                text: "加入这个「涡旋」",
                className: "join-wormhole-btn",
                icon: '<span class="Ionicon-xl"></span>',
                action: () => joinRandomPair()
            }
        ]
    },

    // 虫洞匹配中
    pairing: {
        logoClass: "wormhole-logo",
        title: "随机匹配",
        showBack: true,
        backAction: () => setPairPage('unpair'),
        showInput: false,
        paragraphs: [
            "已经进入「涡旋」，等待匹配...",
            '「涡旋」会随着吸入世界的增加而变的越来越不稳定。当它的能量达到极值时，便会炸裂。此时，被它吸入的世界们便会「随机配对」',
            `下次「涡旋」炸裂时间为：<br />${new Date().getHours() < 20 ? '今晚' : '明晚'}20:00`
        ],
        buttons: [
            {
                text: "断开连接",
                className: "full-color-btn",
                action: () => cancelRandomPair()
            }
        ]
    },

    // 定向请求页
    directPair: {
        logoClass: "unpair-logo-img",
        title: "平行空间",
        showBack: true,
        backAction: () => setPairPage('unpair'),
        showInput: true,
        paragraphs: ["定向开启"],
        buttons: [
            {
                text: "发出配对请求",
                className: "send-direct-btn",
                action: () => sendDirec()
            }
        ]
    },

    // 定向待回应
    directSended: {
        logoClass: "unpair-logo-img",
        title: "平行空间",
        showBack: false,
        paragraphs: ["已单向开启虫洞，正在等待对方开启……",
                     "为了防止单向骚扰，「定向开启」只有在双方都发起请求之后才能配对成功。在配对成功之前我们不会向另一方发出通知。请主动联系对方，让他也跟你定向开启。成功后我们会发送你配对成功的通知。"
        ],
        buttons: [
            {
                text: "停止我的请求",
                className: "full-color-btn",
                action: () => unpair( false )
            }
        ]
    },

    // 已有配对页
    paired: {
        logoClass: "pair-logo-img",
        title: "平行空间",
        showBack: false,
        paragraphs: [
            "虫洞开启",
            `正在与<span id = "paired-name-span">Ta</span>交换日记中。如需停止，请关闭「虫洞」。`,
            "当对方更新日记时会收到通知"
        ],
        buttons: [
            {
                text: "关闭虫洞",
                className: "full-color-btn",
                action: () => unpair( true )
            }
        ]
    },

    // 虫洞未求名
    unknowName: {
        unknowName: true,
        paragraphs: [
            "第0天",
            "祝贺！已与来自「时空涡旋」另一边的<span class = 'card-paired'>Ta</span>配对。",
            "你们现在可以看到对方的<b>最新的三篇</b>日记了。<br />以后，每过一天你们都可以多看到一篇对方以前的日记，以及所有新增的日记。",
            "如果你想知道对方的名字，可以发出「求名」请求。「求名」通过后可以看到彼此所有的日记",
            "如果你不想继续配对，随时可以终止。"
        ],
        buttons: [
            {
                text: "「你的名字」是？",
                className: "know-name-btn",
                action: () => knowYourName()
            },
            {
                text: "终止配对",
                className: "full-color-btn",
                action: () => unpair( true )
            }
        ]
    },

    // 虫洞未求名
    askingName: {
        unknowName: true,
        paragraphs: [
            "第0天",
            "祝贺！已与来自「时空涡旋」另一边的<span class = 'card-paired'>Ta</span>配对。",
            "你们现在可以看到对方的<b>最新的三篇</b>日记了。<br />以后，每过一天你们都可以多看到一篇对方以前的日记，以及所有新增的日记。",
            "如果你想知道对方的名字，可以发出「求名」请求。「求名」通过后可以看到彼此所有的日记",
            "如果你不想继续配对，随时可以终止。"
        ],
        buttons: [
            {
                text: "已发出「求名」请求",
                className: "asking-name-btn",
                action: () => null
            },
            {
                text: "终止配对",
                className: "full-color-btn",
                action: () => unpair( true )
            }
        ]
    }
};

setPairPage('unpair');

function joinRandomPair(){
    aardio.joinRandomPair();
    swalMsg.fire({
        title: "加入「涡旋」成功",
        text: "耐心等待「涡旋」炸裂吧！",
    }).then((result) => {
        setPairPage('pairing');
    });
}

function cancelRandomPair(){
    aardio.cancelRandomPair();
    swalMsg.fire({
        text: "虫洞已关闭",
    }).then((result) => {
        setPairPage('wormhole');
    });
}

function knowYourName(){
    aardio.knowYourName();
    swalMsg.fire({
        text: "求名已发送！"
    });
}

async function sendDirec(){
    var pairEmail = document.getElementById('pair-email-input').value.trim();
    var pairResult = await aardio.directPair(pairEmail);
    if(pairResult == 'paired'){
        swalMsg.fire({
            title: "配对成功",
            text: "虫洞已经开启，让「她的名字」出现在「你的日记」吧！"
        }).then((result) => {
            refresh();
        });
    }
    else if(pairResult == 'waiting'){
        swalMsg.fire({
            title: "请求已经发送",
            text: "下面就等对方也向你发送请求啦"
        }).then((result) => {
            setPairPage('directSended')
        });
    }
    else {
        swalMsg.fire({
            text: "配对请求失败，也许你填写的邮箱不可用"
        })
    }
}

function refresh(){
    document.write("刷新中……若刷新失败请您手动刷新");//清空页面，防止刷新失败

    location.reload();
}

function unpair( refresh ){

    swalMsg.fire({
        text: "你确定要关闭「虫洞」吗？",
        confirmButtonText: "确定",
        showCancelButton: true
    }).then((result) => {
        if( result.isConfirmed ){
            aardio.unpair();
            swalMsg.fire({
                text: "「虫洞」已关闭！"
            });
            setPairPage('unpair')
            if(refresh){
                refresh();
            }
        }
    });

}

const swalMsg = Swal.mixin({
    title: "你的日记",
    text: "",
    showConfirmButton: true,
    confirmButtonText: '好的',
    showCancelButton: false,
    cancelButtonText: '取消',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
        title: "left-align",
        htmlContainer: "left-align",
        actions: "right-align-item",
        confirmButton: "niji-style-button",
        cancelButton: "niji-style-button"
    }
});

//————————————————设置界面相关

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

const markdownCheckbox = document.getElementById('markdown-checkbox');
// 添加事件监听器，当checkbox的状态改变时触发
markdownCheckbox.addEventListener('change', function() {
    // 更新变量useMarkdown为checkbox的当前状态
    useMarkdown = this.checked;
    aardio.remMarkdown(this.checked);
    previewDiv.innerHTML = convertContentToPreview(textarea.value);
    hljs.highlightAll();
});

const closeUpgradeCheckbox = document.getElementById('upgrade-checkbox');
// 添加事件监听器，当checkbox的状态改变时触发
markdownCheckbox.addEventListener('change', function() {
    // 更新变量useMarkdown为checkbox的当前状态
    closeUpgrade = this.checked;
    aardio.setUpgrade(this.checked);
});