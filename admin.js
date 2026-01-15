/**
 * Admin Panel Logic
 */

const Admin = {
    isLoggedIn: false,

    login: async function () {
        const passInput = document.getElementById('admin-pass');
        const pass = passInput.value.trim();
        const data = await RestaurantData.getData();

        if (pass === "1234" || pass === data.info.adminPassword) {
            if (data.info.adminPassword !== "1234") {
                data.info.adminPassword = "1234";
                await RestaurantData.saveData(data);
            }
            this.isLoggedIn = true;
            document.getElementById('login-overlay').style.display = 'none';
            await this.init();
        } else {
            alert('❌ كلمة السر خاطئة! حاول استخدام: 1234');
            passInput.value = '';
            passInput.focus();
        }
    },

    logout: function () {
        if (confirm('هل تريد تسجيل الخروج؟')) {
            window.location.reload();
        }
    },

    init: async function () {
        const data = await RestaurantData.getData();
        try { this.fillInfo(data.info); } catch (e) { console.error("Info Render Error:", e); }
        try { await this.renderCategoriesList(); } catch (e) { console.error("Cats Render Error:", e); }
        try { await this.fillItemCategoryFilter(); } catch (e) { console.error("Filter Render Error:", e); }
        try { await this.renderItemsList(); } catch (e) { console.error("Items Render Error:", e); }
    },

    showTab: function (tabName, event) {
        if (event) event.preventDefault();
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
        document.getElementById('tab-' + tabName).style.display = 'block';
        if (event) event.target.closest('.tab-link').classList.add('active');
    },

    fillInfo: function (info) {
        document.getElementById('info-name').value = info.name || '';
        document.getElementById('info-phone').value = info.phone || '';
        document.getElementById('info-address').value = info.address || '';
        document.getElementById('info-hours').value = info.openHours || '';
        document.getElementById('logo-text').value = (info.logo && info.logo.text) ? info.logo.text : '';
        this.updateLogoPreview(info.logo ? info.logo.image : '');
        if (info.dailyDish) {
            document.getElementById('dd-active').checked = info.dailyDish.active || false;
            document.getElementById('dd-title').value = info.dailyDish.title || '';
            document.getElementById('dd-text').value = info.dailyDish.text || '';
        }
        if (info.waiterName) {
            const waiterInput = document.getElementById('waiter-name-input');
            if (waiterInput) waiterInput.value = info.waiterName;
        }
    },

    updateLogoPreview: function (src) {
        const preview = document.getElementById('logo-preview');
        if (!preview) return;
        if (src) {
            preview.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
            preview.innerHTML = `<i class="fas fa-image fa-2x" style="opacity:0.2;"></i>`;
        }
    },

    saveInfo: async function (silent = false) {
        const data = await RestaurantData.getData();
        data.info.name = document.getElementById('info-name').value;
        data.info.phone = document.getElementById('info-phone').value;
        data.info.address = document.getElementById('info-address').value;
        data.info.openHours = document.getElementById('info-hours').value;
        if (!data.info.logo) data.info.logo = { image: '', text: '' };
        if (!data.info.dailyDish) data.info.dailyDish = { active: false, title: '', text: '', image: '', video: '' };
        data.info.logo.text = document.getElementById('logo-text').value;
        data.info.dailyDish.active = document.getElementById('dd-active').checked;
        data.info.dailyDish.title = document.getElementById('dd-title').value;
        data.info.dailyDish.text = document.getElementById('dd-text').value;

        const success = await RestaurantData.saveData(data);
        if (success && !silent) {
            alert('✅ تم حفظ المعلومات بنجاح');
        }
        return success;
    },

    editLogo: function () {
        const input = document.getElementById('logo-upload-input');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                const data = await RestaurantData.getData();
                data.info.logo.image = base64;
                await RestaurantData.saveData(data);
                this.updateLogoPreview(base64);
                alert('✅ تم تحديث اللوغو بنجاح');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    removeLogo: async function () {
        if (!confirm('هل تريد حذف صورة اللوغو؟')) return;
        const data = await RestaurantData.getData();
        data.info.logo.image = "";
        await RestaurantData.saveData(data);
        this.updateLogoPreview("");
    },

    editDailyDishMedia: function (type) {
        const input = document.getElementById('dd-media-input');
        input.accept = type === 'image' ? 'image/*' : 'video/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                const data = await RestaurantData.getData();
                if (type === 'image') {
                    data.info.dailyDish.image = base64;
                    data.info.dailyDish.video = "";
                } else {
                    data.info.dailyDish.video = base64;
                    data.info.dailyDish.image = "";
                }
                await RestaurantData.saveData(data);
                alert('✅ تم رفع الميديا بنجاح');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    removeDailyDishMedia: async function () {
        if (!confirm('هل تريد حذف ميديا طبق اليوم؟')) return;
        const data = await RestaurantData.getData();
        data.info.dailyDish.image = "";
        data.info.dailyDish.video = "";
        await RestaurantData.saveData(data);
        alert('✅ تم الحذف');
    },

    changePassword: async function () {
        const newPass = document.getElementById('new-password').value;
        if (!newPass) return alert('يرجى إدخال كلمة السر الجديدة');
        const data = await RestaurantData.getData();
        data.info.adminPassword = newPass;
        if (await RestaurantData.saveData(data)) {
            alert('✅ تم تحديث كلمة السر بنجاح');
            document.getElementById('new-password').value = '';
        }
    },

    saveWaiterName: async function () {
        const name = document.getElementById('waiter-name-input').value;
        if (!name) return alert('يرجى إدخال اسم النادل');
        const data = await RestaurantData.getData();
        data.info.waiterName = name;
        if (await RestaurantData.saveData(data)) {
            alert('✅ تم حفظ اسم النادل بنجاح');
        }
    },

    renderCategoriesList: async function () {
        const data = await RestaurantData.getData();
        const list = document.getElementById('categories-list');
        list.innerHTML = '';
        data.categories.sort((a, b) => a.order - b.order).forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cat.order}</td>
                <td>
                    <div onclick="Admin.editCategoryImage('${cat.id}')" style="width:40px; height:40px; border:1px dashed #555; border-radius:5px; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#111;">
                        ${cat.image ? `<img src="${cat.image}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fas fa-image" style="opacity:0.3;"></i>'}
                    </div>
                </td>
                <td><input type="text" value="${cat.name}" onchange="Admin.updateCategoryName('${cat.id}', this.value)" style="width:100%; padding:5px; background:transparent; color:white; border:1px solid #333;"></td>
                <td>
                    <button onclick="Admin.deleteCategory('${cat.id}')" class="btn" style="background:var(--danger); padding:5px 10px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            list.appendChild(tr);
        });
    },

    addCategory: async function () {
        const name = prompt('أدخل اسم القسم الجديد:');
        if (!name) return;
        const data = await RestaurantData.getData();
        const newId = 'c_' + Date.now();
        data.categories.push({ id: newId, name: name, order: data.categories.length + 1, image: '' });
        await RestaurantData.saveData(data);
        await this.renderCategoriesList();
        await this.fillItemCategoryFilter();
    },

    updateCategoryName: async function (id, newName) {
        const data = await RestaurantData.getData();
        const cat = data.categories.find(c => c.id === id);
        if (cat) cat.name = newName;
        await RestaurantData.saveData(data);
    },

    editCategoryImage: function (id) {
        const input = document.getElementById('category-image-input');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                const data = await RestaurantData.getData();
                const cat = data.categories.find(c => c.id === id);
                if (cat) cat.image = base64;
                await RestaurantData.saveData(data);
                await this.renderCategoriesList();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    deleteCategory: async function (id) {
        if (!confirm('هل أنت متأكد؟ سيتم حذف جميع الأصناف في هذا القسم!')) return;
        const data = await RestaurantData.getData();
        data.categories = data.categories.filter(c => c.id !== id);
        data.items = data.items.filter(i => i.categoryId !== id);
        await RestaurantData.saveData(data);
        await this.renderCategoriesList();
        await this.renderItemsList();
    },

    fillItemCategoryFilter: async function () {
        const data = await RestaurantData.getData();
        const filter = document.getElementById('item-cat-filter');
        filter.innerHTML = '<option value="all">كل الأقسام</option>';
        data.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.innerText = cat.name;
            filter.appendChild(opt);
        });
    },

    renderItemsList: async function () {
        const data = await RestaurantData.getData();
        const list = document.getElementById('items-list');
        const filterId = document.getElementById('item-cat-filter').value;
        list.innerHTML = '';
        const filteredItems = filterId === 'all' ? data.items : data.items.filter(i => i.categoryId === filterId);
        filteredItems.forEach(item => {
            const cat = data.categories.find(c => c.id === item.categoryId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.image ? `<img src="${item.image}" width="40">` : '<i class="fas fa-utensils"></i>'}</td>
                <td><input type="text" value="${item.name}" onchange="Admin.updateItem('${item.id}', 'name', this.value)" style="background:transparent; color:white; border:none; border-bottom:1px solid #333;"></td>
                <td><textarea onchange="Admin.updateItem('${item.id}', 'description', this.value)" style="background:transparent; color:#ccc; border:1px solid #333; height:40px; font-size:12px; width:100%; border-radius:4px;">${item.description || ''}</textarea></td>
                <td><input type="text" value="${item.price}" onchange="Admin.updateItem('${item.id}', 'price', this.value)" style="width:60px; background:transparent; color:var(--primary); border:none; border-bottom:1px solid #333;"></td>
                <td style="font-size:12px; color:#aaa;">${cat ? cat.name : 'بدون قسم'}</td>
                <td>
                    <button onclick="Admin.editItemImage('${item.id}')" class="btn" style="background:var(--primary); color:#000; padding:5px 10px;"><i class="fas fa-image"></i></button>
                    <button onclick="Admin.deleteItem('${item.id}')" class="btn" style="background:var(--danger); padding:5px 10px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            list.appendChild(tr);
        });
    },

    addItem: async function () {
        const data = await RestaurantData.getData();
        if (data.categories.length === 0) return alert('يرجى إنشاء قسم أولاً!');
        const name = prompt('اسم الصنف الجديد:');
        if (!name) return;
        const catId = document.getElementById('item-cat-filter').value;
        const targetCatId = catId === 'all' ? data.categories[0].id : catId;
        data.items.push({ id: 'i_' + Date.now(), categoryId: targetCatId, name: name, price: '0', description: '', image: '' });
        await RestaurantData.saveData(data);
        await this.renderItemsList();
    },

    updateItem: async function (id, field, value) {
        const data = await RestaurantData.getData();
        const item = data.items.find(i => i.id === id);
        if (item) item[field] = value;
        return await RestaurantData.saveData(data);
    },

    deleteItem: async function (id) {
        if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
        const data = await RestaurantData.getData();
        data.items = data.items.filter(i => i.id !== id);
        await RestaurantData.saveData(data);
        await this.renderItemsList();
    },

    editItemImage: function (id) {
        const input = document.getElementById('item-image-input');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                if (await this.updateItem(id, 'image', base64)) {
                    await this.renderItemsList();
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    exportData: async function () {
        const json = await RestaurantData.exportData();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `al-hout-menu-${new Date().toLocaleDateString()}.json`;
        a.click();
    },

    exportForNetlify: async function () {
        if (!confirm('سيتم تجهيز ملف data.js جديد لتحديث الموقع. هل تريد المتابعة؟')) return;
        await this.saveInfo(true);
        const json = await RestaurantData.syncData();
        if (!json) return alert('❌ فشل تحضير البيانات!');

        const part1 = "/**\n * Restaurant Data Management System\n */\nconst RestaurantData = (function () {\n    const DB_NAME = 'AlHoutRestaurantDB';\n    const DB_VERSION = 1;\n    const STORE_NAME = 'restaurant_data';\n\n    const DEFAULT_DATA = ";
        const part2 = ";\n\n    function openDB() {\n        return new Promise((resolve, reject) => {\n            const request = indexedDB.open(DB_NAME, DB_VERSION);\n            request.onupgradeneeded = event => {\n                const db = event.target.result;\n                if (!db.objectStoreNames.contains(STORE_NAME)) {\n                    db.createObjectStore(STORE_NAME);\n                }\n            };\n            request.onsuccess = event => resolve(event.target.result);\n            request.onerror = event => reject(event.target.error);\n        });\n    }\n\n    async function getData() {\n        try {\n            const db = await openDB();\n            const tx = db.transaction(STORE_NAME, 'readonly');\n            const store = tx.objectStore(STORE_NAME);\n            const request = store.get('restaurantData');\n            return new Promise((resolve) => {\n                request.onsuccess = async () => {\n                    let data = request.result;\n                    if (!data || data.version < DEFAULT_DATA.version) {\n                        await saveData(DEFAULT_DATA);\n                        resolve(DEFAULT_DATA);\n                    } else {\n                        resolve(data);\n                    }\n                };\n                request.onerror = () => resolve(DEFAULT_DATA);\n            });\n        } catch (error) {\n            return DEFAULT_DATA;\n        }\n    }\n\n    async function saveData(data) {\n        try {\n            const db = await openDB();\n            const tx = db.transaction(STORE_NAME, 'readwrite');\n            const store = tx.objectStore(STORE_NAME);\n            store.put(data, 'restaurantData');\n            return new Promise((resolve) => {\n                tx.oncomplete = () => resolve(true);\n                tx.onerror = () => resolve(false);\n            });\n        } catch (error) {\n            return false;\n        }\n    }\n\n    async function exportData() {\n        const data = await getData();\n        return JSON.stringify(data, null, 2);\n    }\n\n    async function importData(jsonContent) {\n        try {\n            const data = JSON.parse(jsonContent);\n            if (data && data.info && data.categories && data.items) {\n                return await saveData(data);\n            }\n        } catch (e) { }\n        return false;\n    }\n\n    async function syncData() {\n        const data = await getData();\n        data.version = (data.version || 0) + 1;\n        const success = await saveData(data);\n        if (success) {\n            return JSON.stringify(data, null, 2);\n        }\n        return null;\n    }\n\n    return {\n        getData,\n        saveData,\n        exportData,\n        importData,\n        syncData\n    };\n})();";

        const fileContent = part1 + json + part2;
        const blob = new Blob([fileContent], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data.js`;
        a.click();
        alert('✅ تم تجهيز الملف بنجاح! استبدل ملف data.js القديم بهذا الملف ثم ارفعه لـ Netlify.');
    },

    importData: function (input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (await RestaurantData.importData(e.target.result)) {
                alert('✅ تم استيراد البيانات بنجاح!');
                window.location.reload();
            } else {
                alert('❌ فشل استيراد البيانات!');
            }
        };
        reader.readAsText(file);
    }
};