/**
 * =============================================================================
 * POS TERMINAL CORE APPLICATION BUSINESS LOGIC
 * =============================================================================
 */

let activeProducts = [];
let cartItems = [];
let selectedCustomer = null;
let attachedPrescription = null;
let activeCategory = 'All';
let selectedPaymentMethod = 'Cash';
let activeOrderForReceipt = null;

// Initialize POS Application on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Require user authentication
    const user = AuthManager.requireAuth();
    if (!user) return;

    // Apply RBAC UI permissions
    AuthManager.applyRBAC();

    // Load branch inventory
    loadBranchProducts();

    // Set up product search listener
    const searchInput = document.getElementById('pos-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderProductsGrid(e.target.value.toLowerCase().trim());
        });
    }

    // Default view routing based on hash
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash === 'reports' && user.role !== 'cashier') {
        switchTab('reports');
    } else {
        switchTab('pos');
    }
});

/**
 * Switch Navigation Tab (POS Terminal vs Sales Reports)
 */
function switchTab(tab) {
    const user = AuthManager.getCurrentUser();
    if (tab === 'reports' && user && user.role === 'cashier') {
        alert('Access Denied: Cashier accounts are restricted from accessing Sales Reports.');
        tab = 'pos';
    }

    if ((tab === 'branches' || tab === 'users') && user && user.role !== 'superadmin') {
        alert('Access Denied: Only Superadmin users can access management views.');
        tab = 'pos';
    }

    if (tab === 'inventory' && user && user.role === 'cashier') {
        alert('Access Denied: Cashier accounts are restricted from modifying Inventory.');
        tab = 'pos';
    }

    const posView = document.getElementById('view-pos');
    const reportsView = document.getElementById('view-reports');
    const branchesView = document.getElementById('view-branches');
    const usersView = document.getElementById('view-users');
    const inventoryView = document.getElementById('view-inventory');

    const posNav = document.getElementById('nav-pos');
    const reportsNav = document.getElementById('nav-reports');
    const branchesNav = document.getElementById('nav-branches');
    const usersNav = document.getElementById('nav-users');
    const inventoryNav = document.getElementById('nav-inventory');

    // Hide all views first
    if (posView) posView.classList.add('hidden');
    if (reportsView) reportsView.classList.add('hidden');
    if (branchesView) branchesView.classList.add('hidden');
    if (usersView) usersView.classList.add('hidden');
    if (inventoryView) inventoryView.classList.add('hidden');

    // Remove active state from all links
    if (posNav) posNav.classList.remove('active');
    if (reportsNav) reportsNav.classList.remove('active');
    if (branchesNav) branchesNav.classList.remove('active');
    if (usersNav) usersNav.classList.remove('active');
    if (inventoryNav) inventoryNav.classList.remove('active');

    if (tab === 'pos') {
        if (posView) posView.classList.remove('hidden');
        if (posNav) posNav.classList.add('active');
        window.location.hash = 'pos';
    } else if (tab === 'reports') {
        if (reportsView) reportsView.classList.remove('hidden');
        if (reportsNav) reportsNav.classList.add('active');
        window.location.hash = 'reports';

        if (typeof populateReportBranchFilter === 'function') {
            populateReportBranchFilter();
        }
        if (typeof fetchSalesReportData === 'function') {
            fetchSalesReportData();
        }
    } else if (tab === 'inventory') {
        if (inventoryView) inventoryView.classList.remove('hidden');
        if (inventoryNav) inventoryNav.classList.add('active');
        window.location.hash = 'inventory';

        if (typeof fetchInventoryList === 'function') {
            fetchInventoryList();
        }
    } else if (tab === 'branches') {
        if (branchesView) branchesView.classList.remove('hidden');
        if (branchesNav) branchesNav.classList.add('active');
        window.location.hash = 'branches';

        if (typeof fetchBranchesList === 'function') {
            fetchBranchesList();
        }
    } else if (tab === 'users') {
        if (usersView) usersView.classList.remove('hidden');
        if (usersNav) usersNav.classList.add('active');
        window.location.hash = 'users';

        if (typeof fetchUsersList === 'function') {
            fetchUsersList();
        }
    }
}

/**
 * Load product inventory for currently active branch
 */
async function loadBranchProducts() {
    const branchId = AuthManager.getActiveBranchId();

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .eq('branch_id', branchId);

            if (!error && data) {
                activeProducts = data;
                renderProductsGrid();
                return;
            }
        } catch (err) {
            console.warn('Failed to load products from Supabase, fallback to MockStore:', err);
        }
    }

    // MockStore Fallback
    activeProducts = window.MockStore ? window.MockStore.getProducts(branchId) : [];
    renderProductsGrid();
}

/**
 * Filter product grid by Category pill
 */
function filterCategory(category) {
    activeCategory = category;
    
    // Update active pill styling
    document.querySelectorAll('.cat-pill').forEach(pill => {
        if (pill.textContent.trim().toLowerCase() === category.toLowerCase() || (category === 'All' && pill.textContent.trim() === 'All')) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    const searchTerm = document.getElementById('pos-search')?.value.toLowerCase().trim() || '';
    renderProductsGrid(searchTerm);
}

/**
 * Render Products Cards Grid
 */
function renderProductsGrid(searchTerm = '') {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let filtered = activeProducts;

    // Filter by Category
    if (activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
    }

    // Filter by Search Query
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500">
                <i class="fa-solid fa-box-open text-4xl mb-3 text-slate-600"></i>
                <div class="text-sm font-semibold">No products found in inventory</div>
                <div class="text-xs">Try adjusting your search terms or category filter</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const isOutOfStock = p.stock <= 0;
        const isLowStock = p.stock > 0 && p.stock <= 5;
        const categoryIcons = {
            'Frames': 'fa-glasses text-cyan-400',
            'Lenses': 'fa-eye text-blue-400',
            'Contact Lenses': 'fa-circle-dot text-emerald-400',
            'Accessories': 'fa-spray-can text-amber-400',
            'Services': 'fa-user-doctor text-purple-400'
        };

        return `
            <div class="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition group relative shadow-lg">
                <div>
                    <!-- Product Image Banner -->
                    <div class="h-36 w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800">
                        ${p.image_url ? `
                            <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                            <div class="hidden w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600">
                                <i class="fa-solid ${categoryIcons[p.category] || 'fa-tag'} text-3xl"></i>
                            </div>
                        ` : `
                            <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600">
                                <i class="fa-solid ${categoryIcons[p.category] || 'fa-tag'} text-3xl"></i>
                            </div>
                        `}

                        <!-- Overlaid Status & SKU Badges -->
                        <div class="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900/90 backdrop-blur text-slate-300 border border-slate-700/80 shadow">${p.sku}</span>
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur shadow ${
                                isOutOfStock ? 'bg-rose-950/90 text-rose-300 border border-rose-500/50' :
                                isLowStock ? 'bg-amber-950/90 text-amber-300 border border-amber-500/50' :
                                'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                            }">
                                ${isOutOfStock ? 'Out of Stock' : `Stock: ${p.stock}`}
                            </span>
                        </div>
                    </div>

                    <div class="p-3.5 space-y-1">
                        <div class="flex items-center justify-between gap-1">
                            <span class="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">${p.category}</span>
                        </div>
                        <h3 class="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition line-clamp-1">${p.name}</h3>
                        <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">${p.description || 'Optical inventory product.'}</p>
                    </div>
                </div>

                <div class="p-3.5 pt-0 flex items-center justify-between mt-1">
                    <div class="font-mono font-bold text-base text-cyan-400">$${parseFloat(p.price).toFixed(2)}</div>
                    <button onclick="addToCart('${p.id}')" ${isOutOfStock ? 'disabled' : ''}
                        class="px-3.5 py-1.5 bg-slate-800 hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-cyan-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow">
                        <i class="fa-solid fa-plus text-[10px]"></i> Add
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Add Product to Cart
 */
function addToCart(productId) {
    const product = activeProducts.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    const existingIndex = cartItems.findIndex(item => item.product_id === productId);
    if (existingIndex > -1) {
        if (cartItems[existingIndex].quantity + 1 > product.stock) {
            alert(`Stock limit reached! Only ${product.stock} units available.`);
            return;
        }
        cartItems[existingIndex].quantity += 1;
    } else {
        cartItems.push({
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            unit_price: parseFloat(product.price),
            quantity: 1,
            max_stock: product.stock,
            image_url: product.image_url
        });
    }

    renderCartUI();
}

/**
 * Update Cart Item Quantity (+ or -)
 */
function updateCartQuantity(productId, delta) {
    const item = cartItems.find(i => i.product_id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQty > item.max_stock) {
        alert(`Stock limit reached! Maximum available is ${item.max_stock}.`);
        return;
    }

    item.quantity = newQty;
    renderCartUI();
}

/**
 * Remove Item from Cart
 */
function removeFromCart(productId) {
    cartItems = cartItems.filter(i => i.product_id !== productId);
    renderCartUI();
}

/**
 * Clear Entire Cart
 */
function clearCart() {
    cartItems = [];
    selectedCustomer = null;
    attachedPrescription = null;
    renderCartUI();
}

/**
 * Render Shopping Cart UI & Recalculate Totals
 */
function renderCartUI() {
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    const customerDisplay = document.getElementById('cart-customer-display');
    const rxBadge = document.getElementById('attached-rx-badge');
    const rxSummaryText = document.getElementById('rx-summary-text');

    if (!container) return;

    // Customer & RX Display Update
    if (selectedCustomer) {
        customerDisplay.innerHTML = `<i class="fa-solid fa-user-check text-cyan-400 mr-1.5"></i> <span class="text-cyan-300 font-bold">${selectedCustomer.full_name}</span> (${selectedCustomer.phone})`;
    } else {
        customerDisplay.innerHTML = `<i class="fa-solid fa-user text-slate-500 mr-1.5"></i> Walk-in Customer`;
    }

    if (attachedPrescription) {
        if (rxBadge) rxBadge.classList.remove('hidden');
        if (rxSummaryText) {
            rxSummaryText.textContent = `OD: ${attachedPrescription.od_sph} SPH / ${attachedPrescription.od_cyl} CYL | OS: ${attachedPrescription.os_sph} SPH / ${attachedPrescription.os_cyl} CYL`;
        }
    } else {
        if (rxBadge) rxBadge.classList.add('hidden');
    }

    // Render Line Items
    if (cartItems.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
                <i class="fa-solid fa-basket-shopping text-3xl mb-2 text-slate-600"></i>
                <div class="text-xs font-semibold">Cart is currently empty</div>
                <div class="text-[11px] text-slate-600 mt-0.5">Click products from the grid to add</div>
            </div>
        `;
        subtotalEl.textContent = '$0.00';
        taxEl.textContent = '$0.00';
        totalEl.textContent = '$0.00';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    let subtotal = 0;

    container.innerHTML = cartItems.map(item => {
        const itemTotal = item.unit_price * item.quantity;
        subtotal += itemTotal;

        return `
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs gap-2">
                <div class="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow">
                    ${item.image_url ? `<img src="${item.image_url}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-tag text-slate-600 text-xs"></i>`}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-slate-200 truncate">${item.name}</div>
                    <div class="text-[10px] text-slate-400 font-mono">$${item.unit_price.toFixed(2)} × ${item.quantity}</div>
                </div>

                <!-- Quantity Controls -->
                <div class="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
                    <button onclick="updateCartQuantity('${item.product_id}', -1)" class="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition">-</button>
                    <span class="w-5 text-center font-mono font-bold text-white text-xs">${item.quantity}</span>
                    <button onclick="updateCartQuantity('${item.product_id}', 1)" class="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition">+</button>
                </div>

                <div class="text-right min-w-[55px]">
                    <div class="font-mono font-bold text-cyan-400">$${itemTotal.toFixed(2)}</div>
                    <button onclick="removeFromCart('${item.product_id}')" class="text-[10px] text-slate-500 hover:text-rose-400 transition">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    const tax = subtotal * 0.08; // 8% Est Tax
    const total = subtotal + tax;

    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    taxEl.textContent = `$${tax.toFixed(2)}`;
    totalEl.textContent = `$${total.toFixed(2)}`;
    if (checkoutBtn) checkoutBtn.disabled = false;
}

/**
 * Open Customer & Prescription Modal
 */
function openPrescriptionModal() {
    const modal = document.getElementById('modal-prescription');
    const custSelect = document.getElementById('rx-customer-select');

    // Load customer dropdown
    const customers = window.MockStore ? window.MockStore.getCustomers() : [];
    custSelect.innerHTML = `
        <option value="">-- Select Existing Customer --</option>
        ${customers.map(c => `<option value="${c.id}">${c.full_name} (${c.phone})</option>`).join('')}
    `;

    if (selectedCustomer) {
        custSelect.value = selectedCustomer.id;
    }

    if (modal) modal.classList.remove('hidden');
}

/**
 * Toggle New Customer Form Visibility
 */
function toggleNewCustomerForm() {
    const form = document.getElementById('new-customer-form');
    if (form) form.classList.toggle('hidden');
}

/**
 * Save Customer & Attach Prescription to Cart
 */
function savePrescriptionAndAttach() {
    const custSelect = document.getElementById('rx-customer-select');
    const newName = document.getElementById('new-cust-name').value.trim();
    const newPhone = document.getElementById('new-cust-phone').value.trim();
    const newEmail = document.getElementById('new-cust-email').value.trim();

    let customer = null;

    if (newName && newPhone) {
        // Create new customer
        customer = window.MockStore.addCustomer({
            full_name: newName,
            phone: newPhone,
            email: newEmail
        });
    } else if (custSelect.value) {
        const customers = window.MockStore.getCustomers();
        customer = customers.find(c => c.id === custSelect.value);
    }

    selectedCustomer = customer;

    // Read Prescription Fields
    attachedPrescription = {
        customer_id: customer ? customer.id : null,
        od_sph: parseFloat(document.getElementById('rx-od-sph').value || 0),
        od_cyl: parseFloat(document.getElementById('rx-od-cyl').value || 0),
        od_axis: parseInt(document.getElementById('rx-od-axis').value || 0),
        od_add: parseFloat(document.getElementById('rx-od-add').value || 0),
        os_sph: parseFloat(document.getElementById('rx-os-sph').value || 0),
        os_cyl: parseFloat(document.getElementById('rx-os-cyl').value || 0),
        os_axis: parseInt(document.getElementById('rx-os-axis').value || 0),
        os_add: parseFloat(document.getElementById('rx-os-add').value || 0),
        pd: parseFloat(document.getElementById('rx-pd').value || 64.0),
        notes: document.getElementById('rx-notes').value.trim()
    };

    if (customer) {
        window.MockStore.addPrescription(attachedPrescription);
    }

    renderCartUI();
    closeModal('modal-prescription');
}

/**
 * Open AI Recommendation Engine Modal
 */
function openAiRecommendationModal() {
    if (!attachedPrescription) {
        alert('Please attach an Optical Prescription first before triggering AI Recommendations.');
        openPrescriptionModal();
        return;
    }

    const modal = document.getElementById('modal-ai-recommendation');
    const summaryEl = document.getElementById('ai-clinical-summary');
    const listEl = document.getElementById('ai-recommendations-list');

    // Run AI Engine logic
    if (typeof AiEngine === 'object') {
        const analysis = AiEngine.analyzePrescription(attachedPrescription);
        const recommendations = AiEngine.getRecommendations(attachedPrescription, activeProducts);

        if (summaryEl) summaryEl.textContent = analysis.rationaleSummary;

        if (listEl) {
            if (recommendations.length === 0) {
                listEl.innerHTML = `<div class="text-xs text-slate-400">No specific stock matches found for recommendation rules.</div>`;
            } else {
                listEl.innerHTML = recommendations.map(rec => `
                    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                            <div class="font-bold text-slate-100">${rec.product.name}</div>
                            <div class="text-[10px] text-cyan-400 mt-0.5"><i class="fa-solid fa-circle-info mr-1"></i>${rec.reason}</div>
                            <div class="text-[10px] text-slate-500 font-mono mt-0.5">$${parseFloat(rec.product.price).toFixed(2)} | Stock: ${rec.product.stock}</div>
                        </div>
                        <button onclick="addToCart('${rec.product.id}'); closeModal('modal-ai-recommendation');"
                            class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs transition whitespace-nowrap">
                            + Apply to Cart
                        </button>
                    </div>
                `).join('');
            }
        }
    }

    if (modal) modal.classList.remove('hidden');
}

/**
 * Open Payment Checkout Modal
 */
function openCheckoutModal() {
    if (cartItems.length === 0) return;

    let subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    let total = subtotal * 1.08;

    document.getElementById('checkout-total-display').textContent = `$${total.toFixed(2)}`;
    document.getElementById('cash-tendered').value = total.toFixed(2);
    calculateChange();

    const modal = document.getElementById('modal-checkout');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Select Payment Method
 */
function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.pay-method-btn').forEach(btn => {
        if (btn.id === `pay-${method}`) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const cashBlock = document.getElementById('cash-tendered-block');
    if (cashBlock) {
        if (method === 'Cash') {
            cashBlock.classList.remove('hidden');
        } else {
            cashBlock.classList.add('hidden');
        }
    }
}

/**
 * Calculate Cash Change Due
 */
function calculateChange() {
    let subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    let total = subtotal * 1.08;

    const tendered = parseFloat(document.getElementById('cash-tendered').value || 0);
    const change = Math.max(0, tendered - total);

    document.getElementById('cash-change-display').textContent = `$${change.toFixed(2)}`;
}

/**
 * Complete Order & Save Transaction
 */
async function processOrderCheckout() {
    if (cartItems.length === 0) return;

    const user = AuthManager.getCurrentUser();
    const branchId = AuthManager.getActiveBranchId();

    let subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    let totalAmount = subtotal * 1.08;

    const orderData = {
        branch_id: branchId,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        prescription_id: attachedPrescription ? attachedPrescription.id : null,
        cashier_id: user ? user.id : null,
        total_amount: totalAmount,
        payment_method: selectedPaymentMethod,
        payment_status: 'Paid'
    };

    const orderItemsData = cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
    }));

    let completedOrder = null;

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            // Insert Order
            const { data: newOrder, error: orderErr } = await window.supabaseClient
                .from('orders')
                .insert([{ ...orderData, order_number: 'ORD-' + Date.now().toString().slice(-8) }])
                .select()
                .single();

            if (!orderErr && newOrder) {
                const itemsToInsert = orderItemsData.map(i => ({ ...i, order_id: newOrder.id }));
                await window.supabaseClient.from('order_items').insert(itemsToInsert);
                completedOrder = newOrder;
            }
        } catch (err) {
            console.warn('Supabase checkout failed, fallback to MockStore:', err);
        }
    }

    if (!completedOrder) {
        const result = window.MockStore.saveOrder(orderData, orderItemsData);
        completedOrder = result.order;
    }

    activeOrderForReceipt = {
        order: completedOrder,
        items: cartItems,
        customer: selectedCustomer,
        prescription: attachedPrescription,
        cashier: user,
        cashTendered: parseFloat(document.getElementById('cash-tendered').value || totalAmount),
        changeDue: Math.max(0, parseFloat(document.getElementById('cash-tendered').value || totalAmount) - totalAmount)
    };

    // Refresh products stock
    await loadBranchProducts();

    // Close Checkout Modal & Render Thermal Receipt
    closeModal('modal-checkout');
    renderThermalReceipt(activeOrderForReceipt);

    // Reset Cart
    cartItems = [];
    selectedCustomer = null;
    attachedPrescription = null;
    renderCartUI();
}

/**
 * Render 80mm Printable Thermal Receipt
 */
function renderThermalReceipt(orderReceiptData) {
    if (!orderReceiptData) return;

    const { order, items, customer, prescription, cashier, cashTendered, changeDue } = orderReceiptData;
    const branches = window.MockStore ? window.MockStore.getBranches() : [];
    const branch = branches.find(b => b.id === order.branch_id) || { name: 'Downtown Branch', address: '101 Grand Ave', phone: '+1 555-019-2831' };

    document.getElementById('rc-branch-name').textContent = branch.name;
    document.getElementById('rc-branch-address').textContent = branch.address;
    document.getElementById('rc-branch-phone').textContent = `Tel: ${branch.phone}`;

    document.getElementById('rc-order-number').textContent = order.order_number;
    document.getElementById('rc-date-time').textContent = new Date(order.created_at || Date.now()).toLocaleString();
    document.getElementById('rc-cashier').textContent = cashier ? cashier.full_name : 'Staff Cashier';
    document.getElementById('rc-customer').textContent = customer ? customer.full_name : 'Walk-in Customer';

    // Render Prescription Block if present
    const rxBlock = document.getElementById('rc-prescription-block');
    if (prescription && rxBlock) {
        rxBlock.classList.remove('hidden');
        document.getElementById('rc-od-sph').textContent = prescription.od_sph.toFixed(2);
        document.getElementById('rc-od-cyl').textContent = prescription.od_cyl.toFixed(2);
        document.getElementById('rc-od-axis').textContent = `${prescription.od_axis}°`;
        document.getElementById('rc-od-add').textContent = prescription.od_add > 0 ? `+${prescription.od_add.toFixed(2)}` : '0.00';

        document.getElementById('rc-os-sph').textContent = prescription.os_sph.toFixed(2);
        document.getElementById('rc-os-cyl').textContent = prescription.os_cyl.toFixed(2);
        document.getElementById('rc-os-axis').textContent = `${prescription.os_axis}°`;
        document.getElementById('rc-os-add').textContent = prescription.os_add > 0 ? `+${prescription.os_add.toFixed(2)}` : '0.00';

        document.getElementById('rc-pd').textContent = prescription.pd;
    } else if (rxBlock) {
        rxBlock.classList.add('hidden');
    }

    // Render Items
    const itemsList = document.getElementById('rc-items-list');
    let subtotal = 0;
    if (itemsList) {
        itemsList.innerHTML = items.map(item => {
            const itemTotal = item.unit_price * item.quantity;
            subtotal += itemTotal;
            return `
                <div class="receipt-item-row font-mono text-[10px]">
                    <div class="font-bold truncate">${item.name}</div>
                    <div class="flex justify-between">
                        <span>${item.quantity} x $${item.unit_price.toFixed(2)}</span>
                        <span>$${itemTotal.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    document.getElementById('rc-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('rc-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('rc-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('rc-pay-method').textContent = order.payment_method;

    const cashRow = document.getElementById('rc-cash-row');
    if (order.payment_method === 'Cash' && cashRow) {
        cashRow.classList.remove('hidden');
        document.getElementById('rc-cash-change').textContent = `$${cashTendered.toFixed(2)} / $${changeDue.toFixed(2)}`;
    } else if (cashRow) {
        cashRow.classList.add('hidden');
    }

    const receiptModal = document.getElementById('modal-receipt');
    if (receiptModal) receiptModal.classList.remove('hidden');
}

/**
 * Universal Modal Closer Helper
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

window.switchTab = switchTab;
window.filterCategory = filterCategory;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.openPrescriptionModal = openPrescriptionModal;
window.toggleNewCustomerForm = toggleNewCustomerForm;
window.savePrescriptionAndAttach = savePrescriptionAndAttach;
window.openAiRecommendationModal = openAiRecommendationModal;
window.openCheckoutModal = openCheckoutModal;
window.selectPaymentMethod = selectPaymentMethod;
window.calculateChange = calculateChange;
window.processOrderCheckout = processOrderCheckout;
window.closeModal = closeModal;

/**
 * Barcode Scanner Integration: Add Product by Barcode/SKU to POS Invoice Cart
 */
function scanBarcodeToCart(scannedSku) {
    if (!scannedSku) return;
    const cleanSku = scannedSku.trim().toLowerCase();

    // Find product matching SKU or ID in active products catalog
    const product = activeProducts.find(p => p.sku.toLowerCase() === cleanSku || p.id.toLowerCase() === cleanSku);

    if (!product) {
        if (window.BarcodeEngine) {
            window.BarcodeEngine.showToast(`No product found with barcode: "${scannedSku}"`, 'error');
        } else {
            alert(`No product found with barcode: "${scannedSku}"`);
        }
        return;
    }

    if (product.stock <= 0) {
        if (window.BarcodeEngine) {
            window.BarcodeEngine.showToast(`Product "${product.name}" (${product.sku}) is Out of Stock!`, 'warning');
        } else {
            alert(`Product "${product.name}" is Out of Stock!`);
        }
        return;
    }

    addToCart(product.id);

    const existingCartItem = cartItems.find(i => i.product_id === product.id);
    const qty = existingCartItem ? existingCartItem.quantity : 1;

    if (window.BarcodeEngine) {
        window.BarcodeEngine.showToast(`Added to invoice: ${product.name} (x${qty})`, 'success');
    }
}

window.scanBarcodeToCart = scanBarcodeToCart;

