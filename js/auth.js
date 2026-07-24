/**
 * =============================================================================
 * AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) CONTROLLER
 * =============================================================================
 * All authentication is handled exclusively through Supabase.
 */

const AuthManager = {
    SESSION_KEY: 'optical_pos_session',

    /**
     * Get active logged in user profile from storage
     */
    getCurrentUser() {
        const sessionData = localStorage.getItem(this.SESSION_KEY);
        if (!sessionData) return null;
        try {
            return JSON.parse(sessionData);
        } catch (e) {
            console.error('Invalid session format', e);
            return null;
        }
    },

    /**
     * Get active selected branch ID (for superadmin switching or assigned branch)
     */
    getActiveBranchId() {
        const user = this.getCurrentUser();
        if (!user) return null;

        // Superadmin can have a custom selected branch stored in session or localStorage
        if (user.role === 'superadmin') {
            const selectedBranch = localStorage.getItem('optical_pos_selected_branch_id');
            return selectedBranch || user.branch_id;
        }

        return user.branch_id;
    },

    /**
     * Set active branch ID (Superadmin only)
     */
    setActiveBranchId(branchId) {
        const user = this.getCurrentUser();
        if (user && user.role === 'superadmin') {
            localStorage.setItem('optical_pos_selected_branch_id', branchId);
            window.location.reload();
        }
    },

    /**
     * Authenticate user with Supabase
     */
    async login(email, password) {
        if (!isSupabaseConfigured() || !window.supabaseClient) {
            return { success: false, message: 'Supabase is not configured. Please set up your database connection.' };
        }

        try {
            // 1. Try Supabase Auth Engine first
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (!error && data.user) {
                const { data: profile } = await window.supabaseClient
                    .from('profiles')
                    .select('*, branches(*)')
                    .eq('id', data.user.id)
                    .single();

                if (profile) {
                    const sessionUser = {
                        id: profile.id,
                        email: profile.email,
                        full_name: profile.full_name,
                        role: profile.role,
                        branch_id: profile.branch_id,
                        branch_name: profile.branches ? profile.branches.name : 'All Branches'
                    };
                    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
                    return { success: true, user: sessionUser };
                }
            }

            // 2. Direct profiles table query check (for custom auth)
            const { data: tableProfile, error: profileErr } = await window.supabaseClient
                .from('profiles')
                .select('*, branches(*)')
                .eq('email', email)
                .eq('password', password)
                .single();

            if (!profileErr && tableProfile) {
                const sessionUser = {
                    id: tableProfile.id,
                    email: tableProfile.email,
                    full_name: tableProfile.full_name,
                    role: tableProfile.role,
                    branch_id: tableProfile.branch_id,
                    branch_name: tableProfile.branches ? tableProfile.branches.name : 'Main Store'
                };
                localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
                return { success: true, user: sessionUser };
            }
        } catch (err) {
            console.warn('Supabase authentication error:', err);
        }

        return { success: false, message: 'Invalid email or password. Please check your credentials.' };
    },

    /**
     * Terminate user session and clear storage
     */
    async logout() {
        if (isSupabaseConfigured() && window.supabaseClient) {
            try {
                await window.supabaseClient.auth.signOut();
            } catch (e) {
                console.warn('Supabase logout error:', e);
            }
        }
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem('optical_pos_selected_branch_id');
        window.location.href = 'login.html';
    },

    /**
     * Enforce authentication on index page
     */
    requireAuth() {
        const user = this.getCurrentUser();
        if (!user && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    },

    /**
     * Fetch branches dynamically from Supabase
     */
    async getBranchesAsync() {
        if (isSupabaseConfigured() && window.supabaseClient) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('branches')
                    .select('*')
                    .order('name');
                if (!error && data && data.length > 0) {
                    return data;
                }
            } catch (err) {
                console.warn('Failed to fetch branches from Supabase:', err);
            }
        }
        return [];
    },

    /**
     * Apply Role-Based Access Control (RBAC) to UI elements
     */
    async applyRBAC() {
        const user = this.getCurrentUser();
        if (!user) return;

        // Render User Profile Badge in Top Nav
        const userNameEl = document.getElementById('nav-user-name');
        const userRoleEl = document.getElementById('nav-user-role');
        const navBranchSelector = document.getElementById('nav-branch-selector');
        const navBranchDisplay = document.getElementById('nav-branch-display');
        const navReportsLink = document.getElementById('nav-reports');

        if (userNameEl) userNameEl.textContent = user.full_name;
        if (userRoleEl) {
            userRoleEl.textContent = user.role.toUpperCase();
            userRoleEl.className = `px-2 py-0.5 text-xs font-semibold rounded-full ${
                user.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
            }`;
        }

        // Fetch live branches from Supabase
        const branches = await this.getBranchesAsync();
        const activeBranchId = this.getActiveBranchId();

        if (user.role === 'superadmin') {
            // Show Branch Selector dropdown for Superadmin
            if (navBranchSelector) {
                navBranchSelector.classList.remove('hidden');
                navBranchSelector.innerHTML = branches.map(b => 
                    `<option value="${b.id}" ${b.id === activeBranchId ? 'selected' : ''}>📍 ${b.name}</option>`
                ).join('');

                navBranchSelector.onchange = (e) => {
                    this.setActiveBranchId(e.target.value);
                };
            }
            if (navBranchDisplay) navBranchDisplay.classList.add('hidden');
        } else {
            // Hide Selector, show static branch name for Admin and Cashier
            if (navBranchSelector) navBranchSelector.classList.add('hidden');
            if (navBranchDisplay) {
                navBranchDisplay.classList.remove('hidden');
                const matchedBranch = branches.find(b => b.id === activeBranchId);
                navBranchDisplay.textContent = matchedBranch ? `📍 ${matchedBranch.name}` : `📍 ${user.branch_name}`;
            }
        }

        const navBranchesLink = document.getElementById('nav-branches');
        const navUsersLink = document.getElementById('nav-users');
        const navInventoryLink = document.getElementById('nav-inventory');

        // Inventory Management Link (Superadmin & Branch Admin)
        if (user.role === 'superadmin' || user.role === 'admin') {
            if (navInventoryLink) {
                navInventoryLink.classList.remove('hidden');
                navInventoryLink.style.display = 'flex';
            }
        } else {
            if (navInventoryLink) {
                navInventoryLink.classList.add('hidden');
                navInventoryLink.style.display = 'none';
            }
        }

        // Superadmin Navigation Links (Branches & Users)
        if (user.role === 'superadmin') {
            if (navBranchesLink) {
                navBranchesLink.classList.remove('hidden');
                navBranchesLink.style.display = 'flex';
            }
            if (navUsersLink) {
                navUsersLink.classList.remove('hidden');
                navUsersLink.style.display = 'flex';
            }
        } else {
            if (navBranchesLink) {
                navBranchesLink.classList.add('hidden');
                navBranchesLink.style.display = 'none';
            }
            if (navUsersLink) {
                navUsersLink.classList.add('hidden');
                navUsersLink.style.display = 'none';
            }
        }

        // Strict Cashier Blocking for Sales Reports Tab
        if (user.role === 'cashier') {
            if (navReportsLink) {
                navReportsLink.classList.add('hidden');
                navReportsLink.style.display = 'none';
            }
            // If cashier tries to load reports view via hash or DOM, redirect to POS
            const reportsSection = document.getElementById('view-reports');
            if (reportsSection && !reportsSection.classList.contains('hidden')) {
                if (typeof window.switchTab === 'function') {
                    window.switchTab('pos');
                }
            }
        } else {
            if (navReportsLink) {
                navReportsLink.classList.remove('hidden');
                navReportsLink.style.display = 'flex';
            }
        }
    }
};

window.AuthManager = AuthManager;
