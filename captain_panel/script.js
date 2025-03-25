let currentSection = 'all';
let allDishes = [];
let selectedDishes = new Map();
let selectedTableId = null;
let tablesData = [];
let activeOrders = [];
let menuActive = false;
let selectedOrderId = null;
let searchTerm = ''; // Track the current search term
const categoryIcons = {
    'all': 'fas fa-th-list',
    'punjabi specials': 'fas fa-fire',
    'gujarati delights': 'fas fa-leaf',
    'south indian': 'fas fa-pepper-hot',
    'chinese': 'fas fa-dragon',
    'desserts': 'fas fa-ice-cream',
    'default': 'fas fa-utensils'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOMContentLoaded: Starting initialization');
        
        await loadDishes();
        console.log('Dishes loaded');
        
        setupSectionTabs();
        console.log('Section tabs set up');
        
        await loadTables();
        console.log('Tables loaded');
        
        await loadActiveOrders();
        console.log('Active orders loaded:', activeOrders);
        
        
        updateActiveOrdersList();
        console.log('Active orders list updated');
        
        populateExistingOrders();
        console.log('Existing orders populated');
        
        setupMenuHandlers();
        console.log('Menu handlers set up');

        setupSearchBar(); // Add this line to set up the search bar
        console.log('Search bar set up');
        
        
        setupAutoRefresh();
        console.log('Auto-refresh set up');

        if (loadingOverlay) loadingOverlay.classList.add('hidden');

        // Start SSE for real-time updates
        startRealtimeUpdatesWithSSE();

        

        document.getElementById('copyOrderId')?.addEventListener('click', async () => {
            const orderIdText = document.getElementById('orderIdText')?.textContent || '';
            try {
                await navigator.clipboard.writeText(orderIdText);
                const copyBtn = document.getElementById('copyOrderId');
                if (copyBtn) {
                    copyBtn.classList.add('success');
                    setTimeout(() => copyBtn.classList.remove('success'), 1000);
                }
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });

        window.addEventListener('click', (e) => {
            const confirmModal = document.getElementById('confirmationModal');
            if (confirmModal && e.target === confirmModal) confirmModal.style.display = 'none';
        });

        document.getElementById('closeModal')?.addEventListener('click', () => {
            const successModal = document.getElementById('successModal');
            if (successModal) {
                successModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('successModal');
            if (modal && e.target === modal) modal.style.display = 'none';
        });

        document.getElementById('activeOrdersBtn')?.addEventListener('click', showActiveOrdersModal);

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', e => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    hideActiveOrdersModal();
                }
            });
        });

        document.querySelectorAll('.status-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTabStatus = tab.getAttribute('data-status');
                updateActiveOrdersList(currentTabStatus);
            });
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('activeOrdersModal');
            if (modal && e.target === modal) {
                hideActiveOrdersModal();
            }
        });

        startOrderPolling();
        console.log('Order polling started');
        
        document.getElementById('existing_order_select')?.addEventListener('change', handleOrderSelection);
    } catch (error) {
        console.error('Error during initialization:', error);
        showToast('Error initializing application: ' + error.message, 'error');
    }
});

function setupMenuHandlers() {
    const menuTrigger = document.querySelector('.menu-trigger');
    const menuItems = document.querySelector('.menu-items');
    if (!menuTrigger || !menuItems) {
        console.error('Menu elements not found');
        return;
    }

    let timeoutId;
    function showMenu() {
        menuItems.classList.add('active');
        menuActive = true;
        if (timeoutId) clearTimeout(timeoutId);
    }
    function hideMenu() {
        menuItems.classList.remove('active');
        menuActive = false;
    }

    menuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menuActive) hideMenu();
        else showMenu();
    });

    menuItems.addEventListener('mouseenter', () => { if (timeoutId) clearTimeout(timeoutId); });
    menuItems.addEventListener('mouseleave', () => { timeoutId = setTimeout(hideMenu, 1000); });
    document.addEventListener('click', (e) => {
        if (!menuItems.contains(e.target) && !menuTrigger.contains(e.target)) hideMenu();
    });
}

function populateExistingOrders() {
    const orderSelect = document.getElementById('existing_order_select');
    const currentValue = orderSelect?.value || '';
    if (!orderSelect) {
        console.error('orderSelect element not found');
        return;
    }
    orderSelect.innerHTML = '<option value="">-- New Order --</option>';
    activeOrders.forEach(order => {
        if (order.status !== 'completed' && order.status !== 'bill_generated') {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `Order #${order.id} - Table ${order.table_number} (${order.customer_name})`;
            orderSelect.appendChild(option);
        }
    });
    if (selectedOrderId && activeOrders.some(o => o.id == selectedOrderId && o.status !== 'completed' && o.status !== 'bill_generated')) {
        orderSelect.value = selectedOrderId;
    } else {
        orderSelect.value = currentValue || '';
    }
    handleOrderSelection();
}

function handleOrderSelection() {
    const orderId = document.getElementById('existing_order_select')?.value || '';
    const customerDetailsSection = document.getElementById('customerDetailsSection');
    const paymentSection = document.getElementById('paymentSection');
    const existingOrderDetails = document.getElementById('existingOrderDetails');
    const existingItemsList = document.getElementById('existingItemsList');
    const tableInput = document.getElementById('selected_table_id');
    const submitBtn = document.querySelector('.submit-btn');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const paymentSelect = document.getElementById('payment_method');

    if (!customerDetailsSection || !paymentSection || !existingOrderDetails || !existingItemsList || !tableInput || !submitBtn || !nameInput || !phoneInput || !paymentSelect) {
        console.error('One or more DOM elements not found');
        return;
    }

    if (orderId) {
        const order = activeOrders.find(o => o.id == orderId);
        if (order) {
            customerDetailsSection.style.display = 'none';
            paymentSection.style.display = 'none';
            existingOrderDetails.style.display = 'block';
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Update Order';
            submitBtn.classList.add('update-state');

            nameInput.removeAttribute('required');
            phoneInput.removeAttribute('required');
            paymentSelect.removeAttribute('required');

            const categoryMap = new Map();
            order.dishes.forEach(dish => {
                const category = dish.category_name || 'Uncategorized';
                if (!categoryMap.has(category)) {
                    categoryMap.set(category, []);
                }
                categoryMap.get(category).push(dish);
            });

            const categoryDishes = new Map();
            categoryMap.forEach((dishes, category) => {
                const dishMap = new Map();
                dishes.forEach(dish => {
                    const key = dish.name;
                    if (!dishMap.has(key)) {
                        dishMap.set(key, { totalQuantity: 0, prepared: 0, new: 0 });
                    }
                    const agg = dishMap.get(key);
                    agg.totalQuantity += dish.quantity;
                    if (dish.preparation_status === 'prepared' && !dish.is_new) agg.prepared += dish.quantity;
                    if (dish.is_new) agg.new += dish.quantity;
                });
                categoryDishes.set(category, dishMap);
            });

            existingItemsList.innerHTML = Array.from(categoryDishes.entries()).map(([category, dishMap]) => `
                <div class="order-category">
                    <div class="category-header">
                        <h4>${category}</h4>
                    </div>
                    <div class="category-items">
                        ${Array.from(dishMap.entries()).map(([name, agg]) => `
                            <div class="order-item">
                                <div class="item-details">
                                    <span class="item-name">${name} (${agg.totalQuantity})</span>
                                    ${agg.new > 0 ? `<span class="new-badge">New</span>` : ''}
                                    ${agg.prepared > 0 && agg.new > 0 ? 
                                        `<span class="status-info"> - ${agg.prepared}x prepared, ${agg.new}x new</span>` :
                                        (agg.prepared === agg.totalQuantity ? '<span class="status-info"> - All prepared</span>' :
                                        (agg.new === agg.totalQuantity ? '' : ''))}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            tableInput.value = order.restaurant_table_id || '';
        } else {
            console.error('Order not found:', orderId);
            existingOrderDetails.style.display = 'none';
            existingItemsList.innerHTML = '<p>Order not found.</p>';
        }
    } else {
        customerDetailsSection.style.display = 'block';
        paymentSection.style.display = 'block';
        existingOrderDetails.style.display = 'none';
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Place Order';
        submitBtn.classList.remove('update-state');

        nameInput.setAttribute('required', '');
        phoneInput.setAttribute('required', '');
        paymentSelect.setAttribute('required', '');
        tableInput.value = '';
        existingItemsList.innerHTML = '';
    }
}

function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    } else {
        console.warn('loadingOverlay element not found');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    } else {
        console.warn('loadingOverlay element not found');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function loadActiveOrders() {
    try {
        showLoading();
        const response = await fetch('../process/get_active_orders.php');
        const result = await response.json();
        if (result.success) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            activeOrders = result.data.filter(order => {
                const orderDate = new Date(order.created_at);
                orderDate.setHours(0, 0, 0, 0);
                return orderDate.getTime() === today.getTime();
            });

            updateActiveOrdersList();
            updateActiveOrdersBadge(); // This call will now use the filtered count
            populateExistingOrders();
        } else {
            throw new Error(result.error || 'Failed to load active orders');
        }
    } catch (error) {
        console.error('Error loading active orders:', error);
        updateActiveOrdersList([]);
        updateActiveOrdersBadge(); // Ensure badge updates on error
        showToast('Error loading active orders: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
function formatOrderedDishes(orderedDishes) {
    if (!orderedDishes) return 'No dishes';
    const dishList = orderedDishes.split(', ');
    const totalItems = dishList.length;
    return `
        <div class="order-info">
            <div class="order-summary">
                <div class="total-items" role="status" aria-label="Total items: ${totalItems}">
                    <i class="fas fa-shopping-basket"></i>
                    ${totalItems} items
                </div>
            </div>
            <div class="dishes-list">
                ${dishList.map(dish => `
                    <div class="dish-item">
                        <span class="dish-name">${dish}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function updateActiveOrdersList(status = 'all') {
    const ordersList = document.getElementById('activeOrdersList');
    if (!ordersList) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysOrders = activeOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
    });

    let filteredOrders = [];
    switch (status.toLowerCase()) {
        case 'all':
            filteredOrders = todaysOrders.filter(order => 
                ['processing', 'food_prepared', 'completed'].includes(order.status)
            );
            break;
        case 'processing':
            filteredOrders = todaysOrders.filter(order => order.status === 'processing');
            break;
        case 'food_prepared':
            filteredOrders = todaysOrders.filter(order => order.status === 'food_prepared');
            break;
        case 'completed':
            filteredOrders = todaysOrders.filter(order => order.status === 'completed');
            break;
        case 'bill_generated':
            filteredOrders = todaysOrders.filter(order => order.status === 'bill_generated');
            break;
        default:
            filteredOrders = todaysOrders.filter(order => 
                ['processing', 'food_prepared', 'completed'].includes(order.status)
            );
    }

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>No active orders found</p>
            </div>
        `;
        return;
    }

    ordersList.innerHTML = filteredOrders.map(order => {
        const categoryMap = new Map();
        order.dishes.forEach(dish => {
            console.log('Dish debug:', dish); // Debug category_name
            const category = dish.category_name || 'Uncategorized';
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(dish);
        });

        const categoryDishes = new Map();
        categoryMap.forEach((dishes, category) => {
            const dishMap = new Map();
            dishes.forEach(dish => {
                const key = dish.name;
                if (!dishMap.has(key)) {
                    dishMap.set(key, { totalQuantity: 0, prepared: 0, new: 0 });
                }
                const agg = dishMap.get(key);
                agg.totalQuantity += dish.quantity;
                if (dish.preparation_status === 'prepared' && !dish.is_new) agg.prepared += dish.quantity;
                if (dish.is_new) agg.new += dish.quantity;
            });
            categoryDishes.set(category, dishMap);
        });

        return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <span class="order-id">Order #${order.id}</span>
                    <span class="order-status status-${order.status}">${formatStatus(order.status)}</span>
                </div>
                <div class="order-progress">
                    ${renderOrderProgress(order.status)}
                </div>
                <div class="order-details">
                    <div>Table ${order.table_number} • ${order.customer_name}</div>
                    <div class="order-items">
                        ${Array.from(categoryDishes.entries()).map(([category, dishMap]) => `
                            <div class="order-category">
                                <div class="category-header">
                                    <h4>${category}</h4>
                                </div>
                                <div class="category-items">
                                    ${Array.from(dishMap.entries()).map(([name, agg]) => `
                                        <div class="order-item">
                                            <div class="item-details">
                                                <span class="item-name">${name} (${agg.totalQuantity})</span>
                                                ${agg.new > 0 ? `<span class="new-badge">New</span>` : ''}
                                                ${agg.prepared > 0 && agg.new > 0 ? 
                                                    `<span class="status-info"> - ${agg.prepared}x prepared, ${agg.new}x new</span>` :
                                                    (agg.prepared === agg.totalQuantity ? '<span class="status-info"> - All prepared</span>' :
                                                    (agg.new === agg.totalQuantity ? '' : ''))}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="order-footer">
                    <span class="order-total">Total Amount: ₹${parseFloat(order.total_amount).toFixed(2)}</span>
                    <span class="order-time">${formatTimeAgo(order.created_at)}</span>
                </div>
                
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function formatStatus(status) {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function renderOrderProgress(status) {
    const steps = ['pending', 'processing', 'food_prepared', 'completed', 'bill_generated'];
    const currentIndex = steps.indexOf(status);
    return steps.map((step, index) => `
        <div class="progress-step ${index <= currentIndex ? 'completed' : ''}">
            <div class="progress-marker">
                <i class="fas ${getStepIcon(step)}"></i>
            </div>
            <div class="progress-label">${formatStatus(step)}</div>
        </div>
    `).join('');
}

function getStepIcon(step) {
    switch (step) {
        case 'pending': return 'fa-clock';
        case 'processing': return 'fa-utensils';
        case 'food_prepared': return 'fa-check-circle';
        case 'completed': return 'fa-flag-checkered';
        case 'bill_generated': return 'fa-file-invoice-dollar';
        default: return 'fa-circle';
    }
}



function updateActiveOrdersBadge() {
    const badge = document.getElementById('activeOrdersBadge');
    if (badge) {
        // Filter out orders with status 'completed' or 'bill_generated'
        const activeOrderCount = activeOrders.filter(order => 
            order.status !== 'completed' && order.status !== 'bill_generated'
        ).length;
        badge.textContent = activeOrderCount;
        badge.style.display = activeOrderCount > 0 ? 'inline' : 'none';
    }
}
function hideActiveOrdersModal() {
    const modal = document.getElementById('activeOrdersModal');
    if (modal) {
        activeOrdersModalOpen = false; // Reset modal open state
        modal.classList.remove('active');
    }
}

function showActiveOrdersModal() {
    const modal = document.getElementById('activeOrdersModal');
    if (modal) {
        activeOrdersModalOpen = true; // Set modal open state
        currentTabStatus = 'all'; // Reset to default when opening the modal
        updateActiveOrdersList(currentTabStatus);
        modal.classList.add('active');
    }
}

function filterActiveOrders(status) {
    updateActiveOrdersList(status);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let tablePollingInterval;

async function loadTables() {
    try {
        const response = await fetch('../process/get_tables.php');
        const data = await response.json();
        if (data.success) {
            tablesData = data.data;
            renderTables();
            console.log('loadTables: Tables updated =', tablesData);
            if (!tablePollingInterval) {
                tablePollingInterval = setInterval(() => loadTables(), 30000);
            }
        } else {
            console.error('loadTables: Failed to load tables:', data.error);
            showToast('Failed to load tables: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error loading tables:', error);
        showToast('Error loading tables: ' + error.message, 'error');
    }
}

function renderTables() {
    const tablesGrid = document.getElementById('tablesGrid');
    if (!tablesGrid) return;

    tablesGrid.innerHTML = tablesData.map(table => `
        <div class="table-card ${table.status} ${selectedTableId === table.id ? 'selected' : ''}"
             data-table-id="${table.id}"
             onclick="selectTable(${table.id})"
             ${table.status !== 'free' ? 'title="Table not available"' : ''}>
            <div class="table-status ${table.status}"></div>
            <div class="table-number">Table ${table.table_number}</div>
            <div class="table-capacity"><i class="fas fa-users"></i> ${table.capacity}</div>
            ${table.current_customer ? `<div class="table-customer"><small>${table.current_customer}</small></div>` : ''}
        </div>
    `).join('');
    updateSelectedTableInfo();
}

function selectTable(tableId) {
    const table = tablesData.find(t => t.id === tableId);
    if (!table || table.status !== 'free') return;

    selectedTableId = tableId;
    document.getElementById('selected_table_id').value = tableId;
    document.querySelectorAll('.table-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.tableId == tableId);
    });
    updateSelectedTableInfo();
}

function updateSelectedTableInfo() {
    const infoDiv = document.getElementById('selectedTableInfo');
    const table = tablesData.find(t => t.id === selectedTableId);
    if (!table) {
        if (infoDiv) infoDiv.classList.remove('visible');
        return;
    }

    if (infoDiv) {
        infoDiv.innerHTML = `
            <div class="selected-table-details">
                <strong>Selected:</strong> Table ${table.table_number}
                <br>
                <small>Capacity: ${table.capacity} people</small>
            </div>
        `;
        infoDiv.classList.add('visible');
    }
}

function setupSectionTabs() {
    const tabs = document.querySelectorAll('.section-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSection = tab.dataset.section;
            filterDishes(currentSection);
        });
    });
}

function restoreSelectedStates() {
    selectedDishes.forEach((details, dishId) => {
        const checkbox = document.querySelector(`.dish-checkbox[data-id="${dishId}"]`);
        if (checkbox) {
            checkbox.checked = true;
            const quantityWrapper = checkbox.closest('.dish-item').querySelector('.quantity-wrapper');
            const quantityInput = quantityWrapper.querySelector('.quantity-input');
            const minusBtn = quantityWrapper.querySelector('.minus-btn');
            if (quantityWrapper) quantityWrapper.style.display = 'block';
            if (quantityInput) quantityInput.value = details.quantity;
            if (minusBtn) minusBtn.disabled = details.quantity <= 1;
        }
    });
    updateTotal();
}
function setupAutoRefresh() {
    // Existing refresh for active orders modal
    setInterval(() => {
        if (activeOrdersModalOpen) {
            updateActiveOrdersList(currentTabStatus);
        }
    }, 5000);

    // New refresh for other key functions
    setInterval(async () => {
        try {
            console.log('Auto-refresh: Refreshing key data...');
            showLoading(); // Show loading overlay

            await loadDishes();
            console.log('Auto-refresh: Dishes reloaded');

            await loadTables();
            console.log('Auto-refresh: Tables reloaded');

            populateExistingOrders();
            console.log('Auto-refresh: Existing orders dropdown updated');

            filterDishes(currentSection);
        } catch (error) {
            console.error('Auto-refresh error:', error);
            showToast('Error during auto-refresh: ' + error.message, 'error');
        } finally {
            hideLoading(); // Hide loading overlay
        }
    }, 60000);
}
function filterDishes(section) {
    const dishesSection = document.getElementById('dishes');
    if (!dishesSection) {
        console.error('filterDishes: Element with id "dishes" not found in the DOM.');
        return;
    }

    // Remove any existing spinner to avoid duplicates
    let existingSpinner = dishesSection.querySelector('.loading-spinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }

    // Create and show new spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Loading menu...</p>';
    dishesSection.appendChild(spinner);
    spinner.style.display = 'flex';

    // Perform filtering and rendering
    setTimeout(() => {
        // Filter dishes by section
        let filteredCategories = [];
        if (section === 'all') {
            filteredCategories = allDishes;
        } else {
            const categoryDishes = allDishes.find(cat =>
                cat.category_name.toLowerCase().replace(/\s+/g, '-') === section);
            if (categoryDishes) filteredCategories = [categoryDishes];
        }

        // Apply search filter if searchTerm exists
        if (searchTerm) {
            filteredCategories = filteredCategories.map(category => {
                return {
                    ...category,
                    dishes: category.dishes.filter(dish =>
                        dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (dish.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
                    )
                };
            }).filter(category => category.dishes.length > 0);
        }

        // Clear content and render
        dishesSection.innerHTML = ''; // Clear all content, including old spinner
        if (filteredCategories.length === 0) {
            dishesSection.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No dishes found</p></div>';
        } else {
            filteredCategories.forEach(category => displayCategoryDishes(category, dishesSection));
        }

        // Hide spinner after rendering (no need to check, as it was just added)
        spinner.style.display = 'none';

        restoreSelectedStates();
    }, 15);
}
function setupSearchBar() {
    const dishSearch = document.getElementById('dishSearch');
    const clearSearch = document.getElementById('clearSearch');

    if (!dishSearch || !clearSearch) {
        console.error('Search bar elements not found');
        return;
    }

    // Debounced search input event
    const debouncedSearch = debounce((e) => {
        searchTerm = e.target.value.trim();
        clearSearch.classList.toggle('hidden', !searchTerm);
        filterDishes(currentSection);
    }, 300);

    dishSearch.addEventListener('input', debouncedSearch);

    // Clear search button
    clearSearch.addEventListener('click', () => {
        dishSearch.value = '';
        searchTerm = '';
        clearSearch.classList.add('hidden');
        filterDishes(currentSection);
    });
}
function displayCategoryDishes(category, container) {
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'category-container';
    categoryContainer.innerHTML = `
        <div class="category-header">
            <h3>${category.category_name}</h3>
            ${category.category_description ? `<p>${category.category_description}</p>` : ''}
        </div>
        <div class="dishes-row"></div>
    `;
    const dishesRow = categoryContainer.querySelector('.dishes-row');
    category.dishes.forEach(dish => displayDish(dish, dishesRow));
    container.appendChild(categoryContainer);
    addScrollIndicator(dishesRow);
}

function addScrollIndicator(dishesRow) {
    const indicator = document.createElement('div');
    indicator.className = 'dishes-scroll-indicator';
    indicator.innerHTML = `
        <i class="fas fa-angle-double-right"></i>
        <span>Swipe for more</span>
    `;
    const showIndicator = () => {
        if (dishesRow.scrollWidth > dishesRow.clientWidth) {
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 3000);
        }
    };
    setTimeout(showIndicator, 500);
    let scrollTimeout;
    dishesRow.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(showIndicator, 1000);
    });
    dishesRow.appendChild(indicator);
}
function displayDish(dish, container) {
    const dishDiv = document.createElement('div');
    dishDiv.className = 'dish-item lazy-load-container';
    dishDiv.innerHTML = `
        <div class="dish-content">
            <div class="dish-image-container">
                <div class="dish-image-wrapper">
                    <div class="dish-image-placeholder"></div>
                    <div class="loading-indicator"></div>
                    <img class="dish-image" data-src="${dish.image_url || '/api/placeholder/300/200'}" alt="${dish.name}"
                        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
                </div>
            </div>
            <div class="dish-info">
                <div class="dish-header">
                    <input type="checkbox" class="dish-checkbox" data-id="${dish.id}" data-price="${dish.price}">
                    <div class="dish-details">
                        <span class="dish-name">${dish.name}</span>
                        ${dish.description ? `<span class="dish-description">${dish.description}</span>` : ''}
                        <span class="dish-price">${parseFloat(dish.price).toFixed(2)}</span>
                    </div>
                </div>
                <div class="quantity-wrapper" style="display: none;">
                    <div class="quantity-controls">
                        <button type="button" class="quantity-btn minus-btn" disabled><i class="fas fa-minus"></i></button>
                        <input type="number" class="quantity-input" value="1" min="1" max="10">
                        <button type="button" class="quantity-btn plus-btn"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(dishDiv);

    const imageContainer = dishDiv.querySelector('.dish-image-container');
    imageObserver.observe(imageContainer);

    const dishObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                dishDiv.classList.add('visible');
                dishObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    dishObserver.observe(dishDiv);

    // Notify when image is loaded
    const img = dishDiv.querySelector('.dish-image');
    if (img) {
        img.addEventListener('load', () => {
            if (container.querySelectorAll('.dish-image:not(.loaded)').length === 0) {
                const spinner = document.getElementById('dishes')?.querySelector('.loading-spinner');
                if (spinner) spinner.style.display = 'none';
            }
        });
        img.addEventListener('error', () => {
            if (container.querySelectorAll('.dish-image:not(.loaded)').length === 0) {
                const spinner = document.getElementById('dishes')?.querySelector('.loading-spinner');
                if (spinner) spinner.style.display = 'none';
            }
        });
    }

    setupDishEventListeners(dishDiv);
}

function setupDishEventListeners(dishDiv) {
    const checkbox = dishDiv.querySelector('.dish-checkbox');
    const quantityWrapper = dishDiv.querySelector('.quantity-wrapper');
    const quantityInput = dishDiv.querySelector('.quantity-input');
    const minusBtn = dishDiv.querySelector('.minus-btn');
    const plusBtn = dishDiv.querySelector('.plus-btn');
    const dishName = dishDiv.querySelector('.dish-name').textContent;
    const dishId = checkbox.dataset.id;
    const dishPrice = parseFloat(checkbox.dataset.price);
    const categoryHeader = dishDiv.closest('.category-container')?.querySelector('.category-header h3');
    const categoryName = categoryHeader ? categoryHeader.textContent.trim() : 'Other';

    checkbox.addEventListener('change', function() {
        if (this.checked) {
            if (quantityWrapper) quantityWrapper.style.display = 'block';
            selectedDishes.set(dishId, {
                quantity: parseInt(quantityInput?.value) || 1,
                price: dishPrice,
                name: dishName,
                category: categoryName
            });
            dishDiv.classList.add('selected');
        } else {
            if (quantityWrapper) quantityWrapper.style.display = 'none';
            selectedDishes.delete(dishId);
            dishDiv.classList.remove('selected');
        }
        updateTotal();
    });

    quantityInput?.addEventListener('change', function() {
        let value = parseInt(this.value);
        if (isNaN(value) || value < 1) value = 1;
        if (value > 10) value = 10;
        this.value = value;
        if (minusBtn) minusBtn.disabled = value <= 1;
        if (plusBtn) plusBtn.disabled = value >= 10;
        if (selectedDishes.has(dishId)) {
            const dishDetails = selectedDishes.get(dishId);
            dishDetails.quantity = value;
            selectedDishes.set(dishId, dishDetails);
            updateTotal();
        }
    });

    minusBtn?.addEventListener('click', function() {
        if (quantityInput && quantityInput.value > 1) {
            quantityInput.value--;
            quantityInput.dispatchEvent(new Event('change'));
        }
    });

    plusBtn?.addEventListener('click', function() {
        if (quantityInput && quantityInput.value < 10) {
            quantityInput.value++;
            quantityInput.dispatchEvent(new Event('change'));
        }
    });

    if (selectedDishes.has(dishId)) {
        if (checkbox) checkbox.checked = true;
        if (quantityWrapper) quantityWrapper.style.display = 'block';
        if (quantityInput) quantityInput.value = selectedDishes.get(dishId).quantity;
        if (minusBtn) minusBtn.disabled = quantityInput?.value <= 1;
        dishDiv.classList.add('selected');
    }
}

function loadDishes() {
    fetch('../process/get_dishes.php')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                allDishes = result.data;
                console.log('loadDishes: allDishes updated =', allDishes);
                renderCategoryTabs();
                filterDishes(currentSection);
            } else {
                console.error('loadDishes: Failed to load dishes:', result.error);
                showToast('Failed to load dishes: ' + (result.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error loading dishes:', error);
            showToast('Error loading dishes: ' + error.message, 'error');
        });
}

function renderCategoryTabs() {
    const sectionTabs = document.getElementById('sectionTabs');
    if (!sectionTabs) {
        console.error('renderCategoryTabs: Element with id "sectionTabs" not found in the DOM.');
        return;
    }
    sectionTabs.innerHTML = `<button class="section-tab active" data-section="all"><i class="${categoryIcons['all']}"></i> All Dishes</button>`;
    
    allDishes.forEach(category => {
        const tab = document.createElement('button');
        tab.className = 'section-tab';
        tab.dataset.section = category.category_name.toLowerCase().replace(/\s+/g, '-');
        const iconClass = categoryIcons[category.category_name.toLowerCase()] || categoryIcons['default'];
        tab.innerHTML = `<i class="${iconClass}"></i> ${category.category_name}`;
        sectionTabs.appendChild(tab);
    });
    
    setupSectionTabs();
}

function updateTotal() {
    let total = 0;
    selectedDishes.forEach((details) => {
        total += details.price * details.quantity;
    });
    const totalValue = document.querySelector('.total-value');
    if (totalValue) totalValue.textContent = `₹${total.toFixed(2)}`;
}

function displayOrderConfirmation() {
    const groupedDishes = new Map();
    selectedDishes.forEach((details, id) => {
        if (!groupedDishes.has(details.category)) {
            groupedDishes.set(details.category, []);
        }
        groupedDishes.get(details.category).push({ id, ...details });
    });

    const itemsList = document.getElementById('confirmItems');
    if (itemsList) {
        itemsList.innerHTML = '';
        groupedDishes.forEach((dishes, category) => {
            const categoryTotal = dishes.reduce((sum, dish) => sum + (dish.price * dish.quantity), 0);
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';
            categorySection.innerHTML = `
                <div class="category-header">
                    <h4>${category}</h4>
                    <span class="category-total">₹${categoryTotal.toFixed(2)}</span>
                </div>
                <div class="category-items">
                    ${dishes.map(dish => `
                        <div class="order-item">
                            <div class="item-details">
                                <span class="item-name">${dish.name}</span>
                                <span class="item-quantity">Quantity: ${dish.quantity}</span>
                            </div>
                            <span class="item-price">₹${(dish.price * dish.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            itemsList.appendChild(categorySection);
        });
    }
}

document.getElementById('orderForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const orderId = document.getElementById('existing_order_select')?.value || '';
    const customerName = document.getElementById('name')?.value || '';
    const phoneNumber = document.getElementById('phone')?.value || '';
    const paymentMethod = document.getElementById('payment_method')?.value || '';

    if (selectedDishes.size === 0) {
        showToast('Please select at least one dish', 'error');
        return;
    }

    if (!orderId) {
        if (!selectedTableId) {
            showToast('Please select a table first', 'error');
            return;
        }
        if (!paymentMethod) {
            showToast('Please select a payment method', 'error');
            return;
        }
    }

    try {
        const orderData = {
            dishes: Array.from(selectedDishes.entries()).map(([dishId, details]) => ({
                dishId: parseInt(dishId),
                quantity: details.quantity,
                price: details.price
            })),
            totalAmount: parseFloat(document.querySelector('.total-value')?.textContent.replace('₹', '') || 0)
        };

        if (orderId) {
            orderData.orderId = orderId;
            orderData.status = 'processing';
        } else {
            orderData.tableId = selectedTableId;
            orderData.customerName = customerName;
            orderData.phoneNumber = phoneNumber;
            orderData.paymentMethod = paymentMethod;
            orderData.status = 'processing';
        }

        const confirmModal = document.getElementById('confirmationModal');
        if (confirmModal) {
            if (!orderId) {
                document.getElementById('confirmName').textContent = orderData.customerName;
                document.getElementById('confirmPhone').textContent = orderData.phoneNumber;
                document.getElementById('confirmPayment').textContent = 
                    orderData.paymentMethod.charAt(0).toUpperCase() + orderData.paymentMethod.slice(1);
                document.getElementById('confirmTable').textContent = 
                    tablesData.find(t => t.id === orderData.tableId)?.table_number;
            } else {
                const order = activeOrders.find(o => o.id == orderId);
                document.getElementById('confirmName').textContent = order?.customer_name || '';
                document.getElementById('confirmPhone').textContent = order?.phone_number || '';
                document.getElementById('confirmPayment').textContent = 
                    (order?.payment_method?.charAt(0).toUpperCase() + order?.payment_method?.slice(1)) || '';
                document.getElementById('confirmTable').textContent = order?.table_number || '';
            }

            displayOrderConfirmation();
            document.getElementById('confirmTotal').textContent = `₹${orderData.totalAmount.toFixed(2)}`;
            confirmModal.style.display = 'block';
        }

        const handleConfirm = async () => {
            try {
                if (confirmModal) confirmModal.style.display = 'none';
                const result = await fetchWithErrorHandling('../process/place_order.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
                if (result.success) {
                    handleSuccessfulNewOrder(result.order_id);
                    showToast(orderId ? 'Order updated successfully' : 'Order placed successfully', 'success');
                    loadTables();
                    loadActiveOrders();

                    if (orderId) {
                        const orderSelect = document.getElementById('existing_order_select');
                        if (orderSelect) {
                            orderSelect.value = '';
                            handleOrderSelection();
                            populateExistingOrders();
                        }
                    }
                }
            } catch (error) {
                showToast(error.message, 'error');
                console.error('Error processing order:', error);
            }
        };

        setupConfirmationButtons(handleConfirm);
    } catch (error) {
        console.error('Error handling order submission:', error);
        showToast(`Error processing order: ${error.message}`, 'error');
    }
});

function handleSuccessfulNewOrder(orderId) {
    const successModal = document.getElementById('successModal');
    if (successModal) {
        document.getElementById('orderIdText').textContent = orderId;
        successModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    resetOrderForm();
}

function setupConfirmationButtons(handleConfirm) {
    const confirmBtn = document.getElementById('confirmOrder');
    const editBtn = document.getElementById('editOrder');
    if (confirmBtn && editBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newEditBtn = editBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        newConfirmBtn.addEventListener('click', handleConfirm);
        newEditBtn.addEventListener('click', () => {
            const confirmModal = document.getElementById('confirmationModal');
            if (confirmModal) confirmModal.style.display = 'none';
        });
    }
}

function resetOrderForm() {
    const orderForm = document.getElementById('orderForm');
    if (orderForm) orderForm.reset();
    selectedDishes.clear();
    document.querySelectorAll('.dish-item').forEach(dishItem => {
        const checkbox = dishItem.querySelector('.dish-checkbox');
        const quantityWrapper = dishItem.querySelector('.quantity-wrapper');
        const quantityInput = dishItem.querySelector('.quantity-input');
        if (checkbox) checkbox.checked = false;
        if (quantityWrapper) quantityWrapper.style.display = 'none';
        if (quantityInput) quantityInput.value = 1;
        dishItem.classList.remove('selected');
    });
    selectedTableId = null;
    const tableInput = document.getElementById('selected_table_id');
    if (tableInput) tableInput.value = '';
    const infoDiv = document.getElementById('selectedTableInfo');
    if (infoDiv) infoDiv.classList.remove('visible');
    updateTotal();
    loadTables();
    const orderSelect = document.getElementById('existing_order_select');
    if (orderSelect) orderSelect.value = '';
}

const observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
};

const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const container = entry.target;
            const img = container.querySelector('.dish-image');
            if (img && img.dataset.src) {
                loadImage(img);
                observer.unobserve(container);
            }
        }
    });
}, observerOptions);

function loadImage(img) {
    const container = img.closest('.dish-image-wrapper');
    const placeholder = container.querySelector('.dish-image-placeholder');
    const loadingIndicator = container.querySelector('.loading-indicator');
    const tempImage = new Image();
    tempImage.onload = () => {
        img.src = tempImage.src;
        img.classList.add('loaded');
        if (placeholder) placeholder.style.display = 'none';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    };
    tempImage.onerror = () => {
        img.src = '/api/placeholder/300/200';
        img.classList.add('loaded');
        if (placeholder) placeholder.style.display = 'none';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    };
    tempImage.src = img.dataset.src;
}

// EventSource for real-time updates
let eventSource;
let currentTabStatus = 'all'; // Track the current tab status
let activeOrdersModalOpen = false; // Track if the modal is open

// Function to start SSE updates
function startRealtimeUpdatesWithSSE() {
    if (typeof EventSource !== 'undefined' && !eventSource) {
        eventSource = new EventSource('../process/get_order_updates_sse.php');
        eventSource.onmessage = function(event) {
            const update = JSON.parse(event.data);
            if (update.error) {
                console.error('SSE server error:', update.error);
                showToast('Real-time updates failed: ' + update.error, 'error');
            } else if (Object.keys(update).length > 0) { // Ignore empty heartbeats
                console.log('SSE Update received:', update);
                handleOrderUpdate(update);
            }
        };
        eventSource.onerror = function() {
            console.error('SSE connection error. Attempting to reconnect in 5 seconds...');
            showToast('Real-time updates disconnected. Reconnecting...', 'error');
            if (eventSource) {
                eventSource.close();
                eventSource = null;
                setTimeout(startRealtimeUpdatesWithSSE, 5000);
            }
        };
        console.log('SSE connection established');
    } else {
        console.warn('EventSource is not supported. Falling back to polling.');
        startOrderPolling();
    }
}
let orderPollingInterval;
function startOrderPolling() {
    if (!orderPollingInterval) {
        orderPollingInterval = setInterval(async () => {
            try {
                const response = await fetch('../process/get_active_orders.php');
                const result = await response.json();
                if (result.success) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const newOrders = result.data.filter(order => {
                        const orderDate = new Date(order.created_at);
                        orderDate.setHours(0, 0, 0, 0);
                        return orderDate.getTime() === today.getTime();
                    });

                    newOrders.forEach(newOrder => {
                        const orderIndex = activeOrders.findIndex(o => o.id == newOrder.id);
                        if (orderIndex !== -1) {
                            activeOrders[orderIndex] = newOrder;
                        } else {
                            activeOrders.push(newOrder);
                        }
                    });
                    activeOrders = activeOrders.filter(order => newOrders.some(newOrder => newOrder.id == order.id));

                    if (activeOrdersModalOpen) {
                        updateActiveOrdersList(currentTabStatus); // Use current tab status
                    }
                    updateActiveOrdersBadge(); // Update badge after polling
                }
            } catch (error) {
                console.error('Polling error:', error);
                showToast('Error fetching updates: ' + error.message, 'error');
            }
        }, 30000);
    }
}
function handleOrderUpdate(update) {
    const orderIndex = activeOrders.findIndex(o => o.id == update.order_id);
    if (orderIndex !== -1) {
        activeOrders[orderIndex] = {
            ...activeOrders[orderIndex],
            status: update.status,
            dishes: update.dishes || activeOrders[orderIndex].dishes,
            customer_name: update.customer_name,
            restaurant_table_id: update.restaurant_table_id,
            table_number: update.table_number,
            total_amount: update.total_amount,
            created_at: update.created_at,
            updated_at: update.updated_at,
            ordered_dishes: update.ordered_dishes
        };
    } else {
        activeOrders.push({
            id: update.order_id,
            status: update.status,
            dishes: update.dishes || [],
            customer_name: update.customer_name,
            restaurant_table_id: update.restaurant_table_id,
            table_number: update.table_number,
            total_amount: update.total_amount,
            created_at: update.created_at,
            updated_at: update.updated_at,
            ordered_dishes: update.ordered_dishes
        });
    }

    const orderCard = document.querySelector(`.order-card[data-order-id="${update.order_id}"]`);
    if (orderCard) {
        orderCard.classList.add('updated');
        updateOrderStatus(orderCard, update.status);
        setTimeout(() => orderCard.classList.remove('updated'), 1000);
    }

    if (activeOrdersModalOpen) {
        updateActiveOrdersList(currentTabStatus); // Use current tab status
    }
    updateActiveOrdersBadge(); // Update badge after each order update
    if (update.status === 'bill_generated') {
        loadTables();
    }
}
function updateOrderStatus(orderCard, newStatus) {
    const statusElement = orderCard.querySelector('.order-status');
    if (statusElement) {
        statusElement.className = `order-status status-${newStatus}`;
        statusElement.textContent = formatStatus(newStatus);
    }
    const progressElement = orderCard.querySelector('.order-progress');
    if (progressElement) {
        progressElement.innerHTML = renderOrderProgress(newStatus);
    }
}

async function fetchWithErrorHandling(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}