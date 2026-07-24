/**
 * =============================================================================
 * SUPABASE CLIENT CONFIGURATION & DATABASE ACCESS LAYER
 * =============================================================================
 * All data is sourced exclusively from Supabase Cloud Database.
 * No local mock data or localStorage fallbacks.
 */

// ⚠️ SUPABASE CREDENTIALS ⚠️
const SUPABASE_URL = (window.ENV && window.ENV.SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || '';

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

// Initialize Supabase Client
if (isSupabaseConfigured() && window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Connected to Supabase Cloud Engine');
    } catch (err) {
        console.error('❌ Failed to initialize Supabase client:', err);
    }
} else {
    console.error('❌ Supabase URL/Key not configured. The application requires a valid Supabase connection.');
}

/**
 * =============================================================================
 * SUPABASE DATABASE ACCESS LAYER
 * =============================================================================
 * All CRUD operations go directly to the Supabase database.
 * This replaces the old MockStore localStorage engine.
 */
const SupabaseDB = {

    // ─── BRANCHES ────────────────────────────────────────────────────────
    async getBranches() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('branches')
                .select('*')
                .order('name');
            if (error) { console.error('getBranches error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getBranches exception:', err);
            return [];
        }
    },

    // ─── PROFILES / USERS ────────────────────────────────────────────────
    async getProfiles() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*, branches(name)')
                .order('created_at', { ascending: false });
            if (error) { console.error('getProfiles error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getProfiles exception:', err);
            return [];
        }
    },

    // ─── CUSTOMERS ───────────────────────────────────────────────────────
    async getCustomers() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .order('full_name');
            if (error) { console.error('getCustomers error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getCustomers exception:', err);
            return [];
        }
    },

    async addCustomer(customerData) {
        if (!supabaseClient) return null;
        try {
            const newCustomer = {
                id: 'cust-' + Date.now(),
                ...customerData
            };
            const { data, error } = await supabaseClient
                .from('customers')
                .insert([newCustomer])
                .select()
                .single();
            if (error) { console.error('addCustomer error:', error.message); return null; }
            return data;
        } catch (err) {
            console.error('addCustomer exception:', err);
            return null;
        }
    },

    // ─── PRESCRIPTIONS ───────────────────────────────────────────────────
    async getPrescriptions() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('prescriptions')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) { console.error('getPrescriptions error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getPrescriptions exception:', err);
            return [];
        }
    },

    async addPrescription(prescriptionData) {
        if (!supabaseClient) return null;
        try {
            const newPrescription = {
                id: 'rx-' + Date.now(),
                ...prescriptionData
            };
            const { data, error } = await supabaseClient
                .from('prescriptions')
                .insert([newPrescription])
                .select()
                .single();
            if (error) { console.error('addPrescription error:', error.message); return null; }
            return data;
        } catch (err) {
            console.error('addPrescription exception:', err);
            return null;
        }
    },

    // ─── PRODUCTS ────────────────────────────────────────────────────────
    async getProducts(branchId = null) {
        if (!supabaseClient) return [];
        try {
            let query = supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (branchId) {
                query = query.eq('branch_id', branchId);
            }
            const { data, error } = await query;
            if (error) { console.error('getProducts error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getProducts exception:', err);
            return [];
        }
    },

    // ─── ORDERS ──────────────────────────────────────────────────────────
    async getOrders(branchId = null) {
        if (!supabaseClient) return [];
        try {
            let query = supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            if (branchId) {
                query = query.eq('branch_id', branchId);
            }
            const { data, error } = await query;
            if (error) { console.error('getOrders error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getOrders exception:', err);
            return [];
        }
    },

    // ─── ORDER ITEMS ─────────────────────────────────────────────────────
    async getOrderItems(orderId = null) {
        if (!supabaseClient) return [];
        try {
            let query = supabaseClient
                .from('order_items')
                .select('*');
            if (orderId) {
                query = query.eq('order_id', orderId);
            }
            const { data, error } = await query;
            if (error) { console.error('getOrderItems error:', error.message); return []; }
            return data || [];
        } catch (err) {
            console.error('getOrderItems exception:', err);
            return [];
        }
    },

    // ─── SAVE ORDER (Insert order + order items) ─────────────────────────
    async saveOrder(orderData, orderItemsData) {
        if (!supabaseClient) return null;
        try {
            const newOrder = {
                id: 'ord-' + Date.now(),
                order_number: 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
                ...orderData
            };

            const { data: savedOrder, error: orderErr } = await supabaseClient
                .from('orders')
                .insert([newOrder])
                .select()
                .single();

            if (orderErr) {
                console.error('saveOrder error:', orderErr.message);
                return null;
            }

            // Insert order items
            const itemsToInsert = orderItemsData.map(item => ({
                id: 'item-' + Math.random().toString(36).substr(2, 9),
                order_id: savedOrder.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity
            }));

            const { error: itemsErr } = await supabaseClient
                .from('order_items')
                .insert(itemsToInsert);

            if (itemsErr) {
                console.error('saveOrder items error:', itemsErr.message);
            }

            return { order: savedOrder, items: itemsToInsert };
        } catch (err) {
            console.error('saveOrder exception:', err);
            return null;
        }
    }
};

window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.SupabaseDB = SupabaseDB;
