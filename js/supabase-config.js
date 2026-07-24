/**
 * =============================================================================
 * SUPABASE CLIENT CONFIGURATION & LOCAL MOCK DATA FALLBACK ENGINE
 * =============================================================================
 * Replace the constants below with your actual Supabase Project URL and Anon Key.
 * If left as placeholders, the application seamlessly uses a local mock store
 * for instant client-side testing without any setup!
 */

// ⚠️ SUPABASE CREDENTIALS ⚠️
const SUPABASE_URL = (window.ENV && window.ENV.SUPABASE_URL) || 'https://fmlsqswrgmhugncqpaiu.supabase.co';
const SUPABASE_ANON_KEY = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtbHNxc3dyZ21odWduY3FwYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDcwMjQsImV4cCI6MjA5NTk4MzAyNH0.TUzE4X-xuL7PlodF9mtR6-0VFNPVT9PrV5ftS0OefZM';

let supabaseClient = null;

/**
 * Check if real Supabase credentials have been configured
 */
function isSupabaseConfigured() {
    return (
        SUPABASE_URL &&
        !SUPABASE_URL.includes('YOUR_SUPABASE_PROJECT_ID') &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
    );
}

// Initialize Supabase Client if configured and library present
if (isSupabaseConfigured() && window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Connected to Supabase Cloud Engine');
    } catch (err) {
        console.warn('⚠️ Failed to initialize Supabase client:', err);
    }
} else {
    console.info('ℹ️ Running in Static / Local Mock Mode (Supabase URL/Key unconfigured).');
}

/**
 * Local Mock Storage Engine
 * Seeded from supabase_schema.sql mock data for offline demonstration
 */
const MOCK_DATA = {
    branches: [
        { id: 'br-downtown', name: 'Downtown Central Branch', code: 'BR-DT01', address: '101 Grand Avenue, Suite 400', phone: '+1 (555) 019-2831' },
        { id: 'br-citymall', name: 'City Mall Branch', code: 'BR-CM02', address: 'Level 2, City Center Mall', phone: '+1 (555) 018-9942' },
        { id: 'br-westside', name: 'Westside Plaza Branch', code: 'BR-WS03', address: '450 Westside Boulevard', phone: '+1 (555) 017-4411' }
    ],
    profiles: [
        { id: 'usr-superadmin', email: 'superadmin@optical.com', password: 'demo123', full_name: 'Eleanor Vance', role: 'superadmin', branch_id: 'br-downtown' },
        { id: 'usr-admin-dt', email: 'admin.downtown@optical.com', password: 'demo123', full_name: 'Marcus Brody', role: 'admin', branch_id: 'br-downtown' },
        { id: 'usr-cashier-dt', email: 'cashier.downtown@optical.com', password: 'demo123', full_name: 'Sophia Turner', role: 'cashier', branch_id: 'br-downtown' },
        { id: 'usr-cashier-cm', email: 'cashier.citymall@optical.com', password: 'demo123', full_name: 'Liam Henderson', role: 'cashier', branch_id: 'br-citymall' }
    ],
    customers: [
        { id: 'cust-john', full_name: 'John Doe', phone: '+1 555-1234', email: 'john.doe@example.com', address: '12 Pine Street' },
        { id: 'cust-jane', full_name: 'Jane Smith', phone: '+1 555-5678', email: 'jane.smith@example.com', address: '88 Elm Avenue' },
        { id: 'cust-robert', full_name: 'Robert Johnson', phone: '+1 555-9012', email: 'robert.j@example.com', address: '54 Oak Parkway' },
        { id: 'cust-emily', full_name: 'Emily Davis', phone: '+1 555-3456', email: 'emily.davis@example.com', address: '302 Maple Drive' },
        { id: 'cust-michael', full_name: 'Michael Brown', phone: '+1 555-7890', email: 'mbrown@example.com', address: '77 Cedar Road' }
    ],
    prescriptions: [
        { id: 'rx-john-01', customer_id: 'cust-john', od_sph: -4.50, od_cyl: -1.25, od_axis: 90, od_add: 2.00, os_sph: -4.75, os_cyl: -1.50, os_axis: 85, os_add: 2.00, pd: 64.0, notes: 'High myopia with presbyopia. Recommend 1.67 High Index Progressive.' },
        { id: 'rx-jane-01', customer_id: 'cust-jane', od_sph: -1.25, od_cyl: -0.50, od_axis: 180, od_add: 0.00, os_sph: -1.00, os_cyl: -0.75, os_axis: 175, os_add: 0.00, pd: 62.0, notes: 'Mild myopia. Recommended Blue-Cut Anti-Reflective coating for heavy computer work.' },
        { id: 'rx-robert-01', customer_id: 'cust-robert', od_sph: 2.25, od_cyl: -2.00, od_axis: 45, od_add: 1.50, os_sph: 2.50, os_cyl: -1.75, os_axis: 50, os_add: 1.50, pd: 66.5, notes: 'Hyperopia & Astigmatism. Photochromic lens suggested for outdoor comfort.' }
    ],
    products: [
        { id: 'prod-rb-001', branch_id: 'br-downtown', name: 'Ray-Ban Wayfarer Classic Black', sku: 'FRM-RB-001', category: 'Frames', price: 165.00, stock: 25, prescription_type: 'Frame Only', image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80', description: 'Iconic square black acetate frame.' },
        { id: 'prod-ok-002', branch_id: 'br-downtown', name: 'Oakley Holbrook Matte Black', sku: 'FRM-OK-002', category: 'Frames', price: 142.00, stock: 18, prescription_type: 'Frame Only', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80', description: 'Lightweight O Matter frame with metal rivets.' },
        { id: 'prod-gc-003', branch_id: 'br-downtown', name: 'Gucci Lightweight Titanium Gold', sku: 'FRM-GC-003', category: 'Frames', price: 320.00, stock: 10, prescription_type: 'Frame Only', image_url: 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=400&q=80', description: 'Premium ultra-light titanium frame.' },
        { id: 'prod-tf-001', branch_id: 'br-downtown', name: 'Tom Ford Round Vintage Tortoise', sku: 'FRM-TF-001', category: 'Frames', price: 280.00, stock: 12, prescription_type: 'Frame Only', image_url: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=400&q=80', description: 'Luxury acetate frame with Signature T logo.' },
        { id: 'prod-pr-002', branch_id: 'br-downtown', name: 'Prada Cat-Eye Black Edition', sku: 'FRM-PR-002', category: 'Frames', price: 310.00, stock: 8, prescription_type: 'Frame Only', image_url: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?auto=format&fit=crop&w=400&q=80', description: 'High fashion women cat-eye frame.' },
        { id: 'prod-lns-156', branch_id: 'br-downtown', name: 'Single Vision 1.56 Anti-Blue Lens', sku: 'LNS-SV-156', category: 'Lenses', price: 75.00, stock: 100, prescription_type: 'Single Vision', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', description: 'Standard index with blue light blocking filter.' },
        { id: 'prod-lns-167', branch_id: 'br-downtown', name: 'High Index 1.67 Aspheric Lens', sku: 'LNS-HI-167', category: 'Lenses', price: 140.00, stock: 50, prescription_type: 'Single Vision High Index', image_url: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80', description: 'Ultra-thin lightweight lens for high prescriptions.' },
        { id: 'prod-lns-160', branch_id: 'br-downtown', name: 'Premium Progressive HD 1.60 Lens', sku: 'LNS-PRG-160', category: 'Lenses', price: 210.00, stock: 30, prescription_type: 'Progressive', image_url: 'https://images.unsplash.com/photo-1582142306909-195724d33ffc?auto=format&fit=crop&w=400&q=80', description: 'Wide digital corridor progressive lens with AR coating.' },
        { id: 'prod-lns-159', branch_id: 'br-downtown', name: 'Transitions Gen8 Photochromic 1.59', sku: 'LNS-TR8-159', category: 'Lenses', price: 185.00, stock: 40, prescription_type: 'Photochromic', image_url: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=400&q=80', description: 'Fast darkening outdoor photochromic lens.' },
        { id: 'prod-cnt-001', branch_id: 'br-downtown', name: 'Acuvue Oasys Monthly (6 pack)', sku: 'CNT-ACV-001', category: 'Contact Lenses', price: 45.00, stock: 60, prescription_type: 'Contact Lens', image_url: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80', description: 'Breathable silicone hydrogel contacts.' },
        { id: 'prod-acc-001', branch_id: 'br-downtown', name: 'Anti-Fog Microfiber Cleaning Cloth', sku: 'ACC-CLT-001', category: 'Accessories', price: 8.50, stock: 150, prescription_type: 'N/A', image_url: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80', description: 'Reusable anti-fog microfiber lens cloth.' },
        { id: 'prod-srv-001', branch_id: 'br-downtown', name: 'Comprehensive Eye Exam & Refraction', sku: 'SRV-EXM-001', category: 'Services', price: 35.00, stock: 999, prescription_type: 'Service', image_url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80', description: 'Full visual acuity and ophthalmic check up.' },
        { id: 'prod-poly-159', branch_id: 'br-citymall', name: 'Polycarbonate 1.59 Impact Resistant', sku: 'LNS-POLY-159', category: 'Lenses', price: 90.00, stock: 45, prescription_type: 'Single Vision Safety', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', description: 'Shatterproof lens ideal for sports and rimless frames.' },
        { id: 'prod-uhi-174', branch_id: 'br-citymall', name: 'Ultra High Index 1.74 Lens', sku: 'LNS-UHI-174', category: 'Lenses', price: 260.00, stock: 20, prescription_type: 'Ultra High Index', image_url: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80', description: 'Thinnest lens available for extreme prescriptions.' },
        { id: 'prod-sol-001', branch_id: 'br-citymall', name: 'Opti-Free Express Solution 355ml', sku: 'ACC-SOL-001', category: 'Accessories', price: 14.00, stock: 80, prescription_type: 'N/A', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', description: 'Multi-purpose contact lens solution.' }
    ],
    orders: [
        {
            id: 'ord-101',
            order_number: 'ORD-20260724-001',
            branch_id: 'br-downtown',
            customer_id: 'cust-john',
            prescription_id: 'rx-john-01',
            cashier_id: 'usr-cashier-dt',
            total_amount: 375.00,
            payment_method: 'Credit Card',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 3600 * 1000).toISOString()
        },
        {
            id: 'ord-102',
            order_number: 'ORD-20260724-002',
            branch_id: 'br-downtown',
            customer_id: 'cust-jane',
            prescription_id: 'rx-jane-01',
            cashier_id: 'usr-cashier-dt',
            total_amount: 217.00,
            payment_method: 'Cash',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
        },
        {
            id: 'ord-103',
            order_number: 'ORD-20260722-003',
            branch_id: 'br-downtown',
            customer_id: 'cust-robert',
            prescription_id: 'rx-robert-01',
            cashier_id: 'usr-cashier-dt',
            total_amount: 505.00,
            payment_method: 'Mobile Banking',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
        },
        {
            id: 'ord-104',
            order_number: 'ORD-20260723-004',
            branch_id: 'br-citymall',
            customer_id: 'cust-emily',
            prescription_id: null,
            cashier_id: 'usr-cashier-cm',
            total_amount: 370.00,
            payment_method: 'QR Code',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        },
        {
            id: 'ord-105',
            order_number: 'ORD-20260712-005',
            branch_id: 'br-downtown',
            customer_id: 'cust-michael',
            prescription_id: null,
            cashier_id: 'usr-cashier-dt',
            total_amount: 125.00,
            payment_method: 'Cash',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
        },
        {
            id: 'ord-106',
            order_number: 'ORD-20260614-006',
            branch_id: 'br-downtown',
            customer_id: 'cust-john',
            prescription_id: null,
            cashier_id: 'usr-cashier-dt',
            total_amount: 305.00,
            payment_method: 'Credit Card',
            payment_status: 'Paid',
            created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
        }
    ],
    order_items: [
        { id: 'item-101-1', order_id: 'ord-101', product_id: 'prod-rb-001', quantity: 1, unit_price: 165.00, total_price: 165.00 },
        { id: 'item-101-2', order_id: 'ord-101', product_id: 'prod-lns-160', quantity: 1, unit_price: 210.00, total_price: 210.00 },
        { id: 'item-102-1', order_id: 'ord-102', product_id: 'prod-ok-002', quantity: 1, unit_price: 142.00, total_price: 142.00 },
        { id: 'item-102-2', order_id: 'ord-102', product_id: 'prod-lns-156', quantity: 1, unit_price: 75.00, total_price: 75.00 },
        { id: 'item-103-1', order_id: 'ord-103', product_id: 'prod-gc-003', quantity: 1, unit_price: 320.00, total_price: 320.00 },
        { id: 'item-103-2', order_id: 'ord-103', product_id: 'prod-lns-159', quantity: 1, unit_price: 185.00, total_price: 185.00 },
        { id: 'item-104-1', order_id: 'ord-104', product_id: 'prod-tf-001', quantity: 1, unit_price: 280.00, total_price: 280.00 },
        { id: 'item-104-2', order_id: 'ord-104', product_id: 'prod-poly-159', quantity: 1, unit_price: 90.00, total_price: 90.00 },
        { id: 'item-105-1', order_id: 'ord-105', product_id: 'prod-cnt-001', quantity: 2, unit_price: 45.00, total_price: 90.00 },
        { id: 'item-105-2', order_id: 'ord-105', product_id: 'prod-srv-001', quantity: 1, unit_price: 35.00, total_price: 35.00 },
        { id: 'item-106-1', order_id: 'ord-106', product_id: 'prod-rb-001', quantity: 1, unit_price: 165.00, total_price: 165.00 },
        { id: 'item-106-2', order_id: 'ord-106', product_id: 'prod-lns-167', quantity: 1, unit_price: 140.00, total_price: 140.00 }
    ]
};

// Initialize localStorage with mock data if empty or missing image_url
(function initMockLocalStorage() {
    const existingProducts = localStorage.getItem('optical_pos_mock_products');
    let needsReseed = !existingProducts;
    if (existingProducts) {
        try {
            const parsed = JSON.parse(existingProducts);
            if (!parsed[0] || !parsed[0].image_url) {
                needsReseed = true;
            }
        } catch (e) {
            needsReseed = true;
        }
    }

    if (!localStorage.getItem('optical_pos_mock_initialized') || needsReseed) {
        localStorage.setItem('optical_pos_mock_branches', JSON.stringify(MOCK_DATA.branches));
        localStorage.setItem('optical_pos_mock_profiles', JSON.stringify(MOCK_DATA.profiles));
        localStorage.setItem('optical_pos_mock_customers', JSON.stringify(MOCK_DATA.customers));
        localStorage.setItem('optical_pos_mock_prescriptions', JSON.stringify(MOCK_DATA.prescriptions));
        localStorage.setItem('optical_pos_mock_products', JSON.stringify(MOCK_DATA.products));
        localStorage.setItem('optical_pos_mock_orders', JSON.stringify(MOCK_DATA.orders));
        localStorage.setItem('optical_pos_mock_order_items', JSON.stringify(MOCK_DATA.order_items));
        localStorage.setItem('optical_pos_mock_initialized', 'true');
    }
})();

// Helper mock storage accessors
const MockStore = {
    getBranches() {
        return JSON.parse(localStorage.getItem('optical_pos_mock_branches') || '[]');
    },
    getProfiles() {
        return JSON.parse(localStorage.getItem('optical_pos_mock_profiles') || '[]');
    },
    getCustomers() {
        return JSON.parse(localStorage.getItem('optical_pos_mock_customers') || '[]');
    },
    getPrescriptions() {
        return JSON.parse(localStorage.getItem('optical_pos_mock_prescriptions') || '[]');
    },
    getProducts(branchId = null) {
        const products = JSON.parse(localStorage.getItem('optical_pos_mock_products') || '[]');
        if (branchId) {
            return products.filter(p => p.branch_id === branchId);
        }
        return products;
    },
    getOrders(branchId = null) {
        const orders = JSON.parse(localStorage.getItem('optical_pos_mock_orders') || '[]');
        if (branchId) {
            return orders.filter(o => o.branch_id === branchId);
        }
        return orders;
    },
    getOrderItems(orderId = null) {
        const items = JSON.parse(localStorage.getItem('optical_pos_mock_order_items') || '[]');
        if (orderId) {
            return items.filter(i => i.order_id === orderId);
        }
        return items;
    },
    addCustomer(customerData) {
        const customers = this.getCustomers();
        const newCustomer = {
            id: 'cust-' + Date.now(),
            created_at: new Date().toISOString(),
            ...customerData
        };
        customers.push(newCustomer);
        localStorage.setItem('optical_pos_mock_customers', JSON.stringify(customers));
        return newCustomer;
    },
    addPrescription(prescriptionData) {
        const prescriptions = this.getPrescriptions();
        const newPrescription = {
            id: 'rx-' + Date.now(),
            created_at: new Date().toISOString(),
            ...prescriptionData
        };
        prescriptions.push(newPrescription);
        localStorage.setItem('optical_pos_mock_prescriptions', JSON.stringify(prescriptions));
        return newPrescription;
    },
    saveOrder(orderData, orderItemsData) {
        const orders = this.getOrders();
        const orderItems = this.getOrderItems();
        const products = this.getProducts();

        const newOrder = {
            id: 'ord-' + Date.now(),
            order_number: 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
            created_at: new Date().toISOString(),
            ...orderData
        };

        orders.unshift(newOrder);

        orderItemsData.forEach(item => {
            const newItem = {
                id: 'item-' + Math.random().toString(36).substr(2, 9),
                order_id: newOrder.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity
            };
            orderItems.push(newItem);

            // Deduct stock in mock products
            const prod = products.find(p => p.id === item.product_id);
            if (prod) {
                prod.stock = Math.max(0, prod.stock - item.quantity);
            }
        });

        localStorage.setItem('optical_pos_mock_orders', JSON.stringify(orders));
        localStorage.setItem('optical_pos_mock_order_items', JSON.stringify(orderItems));
        localStorage.setItem('optical_pos_mock_products', JSON.stringify(products));

        return { order: newOrder, items: orderItemsData };
    }
};

window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.MockStore = MockStore;
