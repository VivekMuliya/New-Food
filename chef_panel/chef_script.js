// Global variables
let activeOrders = [];
let similarDishes = {};
let orderUpdateInterval;
let recognition = null;
let isVoiceActive = false;
let highlightedOrderIndex = -1; // For navigating orders with "Next Order"
let previousOrders = []; // Track previous orders to detect new ones
let previousNotificationCount = 0; // Track previous count for bell animation

// Sound notifications
const newOrderSound = new Audio('sounds/pop_pop_pop.mp3'); // Sound for new orders
const newDishSound = new Audio('sounds/bubble_pop.mp3');   // Sound for new dishes

// Initialize on document load
document.addEventListener('DOMContentLoaded', () => {
    loadChefOrders();
    startRealtimeUpdates();
    initializeVoiceCommands();

    // Menu Toggle Functionality with Auto-Close
    const menuToggle = document.querySelector('.menu-toggle');
    const menuDropdown = document.querySelector('.menu-dropdown');
    let autoCloseTimeout;

    if (menuToggle && menuDropdown) {
        menuToggle.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from bubbling to document
            const isExpanded = menuDropdown.classList.toggle('show');
            menuToggle.setAttribute('aria-expanded', isExpanded.toString());

            // Clear any existing timeout and set new one
            if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
            if (isExpanded) {
                autoCloseTimeout = setTimeout(() => {
                    menuDropdown.classList.remove('show');
                    menuToggle.setAttribute('aria-expanded', 'false');
                }, 5000); // Auto-close after 5 seconds
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!menuToggle.contains(event.target) && !menuDropdown.contains(event.target)) {
                menuDropdown.classList.remove('show');
                menuToggle.setAttribute('aria-expanded', 'false');
                if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
            }
        });

        // Prevent dropdown clicks from closing the menu
        menuDropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    } else {
        console.error('Menu toggle or dropdown not found in DOM');
    }
});

// Load chef orders and start real-time updates
async function loadChefOrders() {
    try {
        const response = await fetch('get_chef_orders.php');
        const result = await response.json();

        if (result.success) {
            activeOrders = result.data.orders;
            similarDishes = result.data.similarDishes;
            // Calculate priority scores and sort orders
            activeOrders.forEach(order => {
                order.priorityScore = calculatePriorityScore(order);
            });
            activeOrders.sort((a, b) => b.priorityScore - a.priorityScore); // Descending order

            // Detect new orders and dishes
            detectNewOrdersAndDishes(previousOrders, activeOrders);
            previousOrders = JSON.parse(JSON.stringify(activeOrders)); // Deep copy

            updateOrdersDisplay();
            updateSimilarDishesPanel();
            updateStatistics(); // Update counts after loading orders
        } else {
            showNotification('Error loading orders: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Failed to load orders', 'error');
    }
}

// Rest of the script remains unchanged
function detectNewOrdersAndDishes(oldOrders, newOrders) {
    const oldOrdersMap = new Map(oldOrders.map(order => [order.id, order]));

    newOrders.forEach(newOrder => {
        const oldOrder = oldOrdersMap.get(newOrder.id);
        if (!oldOrder) {
            console.log(`New order detected: #${newOrder.id}`);
            newOrderSound.play().catch(error => console.error('Error playing new order sound:', error));
            showNotification(`New order #${newOrder.id} has arrived`, 'success');
        } else {
            const oldDishes = oldOrder.ordered_dishes ? oldOrder.ordered_dishes.split(' | ') : [];
            const newDishes = newOrder.ordered_dishes ? newOrder.ordered_dishes.split(' | ') : [];
            const newDishCount = newDishes.length - oldDishes.length;
            if (newDishCount > 0) {
                console.log(`New dishes detected in order #${newOrder.id}: ${newDishCount}`);
                newDishSound.play().catch(error => console.error('Error playing new dish sound:', error));
                showNotification(`New dishes added to order #${newOrder.id}`, 'success');
            }
        }
    });
}

function calculatePriorityScore(order) {
    const orderAge = parseInt(order.order_age) || 0;
    const ageScore = orderAge * 2;
    const waitTimeScore = ageScore;
    const priorityWeight = {
        'high': 30,
        'medium': 15,
        'low': 0
    };
    const priorityScore = priorityWeight[order.priority || 'medium'];
    const totalScore = ageScore + waitTimeScore + priorityScore;
    console.log(`Priority score for Order #${order.id}:`, { ageScore, waitTimeScore, priorityScore, totalScore });
    return totalScore;
}

function initializeVoiceCommands() {
    const voiceToggle = document.getElementById('voiceToggle');
    if (!voiceToggle) {
        console.warn('Voice toggle button not found');
        return;
    }

    if (!('webkitSpeechRecognition' in window)) {
        console.warn('Speech recognition not supported in this browser');
        showNotification('Voice commands not supported in this browser', 'error');
        voiceToggle.disabled = true;
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log('Voice command received:', transcript);
        processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
        }
        showNotification('Speech recognition error: ' + event.error, 'error');
        stopVoiceRecognition();
    };

    recognition.onend = () => {
        if (isVoiceActive) {
            console.log('Speech recognition ended, restarting...');
            recognition.start();
        }
    };

    voiceToggle.addEventListener('click', () => {
        if (isVoiceActive) {
            stopVoiceRecognition();
        } else {
            startVoiceRecognition();
        }
    });
}

function startVoiceRecognition() {
    if (!recognition) return;

    isVoiceActive = true;
    const voiceToggle = document.getElementById('voiceToggle');
    voiceToggle.classList.add('active');
    voiceToggle.querySelector('i').classList.replace('fa-microphone', 'fa-microphone-slash');
    recognition.start();
    showNotification('Voice recognition started. Say a command.', 'success');
    console.log('Voice recognition started');
}

function stopVoiceRecognition() {
    if (!recognition) return;

    isVoiceActive = false;
    const voiceToggle = document.getElementById('voiceToggle');
    voiceToggle.classList.remove('active');
    voiceToggle.querySelector('i').classList.replace('fa-microphone-slash', 'fa-microphone');
    recognition.stop();
    showNotification('Voice recognition stopped.', 'info');
    console.log('Voice recognition stopped');
}

function processVoiceCommand(command) {
    console.log('Processing command:', command);

    if (command.includes('mark all')) {
        if (highlightedOrderIndex < 0 || highlightedOrderIndex >= activeOrders.length) {
            showNotification('No order selected. Say "Next Order" to select an order.', 'error');
            return;
        }
        const orderId = activeOrders[highlightedOrderIndex].id;
        markOrderAsPrepared(orderId);
        return;
    }

    const markDishMatch = command.match(/mark (.+)/i);
    if (markDishMatch) {
        const dishName = markDishMatch[1].trim();
        if (highlightedOrderIndex < 0 || highlightedOrderIndex >= activeOrders.length) {
            showNotification('No order selected. Say "Next Order" to select an order.', 'error');
            return;
        }
        const orderId = activeOrders[highlightedOrderIndex].id;
        markDishAsPreparedByName(orderId, dishName);
        return;
    }

    const setPriorityMatch = command.match(/set priority (high|medium|low) for order (\d+)/i);
    if (setPriorityMatch) {
        const priority = setPriorityMatch[1].toLowerCase();
        const orderId = parseInt(setPriorityMatch[2]);
        setOrderPriority(orderId, priority);
        return;
    }

    if (command.includes('next order')) {
        navigateToNextOrder();
        return;
    }

    showNotification('Unrecognized command: ' + command, 'error');
}

async function markOrderAsPrepared(orderId) {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) {
        showNotification('Order #' + orderId + ' not found', 'error');
        return;
    }

    const dishes = order.ordered_dishes ? order.ordered_dishes.split(' | ') : [];
    const pendingDishes = dishes.filter(dish => dish.includes('Status: pending'));
    if (pendingDishes.length === 0) {
        showNotification('No pending dishes to mark as prepared for Order #' + orderId, 'error');
        return;
    }

    try {
        for (const dish of pendingDishes) {
            const detailIdMatch = dish.match(/DetailId: (\d+)/);
            const detailId = detailIdMatch ? parseInt(detailIdMatch[1]) : null;
            if (detailId) {
                await markDishAsPrepared(detailId, orderId);
            }
        }
        showNotification('Order #' + orderId + ' marked as prepared', 'success');
    } catch (error) {
        showNotification('Failed to mark Order #' + orderId + ' as prepared: ' + error.message, 'error');
    }
}

async function markDishAsPreparedByName(orderId, dishName) {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) {
        showNotification('Order #' + orderId + ' not found', 'error');
        return;
    }

    const dishes = order.ordered_dishes ? order.ordered_dishes.split(' | ') : [];
    const matchingDishes = dishes.filter(dish => {
        const cleanDish = dish.toLowerCase().replace(/, status: \w+, detailid: \d+/i, '').trim();
        return cleanDish.includes(dishName.toLowerCase()) && dish.includes('Status: pending');
    });

    if (matchingDishes.length === 0) {
        showNotification(`No pending ${dishName} dishes found in Order #${orderId}`, 'error');
        return;
    }

    try {
        for (const dish of matchingDishes) {
            const detailIdMatch = dish.match(/DetailId: (\d+)/);
            const detailId = detailIdMatch ? parseInt(detailIdMatch[1]) : null;
            if (detailId) {
                await markDishAsPrepared(detailId, orderId);
            }
        }
        showNotification(`${dishName} marked as prepared in Order #${orderId}`, 'success');
    } catch (error) {
        showNotification(`Failed to mark ${dishName} as prepared: ${error.message}`, 'error');
    }
}

async function markBatchAsPrepared(dishName, details) {
    try {
        for (const detail of details) {
            const { detail_id, order_id } = detail;
            await markDishAsPrepared(detail_id, order_id);
        }
        showNotification(`${dishName} batch marked as prepared`, 'success');
    } catch (error) {
        showNotification(`Failed to mark ${dishName} batch as prepared: ${error.message}`, 'error');
    }
}

async function setOrderPriority(orderId, priority) {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) {
        showNotification('Order #' + orderId + ' not found', 'error');
        return;
    }

    try {
        const response = await fetch('../set_order_priority.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, priority })
        });

        const result = await response.json();
        if (result.success) {
            showNotification(`Priority set to ${priority} for Order #${orderId}`, 'success');
            loadChefOrders();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification('Failed to set priority: ' + error.message, 'error');
    }
}

function navigateToNextOrder() {
    if (activeOrders.length === 0) {
        showNotification('No orders available', 'info');
        return;
    }

    document.querySelectorAll('.order-card').forEach(card => {
        card.classList.remove('highlighted');
    });

    highlightedOrderIndex = (highlightedOrderIndex + 1) % activeOrders.length;
    const orderId = activeOrders[highlightedOrderIndex].id;
    const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
    
    if (orderCard) {
        orderCard.classList.add('highlighted');
        orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showNotification(`Navigated to Order #${orderId}`, 'info');
    } else {
        showNotification('Order not found in the UI', 'error');
    }
}

function updateOrdersDisplay() {
    const ordersGrid = document.getElementById('processingOrders');
    if (!ordersGrid) return;

    ordersGrid.innerHTML = activeOrders.map(order => `
        <div class="order-card priority-${order.priority || 'medium'}" data-order-id="${order.id}">
            <div class="order-header">
                <span class="order-number">Order #${order.id}</span>
                <span class="order-time">${formatTimeAgo(order.created_at)}</span>
            </div>
            <div class="order-info">
                <div class="table-info">
                    <i class="fas fa-chair"></i> Table ${order.table_number}
                </div>
                <div class="customer-info">
                    <i class="fas fa-user"></i> ${order.customer_name}
                </div>
            </div>
            <div class="dishes-list">
                ${formatOrderedDishes(order.ordered_dishes, order.id)}
            </div>
        </div>
    `).join('');

    if (highlightedOrderIndex >= 0 && highlightedOrderIndex < activeOrders.length) {
        const orderId = activeOrders[highlightedOrderIndex].id;
        const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (orderCard) {
            orderCard.classList.add('highlighted');
        }
    }
}

function formatOrderedDishes(dishes, orderId) {
    if (!dishes) return '<p>No dishes</p>';
    
    const dishArray = dishes.split(' | ').map(dish => {
        const detailIdMatch = dish.match(/DetailId: (\d+)/);
        const statusMatch = dish.match(/Status: (\w+)/);
        const detailId = detailIdMatch ? detailIdMatch[1] : null;
        const status = statusMatch ? statusMatch[1] : 'pending';

        const isNew = dish.includes(' - NEW');
        const isPending = status === 'pending';

        return `
            <div class="dish-item ${isNew ? 'new-dish' : ''} ${isSimilarDish(dish.trim()) ? 'similar-dish' : ''}">
                <span>${dish.replace(/, Status: \w+, DetailId: \d+/, '')}</span>
                ${isPending ? `
                    <button class="btn-prepared" onclick="markDishAsPrepared(${detailId}, ${orderId})">
                        <i class="fas fa-check"></i>
                        Mark Prepared
                    </button>
                ` : '<span class="prepared-label">Prepared</span>'}
            </div>
        `;
    });

    return dishArray.join('');
}

function isSimilarDish(dish) {
    const dishName = dish.split(':')[1]?.split(' (')[0]?.trim();
    return similarDishes[dishName] && similarDishes[dishName].length > 1;
}

async function markDishAsPrepared(detailId, orderId) {
    try {
        const response = await fetch('mark_dish_prepared.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detailId })
        });

        const result = await response.json();
        if (result.success) {
            showNotification('Dish marked as prepared', 'success');
            loadChefOrders();
            updateStatistics();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error marking dish as prepared:', error);
        showNotification('Failed to mark dish as prepared', 'error');
    }
}

function updateSimilarDishesPanel() {
    const panel = document.getElementById('similarDishesPanel');
    if (!panel) return;

    if (!similarDishes || Object.keys(similarDishes).length === 0) {
        panel.innerHTML = `
            <div class="panel-header">
                <h3><i class="fas fa-link"></i> Batch Preparation Suggestions</h3>
            </div>
            <p class="no-similar">No similar dishes found at the moment</p>
        `;
        return;
    }

    const entries = Object.entries(similarDishes);
    
    panel.innerHTML = `
        <div class="panel-header">
            <h3><i class="fas fa-link"></i> Batch Preparation Suggestions</h3>
            <span class="total-count">${entries.length} groups found</span>
        </div>
        <div class="similar-dishes-content">
            ${entries.map(([dishName, data]) => `
                <div class="similar-dish-group">
                    <div class="dish-header">
                        <div class="dish-name">
                            <i class="fas fa-utensils"></i>
                            ${dishName}
                        </div>
                        <span class="order-count">
                            ${data.total_quantity} items across ${data.count} orders
                        </span>
                    </div>
                    <div class="orders-list">
                        ${data.details.map(detail => {
                            const order = activeOrders.find(o => o.id == detail.order_id);
                            return order ? `
                                <div class="related-order">
                                    <span class="order-number">Order #${detail.order_id}</span>
                                    <span class="table-number">Qty: ${detail.quantity} - Table ${order.table_number}</span>
                                </div>
                            ` : '';
                        }).join('')}
                    </div>
                    <div class="batch-action">
                        <button class="btn-prepared batch-prepare" onclick="markBatchAsPrepared('${dishName}', ${JSON.stringify(data.details)})">
                            <i class="fas fa-check"></i>
                            Mark All Prepared
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function setPriority(orderId) {
    const modal = document.getElementById('priorityModal');
    modal.style.display = 'block';
    
    const buttons = modal.querySelectorAll('.priority-btn');
    buttons.forEach(btn => {
        btn.onclick = async () => {
            try {
                const response = await fetch('../set_order_priority.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        priority: btn.dataset.priority
                    })
                });

                const result = await response.json();
                if (result.success) {
                    showNotification('Priority updated', 'success');
                    loadChefOrders();
                }
            } catch (error) {
                showNotification('Failed to update priority', 'error');
            } finally {
                modal.style.display = 'none';
            }
        };
    });
}

function startRealtimeUpdates() {
    orderUpdateInterval = setInterval(() => {
        loadChefOrders();
        updateStatistics();
        updateNotificationCount();
    }, 30000);
}

async function updateStatistics() {
    try {
        const response = await fetch('orders.php?action=get_chef_order_counts');
        const result = await response.json();

        if (result.success) {
            const { processingCount, preparedCount } = result.data;
            document.getElementById('processingCount').textContent = processingCount;
            document.getElementById('preparedCount').textContent = preparedCount;
            console.log('Updated chef panel counts:', { processingCount, preparedCount });
        } else {
            console.error('Error fetching chef order counts:', result.error);
        }
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

async function updateNotificationCount() {
    try {
        const response = await fetch('orders.php?action=get_chef_notification_count');
        const result = await response.json();
        console.log('get_chef_notification_count response:', result);

        if (result.success) {
            const count = result.count;
            const badge = document.getElementById('notificationCount');
            const bell = document.querySelector('.notification-bell');
            badge.textContent = count;

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

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notifications');
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}