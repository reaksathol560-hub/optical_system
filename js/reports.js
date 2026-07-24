/**
 * =============================================================================
 * SALES REPORTING MODULE & CLIENT-SIDE EXPORTS (EXCEL & PDF)
 * =============================================================================
 */

let currentFilteredOrders = [];
let activeReportBranchId = 'ALL';

/**
 * Initialize Reports Module
 */
document.addEventListener('DOMContentLoaded', async () => {
    const user = AuthManager.getCurrentUser();
    if (!user) return;

    await populateReportBranchFilter();

    // Set default date picker values (This Week)
    setReportDatePreset('week');
});

async function populateReportBranchFilter() {
    const user = AuthManager.getCurrentUser();
    const branchFilter = document.getElementById('report-branch-filter');
    if (!branchFilter || !user) return;

    if (user.role === 'superadmin') {
        branchFilter.classList.remove('hidden');
        let branches = window.cachedBranches;
        if (!branches || branches.length === 0) {
            branches = typeof AuthManager.getBranchesAsync === 'function' 
                ? await AuthManager.getBranchesAsync() 
                : (window.MockStore ? window.MockStore.getBranches() : []);
        }

        branchFilter.innerHTML = `
            <option value="ALL" ${activeReportBranchId === 'ALL' ? 'selected' : ''}>🏢 All Branches (Cross-Branch)</option>
            ${branches.map(b => `<option value="${b.id}" ${b.id === activeReportBranchId ? 'selected' : ''}>📍 ${b.name}</option>`).join('')}
        `;
        branchFilter.onchange = (e) => {
            activeReportBranchId = e.target.value;
            fetchSalesReportData();
        };
    } else {
        branchFilter.classList.add('hidden');
        activeReportBranchId = AuthManager.getActiveBranchId();
    }
}

/**
 * Set Date Filter Preset (Today, Week, Month)
 */
function setReportDatePreset(preset) {
    const now = new Date();
    const startDateInput = document.getElementById('report-date-start');
    const endDateInput = document.getElementById('report-date-end');

    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`preset-${preset}`);
    if (activeBtn) activeBtn.classList.add('active');

    let start = new Date(now);
    let end = new Date(now);

    if (preset === 'today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === 'week') {
        const day = start.getDay();
        const diffToMonday = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        start = new Date(now.setDate(diffToMonday));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
    } else if (preset === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
    }

    if (startDateInput) startDateInput.value = formatDateForInput(start);
    if (endDateInput) endDateInput.value = formatDateForInput(end);

    fetchSalesReportData();
}

function formatDateForInput(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fetch Sales Orders and Calculate Analytics KPI Aggregate Cards
 */
async function fetchSalesReportData() {
    const user = AuthManager.getCurrentUser();
    if (user && user.role === 'cashier') return; // Strict Cashier Block

    const startDateStr = document.getElementById('report-date-start')?.value;
    const endDateStr = document.getElementById('report-date-end')?.value;

    const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00`) : new Date(0);
    const endDate = endDateStr ? new Date(`${endDateStr}T23:59:59.999`) : new Date();

    let allOrders = [];

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            let query = window.supabaseClient.from('orders').select('*');

            if (user.role !== 'superadmin' || activeReportBranchId !== 'ALL') {
                const targetBranch = user.role !== 'superadmin' ? AuthManager.getActiveBranchId() : activeReportBranchId;
                query = query.eq('branch_id', targetBranch);
            }

            const { data, error } = await query
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (!error && data) {
                allOrders = data;
            }
        } catch (err) {
            console.warn('Supabase reports fetch failed, fallback to MockStore:', err);
        }
    }

    if (allOrders.length === 0 && window.MockStore) {
        const targetBranch = user.role !== 'superadmin' ? AuthManager.getActiveBranchId() : activeReportBranchId;
        const mockOrders = window.MockStore.getOrders(targetBranch === 'ALL' ? null : targetBranch);
        
        allOrders = mockOrders.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate >= startDate && orderDate <= endDate;
        });
    }

    currentFilteredOrders = allOrders;

    // Calculate KPI Aggregates
    calculateKPIAggregates(allOrders);

    // Render Data Table
    renderReportsTable(allOrders);
}

/**
 * Calculate KPI aggregate metrics
 */
function calculateKPIAggregates(orders) {
    const now = new Date();
    
    // Boundary dates
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diffToMonday));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    let todaySales = 0;
    let weeklySales = 0;
    let monthlySales = 0;

    const targetBranch = activeReportBranchId;
    const allMockOrders = window.MockStore ? window.MockStore.getOrders(targetBranch === 'ALL' ? null : targetBranch) : orders;

    allMockOrders.forEach(o => {
        const oDate = new Date(o.created_at);
        const amount = parseFloat(o.total_amount || 0);

        if (oDate >= startOfToday) todaySales += amount;
        if (oDate >= startOfWeek) weeklySales += amount;
        if (oDate >= startOfMonth) monthlySales += amount;
    });

    const totalFilteredRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const totalFilteredOrders = orders.length;
    const aov = totalFilteredOrders > 0 ? totalFilteredRevenue / totalFilteredOrders : 0;

    document.getElementById('kpi-today-sales').textContent = `$${todaySales.toFixed(2)}`;
    document.getElementById('kpi-weekly-sales').textContent = `$${weeklySales.toFixed(2)}`;
    document.getElementById('kpi-monthly-sales').textContent = `$${monthlySales.toFixed(2)}`;
    document.getElementById('kpi-total-orders').textContent = totalFilteredOrders.toLocaleString();
    document.getElementById('kpi-aov').textContent = `$${aov.toFixed(2)}`;
}

/**
 * Render Reports Table DOM
 */
function renderReportsTable(orders) {
    const tbody = document.getElementById('reports-table-body');
    const countEl = document.getElementById('table-record-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${orders.length} transaction records found`;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="py-8 text-center text-slate-500">
                    <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-600"></i>
                    <div>No sales transactions recorded for this date range</div>
                </td>
            </tr>
        `;
        return;
    }

    const branches = window.MockStore ? window.MockStore.getBranches() : [];
    const customers = window.MockStore ? window.MockStore.getCustomers() : [];
    const profiles = window.MockStore ? window.MockStore.getProfiles() : [];
    const orderItems = window.MockStore ? window.MockStore.getOrderItems() : [];

    const user = AuthManager.getCurrentUser();

    tbody.innerHTML = orders.map(o => {
        const branch = branches.find(b => b.id === o.branch_id) || { name: 'Main Branch' };
        const customer = customers.find(c => c.id === o.customer_id) || { full_name: 'Walk-in Customer' };
        const cashier = profiles.find(p => p.id === o.cashier_id) || { full_name: 'Staff Cashier' };
        const items = orderItems.filter(i => i.order_id === o.id);
        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0) || 1;

        const dateStr = new Date(o.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const canDelete = user && (user.role === 'superadmin' || user.role === 'admin');

        return `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-4 font-mono text-cyan-400 font-bold">${o.order_number}</td>
                <td class="py-3 px-4 text-slate-300 font-mono text-[11px]">${dateStr}</td>
                <td class="py-3 px-4 font-medium text-white">${customer.full_name}</td>
                <td class="py-3 px-4 text-slate-300">${branch.name}</td>
                <td class="py-3 px-4 text-center font-mono text-slate-300">${itemCount}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        ${o.payment_method}
                    </span>
                </td>
                <td class="py-3 px-4 text-right font-mono font-bold text-emerald-400">$${parseFloat(o.total_amount).toFixed(2)}</td>
                <td class="py-3 px-4 text-slate-400 text-[11px]">${cashier.full_name}</td>
                <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="viewHistoricalReceipt('${o.id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] transition">
                            <i class="fa-solid fa-receipt mr-1"></i> Receipt
                        </button>
                        ${canDelete ? `
                            <button onclick="deleteOrderData('${o.id}', '${o.order_number}')" title="Delete Order" class="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[11px] transition border border-rose-500/30">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Delete Order Data (Superadmin & Branch Admin Only)
 */
async function deleteOrderData(orderId, orderNumber) {
    const user = AuthManager.getCurrentUser();
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        alert('Access Denied: Only Superadmin and Branch Admin accounts can delete orders.');
        return;
    }

    if (!confirm(`Are you sure you want to delete order [${orderNumber || orderId}]? This action cannot be undone.`)) {
        return;
    }

    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
        try {
            await window.supabaseClient
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            const { error } = await window.supabaseClient
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) {
                alert(`Failed to delete order: ${error.message}`);
                return;
            }
        } catch (err) {
            console.error('Supabase order delete error:', err);
        }
    }

    if (window.MockStore) {
        let orders = window.MockStore.getOrders();
        orders = orders.filter(o => o.id !== orderId);
        localStorage.setItem('optical_pos_mock_orders', JSON.stringify(orders));

        let items = window.MockStore.getOrderItems();
        items = items.filter(i => i.order_id !== orderId);
        localStorage.setItem('optical_pos_mock_order_items', JSON.stringify(items));
    }

    await fetchSalesReportData();
}

/**
 * View Historical Receipt Modal
 */
function viewHistoricalReceipt(orderId) {
    const orders = window.MockStore ? window.MockStore.getOrders() : currentFilteredOrders;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const items = window.MockStore ? window.MockStore.getOrderItems(orderId) : [];
    const products = window.MockStore ? window.MockStore.getProducts() : [];
    const customers = window.MockStore ? window.MockStore.getCustomers() : [];
    const prescriptions = window.MockStore ? window.MockStore.getPrescriptions() : [];
    const profiles = window.MockStore ? window.MockStore.getProfiles() : [];

    const enrichedItems = items.map(i => {
        const prod = products.find(p => p.id === i.product_id);
        return {
            name: prod ? prod.name : 'Optical Product',
            unit_price: parseFloat(i.unit_price),
            quantity: i.quantity
        };
    });

    const customer = customers.find(c => c.id === order.customer_id);
    const prescription = prescriptions.find(p => p.id === order.prescription_id);
    const cashier = profiles.find(p => p.id === order.cashier_id);

    if (typeof renderThermalReceipt === 'function') {
        renderThermalReceipt({
            order,
            items: enrichedItems,
            customer,
            prescription,
            cashier,
            cashTendered: parseFloat(order.total_amount),
            changeDue: 0
        });
    }
}

/**
 * Client-Side Excel Export using SheetJS (XLSX)
 */
function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('SheetJS library is loading. Please check internet connection.');
        return;
    }

    if (currentFilteredOrders.length === 0) {
        alert('No data available to export.');
        return;
    }

    const branches = window.MockStore ? window.MockStore.getBranches() : [];
    const customers = window.MockStore ? window.MockStore.getCustomers() : [];
    const profiles = window.MockStore ? window.MockStore.getProfiles() : [];
    const orderItems = window.MockStore ? window.MockStore.getOrderItems() : [];

    const exportData = currentFilteredOrders.map((o, idx) => {
        const branch = branches.find(b => b.id === o.branch_id) || { name: 'Main Branch' };
        const customer = customers.find(c => c.id === o.customer_id) || { full_name: 'Walk-in Customer' };
        const cashier = profiles.find(p => p.id === o.cashier_id) || { full_name: 'Staff Cashier' };
        const items = orderItems.filter(i => i.order_id === o.id);
        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0) || 1;

        return {
            'No.': idx + 1,
            'Order Number': o.order_number,
            'Date & Time': new Date(o.created_at).toLocaleString(),
            'Customer Name': customer.full_name,
            'Branch Name': branch.name,
            'Item Count': itemCount,
            'Payment Method': o.payment_method,
            'Total Amount ($)': parseFloat(o.total_amount),
            'Payment Status': o.payment_status,
            'Cashier Name': cashier.full_name
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

    const fileName = `Optical_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

/**
 * Client-Side PDF Export using jsPDF and AutoTable
 */
function exportToPDF() {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        alert('jsPDF library is loading. Please check internet connection.');
        return;
    }

    if (currentFilteredOrders.length === 0) {
        alert('No data available to export.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const startDateStr = document.getElementById('report-date-start')?.value || '';
    const endDateStr = document.getElementById('report-date-end')?.value || '';

    // Document Header
    doc.setFillColor(15, 23, 42); // Dark slate header
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('LENS & VISION OPTICAL POS', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(56, 189, 248); // Cyan subheader
    doc.text('EXECUTIVE SALES & REVENUE REPORT', 14, 22);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Date Range: ${startDateStr} to ${endDateStr}`, 14, 28);

    // KPI Summary Panel Box
    const totalRev = currentFilteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const totalCount = currentFilteredOrders.length;
    const aov = totalCount > 0 ? totalRev / totalCount : 0;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 36, 182, 18, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Orders: ${totalCount}`, 20, 47);
    doc.text(`Total Sales Revenue: $${totalRev.toFixed(2)}`, 85, 47);
    doc.text(`Average Order Value: $${aov.toFixed(2)}`, 150, 47);

    // Build Table Rows
    const branches = window.MockStore ? window.MockStore.getBranches() : [];
    const customers = window.MockStore ? window.MockStore.getCustomers() : [];
    const profiles = window.MockStore ? window.MockStore.getProfiles() : [];
    const orderItems = window.MockStore ? window.MockStore.getOrderItems() : [];

    const tableRows = currentFilteredOrders.map(o => {
        const branch = branches.find(b => b.id === o.branch_id) || { name: 'Main Branch' };
        const customer = customers.find(c => c.id === o.customer_id) || { full_name: 'Walk-in' };
        const cashier = profiles.find(p => p.id === o.cashier_id) || { full_name: 'Staff' };
        const items = orderItems.filter(i => i.order_id === o.id);
        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0) || 1;

        return [
            o.order_number,
            new Date(o.created_at).toLocaleDateString(),
            customer.full_name,
            branch.name,
            itemCount,
            o.payment_method,
            `$${parseFloat(o.total_amount).toFixed(2)}`,
            cashier.full_name
        ];
    });

    doc.autoTable({
        startY: 58,
        head: [['Order No', 'Date', 'Customer', 'Branch', 'Items', 'Payment', 'Amount', 'Cashier']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [51, 65, 85]
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 32 },
            6: { fontStyle: 'bold', halign: 'right' }
        },
        didDrawPage: function (data) {
            // Footer page numbers
            const str = `Page ${doc.internal.getNumberOfPages()}`;
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });

    const fileName = `Optical_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
}

window.populateReportBranchFilter = populateReportBranchFilter;
window.fetchSalesReportData = fetchSalesReportData;
window.setReportDatePreset = setReportDatePreset;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.viewHistoricalReceipt = viewHistoricalReceipt;
window.deleteOrderData = deleteOrderData;
