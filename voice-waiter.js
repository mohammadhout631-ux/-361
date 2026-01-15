/**
 * Al-Hout Restaurant | Royal Lebanese Waiter (v16)
 * Continuous Ordering | Large UI | Clear Admin Reports
 */

const VoiceWaiter = {
    // Config
    TELEGRAM_BOT_TOKEN: '8371588532:AAGNQ8U_i3insICuGQ6-2XFb2-OwDiHDjfE',
    TELEGRAM_GROUP_ID: '-1003610965844',

    state: 'IDLE', // IDLE, ASKING_ORDER, ASKING_TABLE, ASKING_BILL_TABLE, ASKING_COMPLAINT_TABLE
    currentTable: '',
    allDetectedItems: [], // {name, qty, price}
    lastComplaint: '',
    numMap: {
        'واحد': 1, 'واحدة': 1, 'واحده': 1,
        'اتنين': 2, 'تنين': 2, 'اثنان': 2, 'اثنين': 2, 'ثنتين': 2,
        'تلاتة': 3, 'تلاته': 3, 'ثلاثة': 3, 'ثلاثه': 3,
        'اربعة': 4, 'اروعه': 4, 'أربعة': 4, 'أربعه': 4,
        'خمسة': 5, 'خمسه': 5,
        'ستة': 6, 'سته': 6,
        'سبعة': 7, 'سبعه': 7,
        'تمانية': 8, 'تمانيه': 8, 'ثمانية': 8, 'ثمانيه': 8,
        'تسعة': 9, 'تسعه': 9,
        'عشرة': 10, 'عشره': 10
    },

    // ... (rest of props)

    extractNumber: function (str) {
        if (!str) return null;

        // 1. Check for Arabic-Indic Digits (٠-٩)
        const arabicIndicMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
        let normalizedStr = str.replace(/[٠-٩]/g, d => arabicIndicMap[d]);

        // 2. Check for Standard Digits
        const match = normalizedStr.match(/(\d+)/);
        if (match) return parseInt(match[1]);

        // 3. Check Words (using normalized text)
        for (let key in this.numMap) {
            if (normalizedStr.includes(key)) return this.numMap[key];
        }

        return null;
    },

    recognition: null,
    synth: window.speechSynthesis,
    isListening: false,
    menuItems: [],
    audioUnlocked: false,

    init: async function () {
        try {
            console.log("VoiceWaiter: Initializing Continuous Flow (v16)...");
            this.setupRecognition();
            await this.loadMenu(); // Load data first to get Name
            this.renderUI();
            this.setupListeners();
            this.preloadVoices();
        } catch (e) {
            console.error("VoiceWaiter Init Error:", e);
        }
    },

    preloadVoices: function () {
        const load = () => { if (this.synth.getVoices().length > 0) console.log("Voices Ready"); };
        load();
        if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = load;
    },

    loadMenu: async function () {
        try {
            const data = await RestaurantData.getData();
            this.waiterName = data.info.waiterName || "نادل مطعم الحوت 🍽";
            // Sort by length DESC
            this.menuItems = (data.items || []).sort((a, b) => b.name.trim().length - a.name.trim().length);
        } catch (e) { console.error(e); }
    },

    setupRecognition: function () {
        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Speech) return;
        this.recognition = new Speech();
        this.recognition.lang = 'ar-LB';
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            document.getElementById('voice-mic-btn').classList.add('recording');
        };

        this.recognition.onresult = (e) => {
            const transcript = e.results[e.results.length - 1][0].transcript;
            this.handleInput(transcript, true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            document.getElementById('voice-mic-btn').classList.remove('recording');
            const isVisible = document.getElementById('voice-waiter-overlay') && document.getElementById('voice-waiter-overlay').style.display === 'flex';
            if (isVisible && this.state !== 'IDLE') {
                setTimeout(() => {
                    try { if (!this.isListening) this.recognition.start(); } catch (e) { }
                }, 300);
            }
        };

        this.recognition.onerror = () => { this.isListening = false; };
    },

    renderUI: function () {
        if (document.getElementById('voice-waiter-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'voice-waiter-overlay';
        overlay.innerHTML = `
            <div class="luxury-card">
                <div class="luxury-header">
                    <span class="luxury-title">نادل مطعم الحوت 🍽</span>
                    <i class="fas fa-times" id="close-waiter" style="cursor:pointer; color:#d4af37;"></i>
                </div>
                <div class="luxury-body">
                    <div id="waiter-status">تفضل، شو بتحب تطلب؟ ✨</div>
                    
                    <div id="luxury-invoice-container" style="display:none;">
                        <div class="lux-paper">
                            <div class="lux-store-name">طلبك 🧾</div>
                            <div class="lux-divider"></div>
                            <div class="lux-scroll-area">
                                <table class="lux-table">
                                    <tbody id="lux-items-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="waiter-actions">
                        <div class="control-row">
                            <button id="finish-order-btn" class="action-btn finish-btn" title="إنهاء الطلب">
                                <i class="fas fa-check"></i> إتمام الطلب
                            </button>
                            <div class="mic-wrapper">
                                <button id="voice-mic-btn"><i class="fas fa-microphone"></i></button>
                                <div class="speaking-indicator" id="speak-ind">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="lux-input-box">
                            <textarea id="waiter-text" placeholder="اكتب طلبك..." rows="1"></textarea>
                            <div class="input-btns">
                                <button id="send-btn" title="إرسال"><i class="fas fa-paper-plane"></i></button>
                                <button id="bill-btn" title="طلب الفاتورة"><i class="fas fa-file-invoice-dollar"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                #voice-waiter-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.9); z-index: 9999; display: none; align-items: center; justify-content: center; backdrop-filter: blur(10px);
                }
                .luxury-card { background: #111; border: 1px solid #d4af37; width: 95%; max-width: 500px; height: 90vh; max-height: 800px; border-radius: 30px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
                .luxury-header { background: #000; color: #d4af37; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; }
                .luxury-card { background: #111; border: 1px solid #d4af37; width: 95%; max-width: 500px; height: 90vh; max-height: 800px; border-radius: 30px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
                .luxury-header { background: #000; color: #d4af37; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; }
                .luxury-title { font-weight: bold; font-size: 1.4em; }
                .luxury-body { padding: 20px; color: white; text-align: center; flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
                #waiter-status { font-size: 1.4em; margin-bottom: 15px; line-height: 1.5; min-height: 50px; font-weight:bold; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.3); }
                .luxury-body { padding: 20px; color: white; text-align: center; flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
                #waiter-status { font-size: 1.4em; margin-bottom: 15px; line-height: 1.5; min-height: 50px; font-weight:bold; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.3); }
                
                #luxury-invoice-container { flex: 1; margin-bottom: 20px; overflow: hidden; display: flex; flex-direction: column; }
                .lux-paper { background: #fff; color: #000; padding: 15px; border-radius: 15px; text-align: right; direction: rtl; display: flex; flex-direction: column; height: 100%; box-shadow: inset 0 0 20px rgba(0,0,0,0.1); }
                .lux-store-name { font-weight: 900; font-size: 1.5em; text-align: center; color: #222; margin-bottom: 5px; }
                .lux-divider { height: 2px; background: #000; margin: 10px 0; }
                .lux-scroll-area { flex: 1; overflow-y: auto; padding-right: 5px; }
                .lux-table { width: 100%; border-collapse: collapse; }
                .lux-table td { padding: 12px 5px; border-bottom: 1px solid #ddd; font-size: 1.3em; font-weight: 700; color: #000; }
                .lux-table td:first-child { text-align: right; }
                .lux-table td:last-child { text-align: left; width: 60px; color: #d4af37; font-weight: 900; }
                
                .waiter-actions { margin-top: auto; display: flex; flex-direction: column; gap: 15px; }
                .control-row { display: flex; justify-content: center; align-items: center; gap: 20px; }
                
                #voice-mic-btn { width: 80px; height: 80px; border-radius: 50%; background: #d4af37; border: 4px solid #fff; font-size: 30px; cursor: pointer; color: #000; box-shadow: 0 0 20px rgba(212, 175, 55, 0.4); }
                #voice-mic-btn.recording { animation: pulseV16 1.5s infinite; background: #ff4444; border-color: #ffaaaa; color: white; }
                
                .action-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; font-size: 1.1em; display: flex; align-items: center; gap: 8px; transition: 0.3s; }
                .finish-btn { background: #28a745; color: white; display: none; box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4); }
                .finish-btn:hover { transform: scale(1.05); background: #218838; }
                
                .speaking-indicator { display: none; position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%); gap: 5px; }
                .speaking-indicator span { width: 10px; height: 10px; background: #d4af37; border-radius: 50%; animation: bounceV15 0.5s infinite alternate; }
                .speaking-indicator span:nth-child(2) { animation-delay: 0.1s; }
                .speaking-indicator span:nth-child(3) { animation-delay: 0.2s; }
                
                @keyframes bounceV15 { to { transform: translateY(-10px); } }
                @keyframes pulseV16 { 0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(255, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); } }
                
                .lux-input-box { display: flex; background: #222; border-radius: 20px; padding: 10px; border: 1px solid #444; align-items: center; gap: 10px; }
                #waiter-text { flex: 1; background: transparent; border: none; color: white; outline: none; resize: none; direction: rtl; font-size: 16px; font-family: inherit; height: 24px; }
                .input-btns { display: flex; gap: 8px; }
                #send-btn, #bill-btn { background: #d4af37; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: #000; display:flex; align-items:center; justify-content:center; }
                #bill-btn { background: #fff; }
            </style>
        `;
        document.body.appendChild(overlay);
    },

    setupListeners: function () {
        const waBtn = document.getElementById('whatsapp-btn');
        if (waBtn) {
            waBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling
                console.log("Voice Waiter Triggered");
                this.open();
            };
        }
        // Fallback for class-based buttons
        document.querySelectorAll('.btn-whatsapp').forEach(b => {
            if (b.id !== 'whatsapp-btn') {
                b.onclick = (e) => { e.preventDefault(); this.open(); };
            }
        });
        document.getElementById('close-waiter').onclick = () => this.close();
        document.getElementById('voice-mic-btn').onclick = () => {
            if (this.isListening) this.recognition.stop(); else this.recognition.start();
        };
        const handleSend = () => {
            const t = document.getElementById('waiter-text').value.trim();
            if (t) { document.getElementById('waiter-text').value = ''; this.handleInput(t, false); }
        };
        document.getElementById('send-btn').onclick = handleSend;
        document.getElementById('bill-btn').onclick = () => this.handleInput("فاتورة", false);
        document.getElementById('finish-order-btn').onclick = () => this.manualFinishOrder();
        document.getElementById('waiter-text').onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } };
    },

    open: function () {
        this.resetState();
        document.getElementById('voice-waiter-overlay').style.display = 'flex';
        if (!this.audioUnlocked) {
            const silent = new SpeechSynthesisUtterance(" ");
            silent.volume = 0;
            this.synth.speak(silent);
            this.audioUnlocked = true;
        }
        setTimeout(() => this.speak("أهلاً بك.. تفضل، شو الحابب تطلب؟"), 500);
    },

    resetState: function () {
        this.state = 'ASKING_ORDER';
        this.allDetectedItems = [];
        this.currentTable = '';
        this.lastComplaint = '';
        document.getElementById('luxury-invoice-container').style.display = 'none';
        document.getElementById('waiter-status').innerText = "تفضل، شو بتحب تطلب؟ ✨";
        document.getElementById('finish-order-btn').style.display = 'none';
    },

    close: function () {
        document.getElementById('voice-waiter-overlay').style.display = 'none';
        this.state = 'IDLE';
        if (this.recognition) this.recognition.stop();
        this.synth.cancel();
    },

    speak: function (text) {
        if (!this.synth) return;
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = this.synth.getVoices();
        let ar = voices.find(v => v.lang.includes('ar'));
        if (ar) u.voice = ar;
        u.lang = 'ar-LB'; // Trying LB or SA
        u.rate = 1.1;
        this.synth.speak(u);
    },

    playSound: function (type) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'add') {
            osc.frequency.value = 800;
            gain.gain.value = 0.1;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'start') {
            osc.frequency.value = 600;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        }
    },

    handleInput: function (text, isVoice = false) {
        if (!text) return;
        const low = text.toLowerCase().trim();

        // 1. Complaint Check
        const complaintKeywords = ['late', 'missing', 'wrong', 'delay', 'تأخر', 'وين طلبي', 'نسيتوا', 'مشكلة', 'متاخر', 'غلط', 'problem'];
        if (complaintKeywords.some(k => low.includes(k)) && this.state !== 'ASKING_COMPLAINT_TABLE') {
            this.lastComplaint = text;
            this.state = 'ASKING_COMPLAINT_TABLE';
            this.speak("طلبك على عيني.. شو رقم الطاولة؟");
            document.getElementById('waiter-status').innerText = "شو رقم الطاولة؟ 🪑";
            return;
        }

        // 2. Bill Check
        const billKeywords = ['فاتورة', 'فاتوره', 'الحساب', 'حساب', 'bill', 'invoice', 'check', 'خلاص'];
        // Note: "خلاص" can also mean finish order if in ordering mode, we need to be careful.
        // If we have items, "خلاص" means finish ordering. If no items, it might mean "Bring Bill" or just "Done".
        // Let's assume if items > 0, "خلاص" means FINISH ORDER. If items == 0, "خلاص" is ignored or treated as bill.

        const isBill = billKeywords.some(k => low.includes(k)) && !low.includes('خلاص'); // "khalas" handled separately
        if (isBill && this.state !== 'ASKING_BILL_TABLE') {
            this.state = 'ASKING_BILL_TABLE';
            this.speak("حاضر، شو رقم الطاولة؟");
            document.getElementById('waiter-status').innerText = "شو رقم الطاولة؟ 🪑";
            return;
        }

        switch (this.state) {
            case 'ASKING_ORDER':
                // Check for Finish Keywords -- Removed 'tamam', 'bas', 'shukran'
                const finishKeywords = ['خلاص', 'خلص', 'كافي', 'بكفي', 'done', 'finish', "that's all", 'إتمام', 'اتمام'];
                if (finishKeywords.some(w => low.includes(w)) && this.allDetectedItems.length > 0) {
                    this.manualFinishOrder();
                    return;
                }

                // Scan for items detection
                const beforeCount = this.allDetectedItems.length;
                this.scanItems(text);
                const afterCount = this.allDetectedItems.length;

                if (afterCount > beforeCount) {
                    this.renderInvoice();
                    // Feedback without interrupting flow excessively
                    document.getElementById('waiter-status').innerText = `تمت إضافة ${afterCount - beforeCount} صنف... شو كمان؟`;
                    this.playSound('add');

                    if (this.isListening) {
                        // Short confirmation logic if needed
                    }

                    // Show finish button if we have items
                    if (this.allDetectedItems.length > 0) {
                        document.getElementById('finish-order-btn').style.display = 'flex';
                    }
                } else if (!isVoice) {
                    // Fallback for typed text that isn't a known item
                    let customQty = 1;
                    let customName = text;

                    const extracted = this.extractNumber(text);
                    if (extracted) {
                        customQty = extracted;
                        // Clean digits from name (Arabic & English)
                        customName = text.replace(/[0-9٠-٩]+/g, '').trim();
                        // If result is empty (user just typed "3"), keep original
                        if (!customName) customName = text;
                    }

                    this.allDetectedItems.push({ name: customName, qty: customQty, price: 0, isCustom: true });
                    this.renderInvoice();
                    document.getElementById('waiter-status').innerText = "تم تسجيل ملاحظتك 📝";
                    this.playSound('add');
                    if (this.allDetectedItems.length > 0) {
                        document.getElementById('finish-order-btn').style.display = 'flex';
                    }
                }
                break;

            case 'ASKING_TABLE':
            case 'ASKING_BILL_TABLE':
            case 'ASKING_COMPLAINT_TABLE':
                const tNum = this.extractTableNumber(text);
                if (tNum) {
                    this.currentTable = tNum;

                    if (this.state === 'ASKING_TABLE') {
                        this.report('ORDER');
                        this.speak("تمام.. طلبك وصل للمطبخ. ألف صحة!");
                        document.getElementById('waiter-status').innerText = "تم الإرسال بنجاح ✅";
                    } else if (this.state === 'ASKING_BILL_TABLE') {
                        this.report('BILL');
                        this.speak("طلب الفاتورة وصل للإدارة.");
                        document.getElementById('waiter-status').innerText = "وصل الطلب ✅";
                    } else {
                        this.report('COMPLAINT');
                        this.speak("وصلت الملاحظة للإدارة ورح نعالجها فوراً.");
                        document.getElementById('waiter-status').innerText = "وصلت الملاحظة ✅";
                    }
                    setTimeout(() => this.close(), 4000);
                } else {
                    this.speak("عفواً.. ما سمعت الرقم، أي طاولة؟");
                }
                break;
        }
    },

    manualFinishOrder: function () {
        if (this.allDetectedItems.length === 0) {
            this.speak("ما طلبت شي بعد!");
            // If they say finish but have no items, let's treat it as asking for bill? 
            // Better to stick to "No items ordered".
            return;
        }
        this.state = 'ASKING_TABLE';
        this.speak("على راسي.. شو رقم الطاولة؟");
        document.getElementById('waiter-status').innerText = "شو رقم الطاولة؟ 🪑";
    },

    normalizeArabic: function (text) {
        if (!text) return "";
        let t = text;
        // Alef Normalization
        t = t.replace(/[أإآ]/g, 'ا');
        // Ta Marbuta -> Ha
        t = t.replace(/ة/g, 'ه');
        // Ya -> Alif Maqsura (sometimes mixed up) or similar
        // Let's keep Ya as is, but maybe handle "ى"
        t = t.replace(/ى/g, 'ي');
        return t;
    },

    scanItems: function (text) {
        if (!text) return 0;
        let workingText = this.normalizeArabic(text.toLowerCase());
        console.log("Scanning (Norm):", workingText);

        this.menuItems.forEach(item => {
            // Normalize item name for comparison
            const name = this.normalizeArabic(item.name.toLowerCase());
            let index = workingText.indexOf(name);

            while (index !== -1) {
                let qty = 1;

                // 1. Look BEFORE the item (e.g. "2 Coffee")
                let preText = workingText.substring(Math.max(0, index - 20), index);
                let foundPre = this.extractNumber(preText);

                // 2. Look AFTER the item (e.g. "Coffee 2")
                let postText = workingText.substring(index + name.length, Math.min(workingText.length, index + name.length + 20));
                let foundPost = this.extractNumber(postText);

                // Priority: Post > Pre (or closest?) 
                // Usually "Coffee 2" is more specific if adjacent.
                if (foundPost) {
                    qty = foundPost;
                } else if (foundPre) {
                    qty = foundPre;
                }

                this.allDetectedItems.push({ name: item.name, qty, price: item.price });

                // Remove found instance to avoid re-detection
                // Replace with whitespace to preserve string length/indices for debug, 
                // essentially cutting it out from "workingText" search
                const mask = " ".repeat(name.length);
                workingText = workingText.substring(0, index) + mask + workingText.substring(index + name.length);

                // Search again for same item
                index = workingText.indexOf(name);
            }
        });
    },

    extractTableNumber: function (text) {
        const match = text.match(/\d+/);
        if (match) return match[0];
        for (let key in this.numMap) {
            if (text.includes(key)) return this.numMap[key].toString();
        }
        return null;
    },

    renderInvoice: function () {
        const body = document.getElementById('lux-items-body');
        document.getElementById('luxury-invoice-container').style.display = 'flex';
        // Large bold font handled in CSS
        body.innerHTML = this.allDetectedItems.map((i, index) => `
            <tr>
                <td>${i.name}</td>
                <td>x${i.qty}</td>
                <td style="text-align:left;">
                    <button onclick="VoiceWaiter.removeItem(${index})" style="background:none; border:none; cursor:pointer;">
                        <i class="fas fa-trash" style="color:#ff4444; font-size:1.2em;"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Auto scroll to bottom
        const scrollArea = document.querySelector('.lux-scroll-area');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    },

    removeItem: function (index) {
        this.allDetectedItems.splice(index, 1);
        this.renderInvoice();
        this.playSound('start'); // Feedback sound
        if (this.allDetectedItems.length === 0) {
            document.getElementById('finish-order-btn').style.display = 'none';
        }
    },

    report: function (type) {
        let msg = "";
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (type === 'ORDER') {
            let total = 0;
            const itemsList = this.allDetectedItems.map(i => {
                const sub = (parseFloat(i.price) || 0) * i.qty;
                total += sub;
                // Bigger font usage for admin via HTML tags
                return `<b>${i.qty}x ${i.name}</b>`; // Only bolding name and qty
            }).join('\n');

            msg = `
🔴 <b>طلب جديد</b> [طاولة ${this.currentTable}]
⏰ ${now}
------------------
${itemsList}
------------------
💰 <b>المجموع: $${total}</b>
`;
        } else if (type === 'BILL') {
            msg = `
🧾 <b>طلب فاتورة</b>
🪑 طاولة: <b>${this.currentTable}</b>
⏰ ${now}
`;
        } else if (type === 'COMPLAINT') {
            msg = `
⚠️ <b>شكوى / مساعدة</b>
🪑 طاولة: <b>${this.currentTable}</b>
📝 ${this.lastComplaint}
`;
        }

        const url = `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: this.TELEGRAM_GROUP_ID, text: msg, parse_mode: 'HTML' })
        }).catch(e => console.error("Telegram Error", e));
    }
};

VoiceWaiter.init();
