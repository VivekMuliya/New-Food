// Global variables
let activeOrders = [];
let lastCheckTime = new Date().toISOString();
let previousOrders = []; // Track previous orders to detect new ones
let previousNotificationCount = 0; // Track previous count for bell animation

// Sound notifications
const newOrderSound = new Audio('../sounds/pop_pop_pop.mp3'); // Sound for new orders
const newDishSound = new Audio('../sounds/bubble_pop.mp3');   // Sound for new dishes

// Initialize on document load
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    startRealtimeUpdates();

    // Add search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        updateOrdersDisplay(query);
    });

    // Menu Toggle Functionality with Auto-Close
    const menuToggle = document.querySelector('.menu-toggle');
    const menuDropdown = document.querySelector('.menu-dropdown');
    let autoCloseTimeout;

    menuToggle.addEventListener('click', () => {
        menuDropdown.classList.toggle('show');
        menuToggle.setAttribute('aria-expanded', menuDropdown.classList.contains('show'));

        // Clear any existing timeout and set new one
        if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
        if (menuDropdown.classList.contains('show')) {
            autoCloseTimeout = setTimeout(() => {
                menuDropdown.classList.remove('show');
                menuToggle.setAttribute('aria-expanded', 'false');
            }, 5000); // Auto-close after 5 seconds
        }
    });

    // Close dropdown when clicking outside, but allow link navigation
    document.addEventListener('click', (event) => {
        const isMenuClick = menuToggle.contains(event.target) || menuDropdown.contains(event.target);
        if (!isMenuClick) {
            menuDropdown.classList.remove('show');
            menuToggle.setAttribute('aria-expanded', 'false');
            if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
        }
    });
});

// Load orders for waiter panel
async function loadOrders() {
    try {
        const response = await fetch('../process/orders.php?action=get_active_orders');
        const result = await response.json();
        console.log('loadOrders response:', result);

        if (result.success) {
            activeOrders = result.data;
            detectNewOrdersAndDishes(previousOrders, activeOrders);
            previousOrders = JSON.parse(JSON.stringify(activeOrders)); // Deep copy
            updateOrdersDisplay();
        } else {
            showNotification('Error loading orders: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Failed to load orders', 'error');
    }
}

// Detect new orders and new dishes
function detectNewOrdersAndDishes(oldOrders, newOrders) {
    // Map old orders by ID for easier comparison
    const oldOrdersMap = new Map(oldOrders.map(order => [order.id, order]));

    // Check for new orders and new dishes
    newOrders.forEach(newOrder => {
        const oldOrder = oldOrdersMap.get(newOrder.id);
        if (!oldOrder) {
            // New order detected
            console.log(`New order detected: #${newOrder.id}`);
            newOrderSound.play().catch(error => console.error('Error playing new order sound:', error));
        } else {
            // Check for new dishes in existing order
            const oldDishes = oldOrder.ordered_dishes ? oldOrder.ordered_dishes.split(' | ') : [];
            const newDishes = newOrder.ordered_dishes ? newOrder.ordered_dishes.split(' | ') : [];
            const newDishCount = newDishes.length - oldDishes.length;
            if (newDishCount > 0) {
                console.log(`New dishes detected in order #${newOrder.id}: ${newDishCount}`);
                newDishSound.play().catch(error => console.error('Error playing new dish sound:', error));
            }
        }
    });
}

// Update the display of orders
function updateOrdersDisplay(searchQuery = '') {
    const ordersGrid = document.getElementById('waiterOrders');
    if (!ordersGrid) return;

    let filteredOrders = activeOrders;
    if (searchQuery) {
        filteredOrders = activeOrders.filter(order => 
            order.id.toString().includes(searchQuery) ||
            order.customer_name.toLowerCase().includes(searchQuery) ||
            String(order.table_number).toLowerCase().includes(searchQuery)
        );
    }

    // Display orders
    ordersGrid.innerHTML = filteredOrders.map(order => `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <span class="order-number">Order #${order.id}</span>
            </div>
            <div class="order-info">
                <div class="customer-info">
                    <i class="fas fa-user"></i> ${order.customer_name}
                </div>
                <div class="table-info">
                    <i class="fas fa-chair"></i> Table ${order.table_number}
                </div>
            </div>
            <div class="dishes-list">
                ${formatDishes(order.ordered_dishes)}
            </div>
            ${order.ordered_dishes ? `
                <div class="pickup-action">
                    <button class="btn-pickup" onclick="markOrderAsPicked(${order.id})">
                        <i class="fas fa-hand-holding"></i> Pick Up
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Format dishes for display
function formatDishes(dishes) {
    if (!dishes) return '<p>No dishes pending</p>';
    return dishes.split(' | ').map(dish => `
        <div class="dish-item">
            ${dish.replace(/, Status: \w+, DetailId: \d+/i, '')}
        </div>
    `).join('');
}

// Mark order as picked up
async function markOrderAsPicked(orderId) {
    try {
        console.log(`Marking order #${orderId} as picked up`);
        const response = await fetch('../process/orders.php?action=mark_order_picked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
        });
        const result = await response.json();
        console.log('markOrderAsPicked response:', result);

        if (result.success) {
            const orderIndex = activeOrders.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                const dishNames = result.dish_names.join(', ');
                const tableNumber = result.table_number;
                activeOrders.splice(orderIndex, 1); // Remove the order locally
                updateOrdersDisplay();
                showNotification(`Picked up ${dishNames} from Table ${tableNumber} for Order #${orderId}`, 'success');
            }
        } else {
            showNotification('Failed to mark order as picked up: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error marking order as picked up:', error);
        showNotification('Failed to mark order as picked up', 'error');
    }
}

// Real-time updates for notifications and prepared dishes
function startRealtimeUpdates() {
    setInterval(checkForPreparedDishes, 5000); // Check every 5 seconds
    setInterval(refreshOrderList, 5000); // Refresh order list every 5 seconds
    setInterval(updateNotificationCount, 5000); // Update notification count every 5 seconds
}

// Check for prepared dishes and picked orders
async function checkForPreparedDishes() {
    try {
        const response = await fetch('../process/orders.php?action=check_prepared_dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_check: lastCheckTime })
        });
        const result = await response.json();
        console.log('checkForPreparedDishes response:', result);

        if (result.success) {
            lastCheckTime = result.current_time;
            const preparedDishes = result.prepared_dishes;
            const pickedOrders = result.picked_orders;

            // Update prepared dishes (notifications only, display handled by refresh)
            preparedDishes.forEach(event => {
                showNotification(`Dish ${event.dish_name} of Order #${event.order_id} is prepared, pick up`, 'success');
            });

            // Update picked orders
            pickedOrders.forEach(event => {
                const orderIndex = activeOrders.findIndex(o => o.id === event.order_id);
                if (orderIndex !== -1) {
                    const dishNames = event.dish_names;
                    const tableNumber = event.table_number;
                    activeOrders.splice(orderIndex, 1); // Remove the order locally
                    updateOrdersDisplay();
                    showNotification(`Picked up ${dishNames} from Table ${tableNumber} for Order #${event.order_id}`, 'info');
                }
            });
        } else {
            console.error('Error checking prepared dishes:', result.error);
        }
    } catch (error) {
        console.error('Error checking prepared dishes:', error);
    }
}

// Refresh the order list every 5 seconds
async function refreshOrderList() {
    try {
        const response = await fetch('../process/orders.php?action=get_active_orders');
        const result = await response.json();
        console.log('refreshOrderList response:', result);

        if (result.success) {
            // Detect new orders and dishes before updating the list
            detectNewOrdersAndDishes(previousOrders, result.data);
            activeOrders = result.data;
            previousOrders = JSON.parse(JSON.stringify(activeOrders)); // Deep copy
            updateOrdersDisplay(document.getElementById('searchInput')?.value || '');
        } else {
            console.error('Error refreshing orders:', result.error);
        }
    } catch (error) {
        console.error('Error refreshing orders:', error);
    }
}

// Update notification count for bell icon
async function updateNotificationCount() {
    try {
        const response = await fetch('../process/orders.php?action=get_waiter_notification_count');
        const result = await response.json();
        console.log('get_waiter_notification_count response:', result);

        if (result.success) {
            const count = result.count;
            const badge = document.getElementById('notificationCount');
            const bell = document.querySelector('.notification-bell');
            badge.textContent = count;

            // Trigger shake animation if count changes
            if (count !== previousNotificationCount && count > 0) {
                bell.classList.add('shake');
            }
            previousNotificationCount = count;
        } else {
            console.error('Error fetching notification count:', result.error);
        }
    } catch (error) {
        console.error('Error fetching notification count:', error);
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="close-notification" aria-label="Close Notification">×</button>
    `;
    
    const container = document.getElementById('notifications');
    container.appendChild(notification);

    // Auto-close after 10 seconds
    const timeoutId = setTimeout(() => {
        notification.remove();
    }, 10000);

    // Manual close
    notification.querySelector('.close-notification').addEventListener('click', () => {
        clearTimeout(timeoutId);
        notification.remove();
    });
}
