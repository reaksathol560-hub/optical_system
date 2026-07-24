/**
 * =============================================================================
 * SUPERADMIN MANAGEMENT MODULE (BRANCHES & USER ROLES)
 * =============================================================================
 */

let cachedBranches = [];
let cachedUsers = [];
let editingBranchId = null;
let editingUserId = null;

// Initialize Superadmin & Branch Modules on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    const user = AuthManager.getCurrentUser();
    if (user) {
        await fetchBranchesList();
        if (user.role === 'superadmin') {
            fetchUsersList();
        }
    }
});

/* =============================================================================
   1. BRANCH MANAGEMENT LOGIC
   ============================================================================= */

async function fetchBranchesList() {
    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('branches')
                .select('*')
                .order('name');

            if (!error && data) {
                cachedBranches = data;
                window.cachedBranches = data;
                localStorage.setItem('optical_pos_mock_branches', JSON.stringify(data));
                renderBranchesTable(data);
                return;
            }
        } catch (err) {
            console.warn('Failed to fetch branches from Supabase, fallback to MockStore:', err);
        }
    }

    cachedBranches = window.MockStore ? window.MockStore.getBranches() : [];
    window.cachedBranches = cachedBranches;
    renderBranchesTable(cachedBranches);
}

function renderBranchesTable(branches) {
    const tbody = document.getElementById('branches-table-body');
    const countEl = document.getElementById('branch-record-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${branches.length} branches active`;

    if (branches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-500">
                    <i class="fa-solid fa-store text-3xl mb-2 text-slate-600"></i>
                    <div>No branches created yet. Click "+ New Branch" to create one.</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = branches.map(b => `
        <tr class="hover:bg-slate-900/60 transition">
            <td class="py-3.5 px-4 font-mono font-bold text-cyan-400">${b.code}</td>
            <td class="py-3.5 px-4 font-bold text-white">${b.name}</td>
            <td class="py-3.5 px-4 text-slate-300">${b.address || 'N/A'}</td>
            <td class="py-3.5 px-4 text-slate-300 font-mono">${b.phone || 'N/A'}</td>
            <td class="py-3.5 px-4 text-slate-400 text-[11px] font-mono">${new Date(b.created_at || Date.now()).toLocaleDateString()}</td>
            <td class="py-3.5 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openBranchModal('${b.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs transition">
                        <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                    </button>
                    <button onclick="deleteBranchData('${b.id}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs transition border border-rose-500/30">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openBranchModal(branchId = null) {
    editingBranchId = branchId;
    const modal = document.getElementById('modal-branch');
    const modalTitle = document.getElementById('modal-branch-title');

    const nameInput = document.getElementById('branch-name');
    const codeInput = document.getElementById('branch-code');
    const addressInput = document.getElementById('branch-address');
    const phoneInput = document.getElementById('branch-phone');

    if (branchId) {
        const branch = cachedBranches.find(b => b.id === branchId);
        if (branch) {
            if (modalTitle) modalTitle.textContent = 'Edit Branch Details';
            if (nameInput) nameInput.value = branch.name;
            if (codeInput) codeInput.value = branch.code;
            if (addressInput) addressInput.value = branch.address || '';
            if (phoneInput) phoneInput.value = branch.phone || '';
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Create New Branch';
        if (nameInput) nameInput.value = '';
        if (codeInput) codeInput.value = 'BR-' + Math.floor(100 + Math.random() * 900);
        if (addressInput) addressInput.value = '';
        if (phoneInput) phoneInput.value = '';
    }

    if (modal) modal.classList.remove('hidden');
}

async function saveBranchData() {
    const name = document.getElementById('branch-name')?.value.trim();
    const code = document.getElementById('branch-code')?.value.trim();
    const address = document.getElementById('branch-address')?.value.trim();
    const phone = document.getElementById('branch-phone')?.value.trim();

    if (!name || !code) {
        alert('Please fill in Branch Name and Branch Code.');
        return;
    }

    const branchData = {
        id: editingBranchId || ('br-' + Date.now()),
        name,
        code,
        address,
        phone
    };

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('branches')
                .upsert(branchData);

            if (error) {
                alert(`Failed to save branch: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase branch save error:', err);
        }
    }

    // Always update local cache & localStorage as well
    const branches = window.MockStore ? window.MockStore.getBranches() : [];
    const existingIdx = branches.findIndex(b => b.id === branchData.id);
    if (existingIdx > -1) {
        branches[existingIdx] = { ...branches[existingIdx], ...branchData };
    } else {
        branches.push({ ...branchData, created_at: new Date().toISOString() });
    }
    localStorage.setItem('optical_pos_mock_branches', JSON.stringify(branches));
    window.cachedBranches = branches;

    closeModal('modal-branch');
    await fetchBranchesList();
    await AuthManager.applyRBAC();
    if (typeof populateReportBranchFilter === 'function') {
        await populateReportBranchFilter();
    }
}

async function deleteBranchData(branchId) {
    if (!confirm('Are you sure you want to delete this branch? Products assigned to this branch may be affected.')) {
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('branches')
                .delete()
                .eq('id', branchId);

            if (error) {
                alert(`Failed to delete branch: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase branch delete error:', err);
        }
    }

    let branches = window.MockStore ? window.MockStore.getBranches() : [];
    branches = branches.filter(b => b.id !== branchId);
    localStorage.setItem('optical_pos_mock_branches', JSON.stringify(branches));
    window.cachedBranches = branches;

    await fetchBranchesList();
    await AuthManager.applyRBAC();
    if (typeof populateReportBranchFilter === 'function') {
        await populateReportBranchFilter();
    }
}


/* =============================================================================
   2. USER & ROLE (RBAC) MANAGEMENT LOGIC
   ============================================================================= */

async function fetchUsersList() {
    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*, branches(name)')
                .order('created_at', { ascending: false });

            if (!error && data) {
                cachedUsers = data;
                renderUsersTable(data);
                return;
            }
        } catch (err) {
            console.warn('Failed to fetch users from Supabase, fallback to MockStore:', err);
        }
    }

    cachedUsers = window.MockStore ? window.MockStore.getProfiles() : [];
    renderUsersTable(cachedUsers);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    const countEl = document.getElementById('user-record-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${users.length} staff accounts registered`;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-500">
                    <i class="fa-solid fa-user-gear text-3xl mb-2 text-slate-600"></i>
                    <div>No user accounts found. Click "+ Create User Account" to add one.</div>
                </td>
            </tr>
        `;
        return;
    }

    const branches = cachedBranches.length ? cachedBranches : (window.MockStore ? window.MockStore.getBranches() : []);

    tbody.innerHTML = users.map(u => {
        const branch = u.branches ? u.branches : branches.find(b => b.id === u.branch_id);
        const branchName = branch ? branch.name : 'All Branches / Unassigned';

        const roleBadgeClass = 
            u.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
            u.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';

        return `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3.5 px-4 font-bold text-white">${u.full_name}</td>
                <td class="py-3.5 px-4 text-slate-300 font-mono text-xs">${u.email}</td>
                <td class="py-3.5 px-4">
                    <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase font-mono ${roleBadgeClass}">
                        ${u.role}
                    </span>
                </td>
                <td class="py-3.5 px-4 text-slate-300 font-medium">📍 ${branchName}</td>
                <td class="py-3.5 px-4 text-slate-400 text-[11px] font-mono">${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
                <td class="py-3.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openUserModal('${u.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs transition">
                            <i class="fa-solid fa-user-pen mr-1"></i> Edit Role
                        </button>
                        <button onclick="deleteUserData('${u.id}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs transition border border-rose-500/30">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openUserModal(userId = null) {
    editingUserId = userId;
    const modal = document.getElementById('modal-user');
    const modalTitle = document.getElementById('modal-user-title');

    const nameInput = document.getElementById('user-fullname');
    const emailInput = document.getElementById('user-email');
    const passBlock = document.getElementById('user-pass-block');
    const passInput = document.getElementById('user-password');
    const roleSelect = document.getElementById('user-role');
    const branchSelect = document.getElementById('user-branch-select');

    // Populate branch options
    const branches = cachedBranches.length ? cachedBranches : (window.MockStore ? window.MockStore.getBranches() : []);
    if (branchSelect) {
        branchSelect.innerHTML = branches.map(b => `<option value="${b.id}">📍 ${b.name}</option>`).join('');
    }

    if (userId) {
        const user = cachedUsers.find(u => u.id === userId);
        if (user) {
            if (modalTitle) modalTitle.textContent = 'Edit Staff User Role & Branch';
            if (nameInput) nameInput.value = user.full_name;
            if (emailInput) {
                emailInput.value = user.email;
                emailInput.disabled = true;
            }
            if (passBlock) passBlock.classList.add('hidden');
            if (roleSelect) roleSelect.value = user.role;
            if (branchSelect && user.branch_id) branchSelect.value = user.branch_id;
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Create Staff Account';
        if (nameInput) nameInput.value = '';
        if (emailInput) {
            emailInput.value = '';
            emailInput.disabled = false;
        }
        if (passBlock) passBlock.classList.remove('hidden');
        if (passInput) passInput.value = '';
        if (roleSelect) roleSelect.value = 'cashier';
    }

    if (modal) modal.classList.remove('hidden');
}

async function saveUserData() {
    const fullName = document.getElementById('user-fullname')?.value.trim();
    const email = document.getElementById('user-email')?.value.trim();
    const password = document.getElementById('user-password')?.value;
    const role = document.getElementById('user-role')?.value;
    const branchId = document.getElementById('user-branch-select')?.value;

    if (!fullName || !email) {
        alert('Please fill in Full Name and Email.');
        return;
    }

    if (!editingUserId && !password) {
        alert('Please provide a Password for the new user account.');
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            if (!editingUserId) {
                let newUserId = 'usr-' + Date.now();

                // Optional: Attempt Supabase Auth Registration
                try {
                    const { data: authData } = await window.supabaseClient.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                full_name: fullName,
                                role,
                                branch_id: branchId
                            }
                        }
                    });

                    if (authData && authData.user) {
                        newUserId = authData.user.id;
                    }
                } catch (authEx) {
                    console.warn('Supabase Auth signUp skipped or requires confirmation, proceeding to insert into profiles:', authEx);
                }

                // Insert into Profiles database table directly
                const { error: profileErr } = await window.supabaseClient
                    .from('profiles')
                    .upsert([{
                        id: newUserId,
                        email,
                        password,
                        full_name: fullName,
                        role,
                        branch_id: branchId
                    }]);

                if (profileErr) {
                    alert(`Failed to save staff profile: ${profileErr.message}`);
                    return;
                }
            } else {
                // Update existing profile
                const { error } = await window.supabaseClient
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        role,
                        branch_id: branchId
                    })
                    .eq('id', editingUserId);

                if (error) {
                    alert(`Failed to update profile: ${error.message}`);
                    return;
                }
            }
        } catch (err) {
            console.error('Supabase user save error:', err);
            alert(`Error saving user account: ${err.message || err}`);
            return;
        }
    } else if (window.MockStore) {
        const profiles = window.MockStore.getProfiles();
        if (editingUserId) {
            const idx = profiles.findIndex(u => u.id === editingUserId);
            if (idx > -1) {
                profiles[idx].full_name = fullName;
                profiles[idx].role = role;
                profiles[idx].branch_id = branchId;
            }
        } else {
            profiles.unshift({
                id: 'usr-' + Date.now(),
                email,
                full_name: fullName,
                role,
                branch_id: branchId,
                created_at: new Date().toISOString()
            });
        }
        localStorage.setItem('optical_pos_mock_profiles', JSON.stringify(profiles));
    }

    closeModal('modal-user');
    await fetchUsersList();
}

async function deleteUserData(userId) {
    if (!confirm('Are you sure you want to delete this staff user account?')) {
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                alert(`Failed to delete user profile: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase user delete error:', err);
        }
    } else if (window.MockStore) {
        let profiles = window.MockStore.getProfiles();
        profiles = profiles.filter(u => u.id !== userId);
        localStorage.setItem('optical_pos_mock_profiles', JSON.stringify(profiles));
    }

    await fetchUsersList();
}


/* =============================================================================
   3. INVENTORY & PRODUCT MANAGEMENT LOGIC
   ============================================================================= */

let cachedProducts = [];
let editingProductId = null;

async function fetchInventoryList() {
    const user = AuthManager.getCurrentUser();
    const activeBranchId = AuthManager.getActiveBranchId();

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            let query = window.supabaseClient
                .from('products')
                .select('*, branches(name)')
                .order('created_at', { ascending: false });

            if (user && user.role !== 'superadmin') {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (!error && data) {
                cachedProducts = data;
                renderInventoryTable(data);
                return;
            }
        } catch (err) {
            console.warn('Failed to fetch inventory from Supabase, fallback to MockStore:', err);
        }
    }

    let products = window.MockStore ? window.MockStore.getProducts() : [];
    if (user && user.role !== 'superadmin') {
        products = products.filter(p => p.branch_id === activeBranchId);
    }
    cachedProducts = products;
    renderInventoryTable(products);
}

function renderInventoryTable(products) {
    const tbody = document.getElementById('inventory-table-body');
    const countEl = document.getElementById('inventory-record-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${products.length} products listed`;

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-500">
                    <i class="fa-solid fa-boxes-stacked text-3xl mb-2 text-slate-600"></i>
                    <div>No inventory products found. Click "+ Add New Product" to create one.</div>
                </td>
            </tr>
        `;
        return;
    }

    const branches = cachedBranches.length ? cachedBranches : (window.MockStore ? window.MockStore.getBranches() : []);

    tbody.innerHTML = products.map(p => {
        const branch = p.branches ? p.branches : branches.find(b => b.id === p.branch_id);
        const branchName = branch ? branch.name : 'Unknown Branch';

        const stockBadgeClass = 
            p.stock > 10 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            p.stock > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
            'bg-rose-500/10 border-rose-500/30 text-rose-400';

        return `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3.5 px-4 font-mono font-bold text-cyan-400 text-xs">${p.sku}</td>
                <td class="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow">
                        ${p.image_url ? `
                            <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                            <i class="hidden fa-solid fa-glasses text-slate-600 text-xs"></i>
                        ` : `
                            <i class="fa-solid fa-glasses text-slate-600 text-xs"></i>
                        `}
                    </div>
                    <div>
                        <div class="text-sm font-semibold text-slate-100">${p.name}</div>
                        <div class="text-[11px] text-slate-400 font-normal line-clamp-1">${p.description || 'No specs listed'}</div>
                    </div>
                </td>
                <td class="py-3.5 px-4">
                    <span class="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
                        ${p.category}
                    </span>
                </td>
                <td class="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">$${parseFloat(p.price).toFixed(2)}</td>
                <td class="py-3.5 px-4">
                    <span class="px-2.5 py-0.5 text-xs font-bold font-mono rounded border ${stockBadgeClass}">
                        ${p.stock} in stock
                    </span>
                </td>
                <td class="py-3.5 px-4 text-slate-300 font-medium">📍 ${branchName}</td>
                <td class="py-3.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openQuickAdjustModal('${p.id}')" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-xs transition border border-amber-500/30">
                            <i class="fa-solid fa-sliders mr-1"></i> Qty & Price
                        </button>
                        <button onclick="openProductModal('${p.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs transition">
                            <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                        </button>
                        <button onclick="deleteProductData('${p.id}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs transition border border-rose-500/30">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

let quickAdjustProductId = null;

function openQuickAdjustModal(productId) {
    quickAdjustProductId = productId;
    const prod = cachedProducts.find(p => p.id === productId);
    if (!prod) return;

    const modal = document.getElementById('modal-adjust-stock');
    const titleEl = document.getElementById('adjust-prod-title');
    const priceInput = document.getElementById('adjust-price');
    const stockInput = document.getElementById('adjust-stock');

    if (titleEl) titleEl.textContent = `Adjust Stock & Price (${prod.name})`;
    if (priceInput) priceInput.value = prod.price;
    if (stockInput) stockInput.value = prod.stock;

    if (modal) modal.classList.remove('hidden');
}

async function saveQuickStockPrice() {
    if (!quickAdjustProductId) return;

    const price = parseFloat(document.getElementById('adjust-price')?.value || 0);
    const stock = parseInt(document.getElementById('adjust-stock')?.value || 0);

    if (isNaN(price) || isNaN(stock) || price < 0 || stock < 0) {
        alert('Please enter valid positive values for Price and Stock Quantity.');
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('products')
                .update({ price, stock })
                .eq('id', quickAdjustProductId);

            if (error) {
                alert(`Failed to update stock and price: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Stock adjustment error:', err);
        }
    } else if (window.MockStore) {
        const products = window.MockStore.getProducts();
        const idx = products.findIndex(p => p.id === quickAdjustProductId);
        if (idx > -1) {
            products[idx].price = price;
            products[idx].stock = stock;
        }
        localStorage.setItem('optical_pos_mock_products', JSON.stringify(products));
    }

    closeModal('modal-adjust-stock');
    await fetchInventoryList();

    if (typeof renderProductsGrid === 'function') {
        renderProductsGrid();
    }
}

async function syncMasterCatalogToBranch() {
    const activeBranchId = AuthManager.getActiveBranchId();
    if (!confirm(`Apply all 15 master optical catalog products to this branch? Products will be initialized with default price & stock.`)) {
        return;
    }

    const masterCatalogTemplate = [
        { name: 'Ray-Ban Wayfarer Classic Black', sku: 'FRM-RB-001', category: 'Frames', price: 165.00, stock: 10, rx: 'Frame Only', img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80', desc: 'Iconic square black acetate frame.' },
        { name: 'Oakley Holbrook Matte Black', sku: 'FRM-OK-002', category: 'Frames', price: 142.00, stock: 10, rx: 'Frame Only', img: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80', desc: 'Lightweight O Matter frame with metal rivets.' },
        { name: 'Gucci Lightweight Titanium Gold', sku: 'FRM-GC-003', category: 'Frames', price: 320.00, stock: 5, rx: 'Frame Only', img: 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=400&q=80', desc: 'Premium ultra-light titanium frame.' },
        { name: 'Tom Ford Round Vintage Tortoise', sku: 'FRM-TF-001', category: 'Frames', price: 280.00, stock: 5, rx: 'Frame Only', img: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=400&q=80', desc: 'Luxury acetate frame with Signature T logo.' },
        { name: 'Prada Cat-Eye Black Edition', sku: 'FRM-PR-002', category: 'Frames', price: 310.00, stock: 5, rx: 'Frame Only', img: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?auto=format&fit=crop&w=400&q=80', desc: 'High fashion women cat-eye frame.' },
        { name: 'Single Vision 1.56 Anti-Blue Lens', sku: 'LNS-SV-156', category: 'Lenses', price: 75.00, stock: 50, rx: 'Single Vision', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', desc: 'Standard index with blue light blocking filter.' },
        { name: 'High Index 1.67 Aspheric Lens', sku: 'LNS-HI-167', category: 'Lenses', price: 140.00, stock: 30, rx: 'Single Vision High Index', img: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80', desc: 'Ultra-thin lightweight lens for high prescriptions.' },
        { name: 'Premium Progressive HD 1.60 Lens', sku: 'LNS-PRG-160', category: 'Lenses', price: 210.00, stock: 20, rx: 'Progressive', img: 'https://images.unsplash.com/photo-1582142306909-195724d33ffc?auto=format&fit=crop&w=400&q=80', desc: 'Wide digital corridor progressive lens with AR coating.' },
        { name: 'Transitions Gen8 Photochromic 1.59', sku: 'LNS-TR8-159', category: 'Lenses', price: 185.00, stock: 20, rx: 'Photochromic', img: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=400&q=80', desc: 'Fast darkening outdoor photochromic lens.' },
        { name: 'Polycarbonate 1.59 Impact Resistant', sku: 'LNS-POLY-159', category: 'Lenses', price: 90.00, stock: 25, rx: 'Single Vision Safety', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', desc: 'Shatterproof lens ideal for sports and rimless frames.' },
        { name: 'Ultra High Index 1.74 Lens', sku: 'LNS-UHI-174', category: 'Lenses', price: 260.00, stock: 15, rx: 'Ultra High Index', img: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80', desc: 'Thinnest lens available for extreme prescriptions.' },
        { name: 'Acuvue Oasys Monthly (6 pack)', sku: 'CNT-ACV-001', category: 'Contact Lenses', price: 45.00, stock: 40, rx: 'Contact Lens', img: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80', desc: 'Breathable silicone hydrogel contacts.' },
        { name: 'Anti-Fog Microfiber Cleaning Cloth', sku: 'ACC-CLT-001', category: 'Accessories', price: 8.50, stock: 100, rx: 'N/A', img: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80', desc: 'Reusable anti-fog microfiber lens cloth.' },
        { name: 'Opti-Free Express Solution 355ml', sku: 'ACC-SOL-001', category: 'Accessories', price: 14.00, stock: 50, rx: 'N/A', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', desc: 'Multi-purpose contact lens solution.' },
        { name: 'Comprehensive Eye Exam & Refraction', sku: 'SRV-EXM-001', category: 'Services', price: 35.00, stock: 999, rx: 'Service', img: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80', desc: 'Full visual acuity and ophthalmic check up.' }
    ];

    const branchProducts = masterCatalogTemplate.map((item, idx) => ({
        id: `prod-${item.sku.toLowerCase()}-${activeBranchId}`,
        branch_id: activeBranchId,
        name: item.name,
        sku: item.sku,
        category: item.category,
        price: item.price,
        stock: item.stock,
        prescription_type: item.rx,
        image_url: item.img,
        description: item.desc
    }));

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('products')
                .upsert(branchProducts);

            if (error) {
                alert(`Catalog sync failed: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Catalog sync error:', err);
        }
    }

    await fetchInventoryList();
    if (typeof renderProductsGrid === 'function') {
        renderProductsGrid();
    }
}

function openProductModal(productId = null) {
    editingProductId = productId;
    const modal = document.getElementById('modal-product');
    const modalTitle = document.getElementById('modal-product-title');

    const nameInput = document.getElementById('prod-name');
    const skuInput = document.getElementById('prod-sku');
    const catSelect = document.getElementById('prod-category');
    const priceInput = document.getElementById('prod-price');
    const stockInput = document.getElementById('prod-stock');
    const rxSelect = document.getElementById('prod-rx-type');
    const branchSelect = document.getElementById('prod-branch-select');
    const imageUrlInput = document.getElementById('prod-image-url');
    const descInput = document.getElementById('prod-desc');

    const branches = cachedBranches.length ? cachedBranches : (window.MockStore ? window.MockStore.getBranches() : []);
    if (branchSelect) {
        branchSelect.innerHTML = branches.map(b => `<option value="${b.id}">📍 ${b.name}</option>`).join('');
    }

    if (productId) {
        const prod = cachedProducts.find(p => p.id === productId);
        if (prod) {
            if (modalTitle) modalTitle.textContent = 'Edit Product & Inventory Details';
            if (nameInput) nameInput.value = prod.name;
            if (skuInput) skuInput.value = prod.sku;
            if (catSelect) catSelect.value = prod.category;
            if (priceInput) priceInput.value = prod.price;
            if (stockInput) stockInput.value = prod.stock;
            if (rxSelect) rxSelect.value = prod.prescription_type || 'Standard';
            if (branchSelect && prod.branch_id) branchSelect.value = prod.branch_id;
            if (imageUrlInput) imageUrlInput.value = prod.image_url || '';
            if (descInput) descInput.value = prod.description || '';
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Add New Product to Branch';
        if (nameInput) nameInput.value = '';
        if (skuInput) skuInput.value = 'PROD-' + Math.floor(1000 + Math.random() * 9000);
        if (catSelect) catSelect.value = 'Frames';
        if (priceInput) priceInput.value = '100.00';
        if (stockInput) stockInput.value = '20';
        if (rxSelect) rxSelect.value = 'Frame Only';
        if (branchSelect) branchSelect.value = AuthManager.getActiveBranchId();
        if (imageUrlInput) imageUrlInput.value = '';
        if (descInput) descInput.value = '';
    }

    if (modal) modal.classList.remove('hidden');
}

async function saveProductData() {
    const name = document.getElementById('prod-name')?.value.trim();
    const sku = document.getElementById('prod-sku')?.value.trim();
    const category = document.getElementById('prod-category')?.value;
    const price = parseFloat(document.getElementById('prod-price')?.value || 0);
    const stock = parseInt(document.getElementById('prod-stock')?.value || 0);
    const prescription_type = document.getElementById('prod-rx-type')?.value;
    const branch_id = document.getElementById('prod-branch-select')?.value;
    const image_url = document.getElementById('prod-image-url')?.value.trim();
    const description = document.getElementById('prod-desc')?.value.trim();

    if (!name || !sku || isNaN(price) || isNaN(stock)) {
        alert('Please fill in Product Name, SKU, valid Price, and Stock level.');
        return;
    }

    const prodData = {
        id: editingProductId || ('prod-' + Date.now()),
        branch_id,
        name,
        sku,
        category,
        price,
        stock,
        prescription_type,
        image_url,
        description
    };

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('products')
                .upsert([prodData]);

            if (error) {
                alert(`Failed to save product: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase product save error:', err);
        }
    } else if (window.MockStore) {
        const products = window.MockStore.getProducts();
        if (editingProductId) {
            const idx = products.findIndex(p => p.id === editingProductId);
            if (idx > -1) {
                products[idx] = { ...products[idx], ...prodData };
            }
        } else {
            products.unshift({
                ...prodData,
                created_at: new Date().toISOString()
            });
        }
        localStorage.setItem('optical_pos_mock_products', JSON.stringify(products));
    }

    closeModal('modal-product');
    await fetchInventoryList();

    // Also refresh POS products grid if on POS tab
    if (typeof renderProductsGrid === 'function') {
        renderProductsGrid();
    }
}

async function deleteProductData(productId) {
    if (!confirm('Are you sure you want to delete this product from inventory?')) {
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('products')
                .delete()
                .eq('id', productId);

            if (error) {
                alert(`Failed to delete product: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase product delete error:', err);
        }
    } else if (window.MockStore) {
        let products = window.MockStore.getProducts();
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('optical_pos_mock_products', JSON.stringify(products));
    }

    await fetchInventoryList();
    if (typeof renderProductsGrid === 'function') {
        renderProductsGrid();
    }
}


window.fetchBranchesList = fetchBranchesList;
window.openBranchModal = openBranchModal;
window.saveBranchData = saveBranchData;
window.deleteBranchData = deleteBranchData;

window.fetchUsersList = fetchUsersList;
window.openUserModal = openUserModal;
window.saveUserData = saveUserData;
window.deleteUserData = deleteUserData;

window.fetchInventoryList = fetchInventoryList;
window.openProductModal = openProductModal;
window.saveProductData = saveProductData;
window.deleteProductData = deleteProductData;
window.openQuickAdjustModal = openQuickAdjustModal;
window.saveQuickStockPrice = saveQuickStockPrice;
window.syncMasterCatalogToBranch = syncMasterCatalogToBranch;

/**
 * Barcode Scanner Integration: Scan Barcode to Update Product Price & Stock
 */
function scanBarcodeToInventory(scannedSku) {
    if (!scannedSku) return;
    const cleanSku = scannedSku.trim().toLowerCase();

    // Search in cached products
    const product = cachedProducts.find(p => p.sku.toLowerCase() === cleanSku || p.id.toLowerCase() === cleanSku);

    if (!product) {
        if (window.BarcodeEngine) {
            window.BarcodeEngine.showToast(`Inventory: No product found with barcode "${scannedSku}"`, 'error');
        } else {
            alert(`No product found with barcode "${scannedSku}"`);
        }
        return;
    }

    // Open quick adjustment modal for stock & price
    openQuickAdjustModal(product.id);

    if (window.BarcodeEngine) {
        window.BarcodeEngine.showToast(`Found product: ${product.name} (${product.sku}). Enter new price/stock below.`, 'info');
    }
}

window.scanBarcodeToInventory = scanBarcodeToInventory;


