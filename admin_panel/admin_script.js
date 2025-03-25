    let activeOrders = [];
    let completedOrders = [];
    let dishCache = null;
    let lastUpdateTime = null; // Add this globally at the top of script.js and admin_script.js
    // Global Error and Loading Management


    async function fetchWithErrorHandling(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type');
            
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Server error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
    // Add helper function for prompts
    function showPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const value = window.prompt(message, defaultValue);
            resolve(value);
        });
    }



    async function pollOrderUpdates() {
        console.log('pollOrderUpdates: Fetching updates...');
        try {
            const response = await fetch(`../process/get_order_updates.php?last_check=${encodeURIComponent(lastUpdateTime || '1970-01-01 00:00:00')}`);
            const updates = await response.json();
            console.log('pollOrderUpdates: Updates data:', updates);
            if (updates.success) {
                updates.data.forEach(update => {
                    handleOrderUpdate(update);
                });
                lastUpdateTime = updates.current_time; // Update the last check time
            } else {
                console.error('pollOrderUpdates: Failed to fetch updates:', updates.error);
            }
        } catch (error) {
            console.error('pollOrderUpdates: Error fetching updates:', error);
        }
    }
    const billGeneratedTimestamps = new Map();

    function handleOrderUpdate(update) {
        const orderIndex = activeOrders.findIndex(o => o.id == update.order_id);
        if (orderIndex !== -1) {
            activeOrders[orderIndex] = {
                ...activeOrders[orderIndex],
                status: update.status,
                dishes: update.dishes || activeOrders[orderIndex].dishes,
                table_number: update.table_number,
                customer_name: update.customer_name,
                total_amount: update.total_amount,
                created_at: update.created_at
            };

            // If status is bill_generated, record the timestamp
            if (update.status === 'bill_generated') {
                billGeneratedTimestamps.set(update.order_id, Date.now());
            }
        } else {
            activeOrders.push({
                id: update.order_id,
                status: update.status,
                dishes: update.dishes || [],
                table_number: update.table_number,
                customer_name: update.customer_name,
                total_amount: update.total_amount,
                created_at: update.created_at
            });

            // If new order has bill_generated status, record timestamp
            if (update.status === 'bill_generated') {
                billGeneratedTimestamps.set(update.order_id, Date.now());
            }
        }

        const orderCard = document.querySelector(`.order-card[data-order-id="${update.order_id}"]`);
        if (orderCard) {
            orderCard.classList.add('updated');
            updateOrderStatus(orderCard, update.status);
            setTimeout(() => orderCard.classList.remove('updated'), 1000);
        }

        updateActiveOrdersList(); // Refresh the UI
        if (update.status === 'bill_generated') {
            loadTables(); // Refresh tables when bill is generated
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
    async function loadActiveOrders() {
        try {
            showLoading();
            const response = await fetch('get_admin_active_orders.php'); // Use the new PHP file
            const result = await response.json();
            if (result.success) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
    
                activeOrders = result.data.filter(order => {
                    const orderDate = new Date(order.created_at);
                    orderDate.setHours(0, 0, 0, 0);
                    return orderDate.getTime() === today.getTime();
                });
    
                console.log('Fetched Active Orders:', activeOrders);
                console.log('Statuses:', activeOrders.map(order => order.status));
    
                updateActiveOrdersList();
                updateActiveOrdersBadge();
                populateExistingOrders();
            } else {
                throw new Error(result.error || 'Failed to load active orders');
            }
        } catch (error) {
            console.error('Error loading active orders:', error);
            updateActiveOrdersList([]);
            updateActiveOrdersBadge();
            showToast('Error loading active orders: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }
    
    function updateActiveOrdersList(statusFilter = 'all') {
        const ordersList = document.getElementById('activeOrdersList');
        if (!ordersList) return;
    
        ordersList.innerHTML = '';
        currentTabStatus = statusFilter;
    
        const groupedOrders = {
            all: [],
            pending: [],
            processing: [],
            food_prepared: [],
            bill_generated: [],
            completed: []
        };
    
        activeOrders.forEach(order => {
            groupedOrders.all.push(order);
            if (groupedOrders[order.status]) {
                groupedOrders[order.status].push(order);
            } else {
                groupedOrders.all.push(order);
            }
        });
    
        console.log('Grouped Orders:', groupedOrders);
    
        let ordersToDisplay = [];
        if (statusFilter === 'all') {
            ordersToDisplay = groupedOrders.all;
        } else if (statusFilter === 'pending') {
            ordersToDisplay = groupedOrders.pending;
        } else if (statusFilter === 'processing') {
            ordersToDisplay = groupedOrders.processing;
        } else if (statusFilter === 'food_prepared') {
            ordersToDisplay = groupedOrders.food_prepared;
        } else if (statusFilter === 'bill_generated') {
            ordersToDisplay = groupedOrders.bill_generated;
        } else if (statusFilter === 'completed') {
            ordersToDisplay = groupedOrders.completed;
        }
    
        if (ordersToDisplay.length === 0) {
            ordersList.innerHTML = '<p class="no-orders">No orders found.</p>';
            return;
        }
    
        ordersToDisplay.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            orderCard.setAttribute('data-order-id', order.id);
            orderCard.innerHTML = `
                <div class="order-header">
                    <div>
                        <strong>Order #${order.id}</strong>
                        <span class="order-status status-${order.status}">${order.status.replace('_', ' ')}</span>
                    </div>
                    <div>
                        <span>Table: ${order.table_number}</span> | 
                        <span>Total: ₹${order.total_amount}</span>
                    </div>
                </div>
                <div class="order-details">
                    <p><strong>Customer:</strong> ${order.customer_name}</p>
                    <p><strong>Ordered:</strong> ${order.ordered_dishes}</p>
                    <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div class="order-actions">
                    <button class="order-btn btn-primary" onclick="viewOrderDetails(${order.id})">View Details</button>
                </div>
            `;
            ordersList.appendChild(orderCard);
        });
    }
    async function markOrderCompleted(orderId) {
        try {
            const response = await fetchWithErrorHandling('admin_mark_order_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    status: 'completed'
                })
            });
            if (response.success) {
                showToast('Order marked as completed', 'success');
                loadActiveOrders();
            } else {
                showToast('Failed to mark order as completed: ' + response.error, 'error');
            }
        } catch (error) {
            showToast('Error marking order as completed: ' + error.message, 'error');
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

    function formatStatus(status) {
        // Convert status from snake_case to Title Case
        return status
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    function showLoading(tableId) {
        const tableBody = document.querySelector(`#${tableId} tbody`);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="100%" class="text-center">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i> Loading...
                        </div>
                    </td>
                </tr>
            `;
        }
    }


    // Toast notification function
    function showToast(message, type = 'info') {
        console.log('showToast called:', { message, type }); // Debug: Confirm function call

        // Create a new toast container for each message
        const toastContainer = document.createElement('div');
        toastContainer.className = `global-error ${type}`;
        toastContainer.role = 'alert';
        toastContainer.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span class="error-message">${message}</span>
            <button class="close-error" aria-label="Close Error Message">×</button>
        `;

        // Append the toast directly to the body
        document.body.appendChild(toastContainer);

        // Automatically close after 3 seconds
        const timeoutId = setTimeout(() => {
            try {
                toastContainer.remove();
                console.log('Toast removed automatically:', message); // Debug
            } catch (error) {
                console.error('Error during auto-close:', error);
            }
        }, 3000);

        // Add close functionality for the "×" button
        const closeButton = toastContainer.querySelector('.close-error');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                try {
                    clearTimeout(timeoutId); // Clear the timeout to prevent double removal
                    toastContainer.remove();
                    console.log('Toast removed manually:', message); // Debug
                } catch (error) {
                    console.error('Error during manual close:', error);
                }
            });
        } else {
            console.warn('Close button not found in toast'); // Debug
        }
    }

    function hideLoading() {
        const loadingSpinners = document.querySelectorAll('.loading-spinner');
        loadingSpinners.forEach(spinner => {
            const row = spinner.closest('tr');
            if (row) {
                row.remove();
            }
        });
    }

    // Helper function to handle API calls
    async function fetchData(url, options = {}) {
        console.log(`Fetching data from: ${url}`);
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Data received from ${url}:`, data);
            return data;
        } catch (error) {
            console.error(`Error fetching from ${url}:`, error);
            throw error;
        }
    }




    function showGlobalError(message) {
        const errorDiv = document.getElementById('globalError');
        if (errorDiv) {
            const errorMessage = errorDiv.querySelector('.error-message');
            errorMessage.textContent = message;
            errorDiv.classList.remove('hidden');
            setTimeout(() => errorDiv.classList.add('hidden'), 5000);
        } else {
            console.error(message);
        }
    }
    function showLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    function hideLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }



    function showMessage(elementId, message, type) {
        const messageElement = document.getElementById(elementId);
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }

    // Progress Bar Management
    function updateProgress(value) {
        const progressBar = document.querySelector('.progress-bar');
        const progress = progressBar.querySelector('.progress');
        
        progressBar.classList.remove('hidden');
        progress.style.width = `${value}%`;
        progressBar.setAttribute('aria-valuenow', value);
        
        if (value >= 100) {
            setTimeout(() => {
                progressBar.classList.add('hidden');
            }, 500);
        }
    }

    function showProgressForFetch() {
        updateProgress(20);
        setTimeout(() => updateProgress(50), 300);
        setTimeout(() => updateProgress(80), 600);
    }

    // Form Validation
    function validateForm(formElement) {
        let isValid = true;
        const requiredFields = formElement.querySelectorAll('[aria-required="true"]');
        
        requiredFields.forEach(field => {
            const formGroup = field.closest('.form-group');
            const errorMessage = formGroup.querySelector('.error-message');
            
            if (!field.value.trim()) {
                formGroup.classList.add('error');
                errorMessage.textContent = `${field.getAttribute('placeholder')} is required`;
                isValid = false;
            } else {
                formGroup.classList.remove('error');
                errorMessage.textContent = '';
            }
        });
        
        return isValid;
    }

    // Utility function for debouncing
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

    // Navigation
    function showSection(sectionId) {
        document.querySelectorAll("section").forEach(section => {
            section.classList.add("hidden");
        });
        document.getElementById(sectionId).classList.remove("hidden");

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');

        // Load data for specific sections
        if (sectionId === 'bill-details') {
            loadBillDetails();
        }
    }
    // -------------------- Categories Management --------------------
    // Modified loadCategories function
    async function loadCategories() {
        try {
            showLoading('categoriesTable');
            console.log("Loading categories...");
            
            const data = await fetchData("../captain_panel/categories.php?action=get_all");
            console.log("Categories data:", data);

            const categoriesTableBody = document.querySelector("#categoriesTable tbody");
            if (!categoriesTableBody) {
                console.error("Categories table body not found");
                return;
            }

            categoriesTableBody.innerHTML = "";
            
            if (!data || data.length === 0) {
                categoriesTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">No categories found</td>
                    </tr>`;
                return;
            }

            data.forEach(category => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${category.name}</td>
                    <td>${category.description || '-'}</td>
                    <td>${category.display_order}</td>
                    <td>
                        <span class="status-badge ${category.is_active ? 'status-active' : 'status-inactive'}">
                            ${category.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td class="table-actions">
                        <button class="btn-action btn-edit" onclick="editCategory(${category.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-action btn-toggle" onclick="toggleCategory(${category.id}, ${category.is_active})">
                            <i class="fas fa-power-off"></i> ${category.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteCategory(${category.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>`;
                categoriesTableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error in loadCategories:", error);
            const categoriesTableBody = document.querySelector("#categoriesTable tbody");
            if (categoriesTableBody) {
                categoriesTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-red-500">
                            <i class="fas fa-exclamation-circle"></i>
                            Error loading categories: ${error.message}
                        </td>
                    </tr>`;
            }
        }
    }
    function loadCategoriesForSelect() {
        fetch("../captain_panel/categories.php?action=get_active")
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                const categorySelect = document.getElementById("category_select");
                categorySelect.innerHTML = '<option value="">Select Category</option>';
                data.forEach(category => {
                    categorySelect.innerHTML += `
                        <option value="${category.id}">${category.name}</option>`;
                });
            })
            .catch(error => {
                showGlobalError('Error loading categories: ' + error.message);
            });
    }

    // Category Form Handling
    document.getElementById("categoryForm").addEventListener("submit", function(e) {
        e.preventDefault();
        
        if (!validateForm(this)) {
            return;
        }

        const formData = {
            id: document.getElementById("category_id").value,
            name: document.getElementById("category_name").value.trim(),
            description: document.getElementById("category_description").value.trim(),
            display_order: document.getElementById("display_order").value || 0
        };

        const action = formData.id ? 'update' : 'add';
        showProgressForFetch();
        
        fetch(`../captain_panel/categories.php?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                showMessage('categoryFormMessage', 'Category saved successfully!', 'success');
                resetCategoryForm();
                loadCategories();
                loadCategoriesForSelect();
            } else {
                throw new Error(data.error || 'Error saving category');
            }
        })
        .catch(error => {
            showGlobalError('Error saving category: ' + error.message);
        });
    });

    function editCategory(id) {
        showLoadingOverlay();
        fetch(`../captain_panel/categories.php?action=get&id=${id}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(category => {
                document.getElementById("category_id").value = category.id;
                document.getElementById("category_name").value = category.name;
                document.getElementById("category_description").value = category.description || '';
                document.getElementById("display_order").value = category.display_order;
                hideLoadingOverlay();
            })
            .catch(error => {
                showGlobalError('Error loading category: ' + error.message);
                hideLoadingOverlay();
            });
    }

    function toggleCategory(id, currentStatus) {
        showProgressForFetch();
        fetch("../captain_panel/categories.php?action=toggle", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_active: !currentStatus })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                loadCategories();
                loadCategoriesForSelect();
                showMessage('categoryFormMessage', 'Category status updated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Error toggling category status');
            }
        })
        .catch(error => {
            showGlobalError('Error toggling category: ' + error.message);
        });
    }

    function deleteCategory(id) {
        if (!confirm("Are you sure you want to delete this category? This will affect all dishes in this category.")) {
            return;
        }

        showProgressForFetch();
        fetch("../captain_panel/categories.php?action=delete", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                loadCategories();
                loadCategoriesForSelect();
                showMessage('categoryFormMessage', 'Category deleted successfully!', 'success');
            } else {
                throw new Error(data.error || 'Error deleting category');
            }
        })
        .catch(error => {
            showGlobalError('Error deleting category: ' + error.message);
        });
    }

    function resetCategoryForm() {
        const form = document.getElementById("categoryForm");
        form.reset();
        document.getElementById("category_id").value = '';
        
        // Clear all error states
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
            const errorMessage = group.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.textContent = '';
            }
        });
    }


    // bill 
    async function loadBillDetails() {
        try {
            console.log('Fetching bill details for completed orders with Bill Generated');
            const response = await fetch('../process/orders.php?action=get_completed');
            const result = await response.json();
            console.log('Bill Details Data:', result); // Debug: Check full response
            
            if (result.success && result.data) {
                const billDetailsGrid = document.getElementById('billDetailsGrid');
                if (!billDetailsGrid) {
                    console.error('billDetailsGrid element not found');
                    return;
                }
                billDetailsGrid.innerHTML = result.data.length === 0 ? 
                    '<div class="no-data">No billed orders found</div>' : '';
                
                result.data.forEach(order => {
                    if (order.bill_generated) { // Only show orders with Bill Generated
                        console.log('Rendering billed order:', order); // Debug: Check each order
                        const card = document.createElement('div');
                        card.className = 'order-card';
                        card.innerHTML = `
                            <div class="order-header">
                                <span class="order-id">Order #${order.id}</span>
                                <span class="status-badge status-completed">Completed</span>
                            </div>
                            <div class="order-details">
                                <div class="customer-info">
                                    <i class="fas fa-user"></i>
                                    <span>${order.customer_name || 'N/A'}</span>
                                    <i class="fas fa-phone"></i>
                                    <span>${order.phone_number || 'N/A'}</span>
                                    <i class="fas fa-chair"></i>
                                    <span>Table ${order.table_number || 'N/A'}</span>
                                </div>
                                <div class="order-footer">
                                    <div class="total-amount-label">
                                        <span>Total Amount</span>
                                        <span>₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div class="order-actions">
                                        <button class="btn-action print-bill" onclick="printBill(${order.id})">
                                            <i class="fas fa-print"></i> <span>Print Bill</span>
                                        </button>
                                    </div>
                                    <div class="order-time">
                                        <i class="fas fa-clock"></i>
                                        <span>Placed: ${formatDateTime(order.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        billDetailsGrid.appendChild(card);
                    }
                });
            } else {
                throw new Error('No data returned or success is false');
            }
        } catch (error) {
            console.error('Error loading bill details:', error);
            showGlobalError('Error loading bill details: ' + error.message);
            const billDetailsGrid = document.getElementById('billDetailsGrid');
            if (billDetailsGrid) billDetailsGrid.innerHTML = '<div class="no-data">Error loading billed orders</div>';
        }
    }

    function showActiveOrdersModal() {
        const modal = document.getElementById('activeOrdersModal');
        if (modal) {
            modal.classList.add('active');
            updateActiveOrdersList(); // Ensure the list is refreshed when modal opens
        }
    }
    async function printBill(orderId) {
        try {
            console.log('Generating bill for orderId:', orderId); // Debug: Verify orderId
            const response = await fetch('../process/orders.php?action=get_bill_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderId })
            });
            const result = await response.json();
            console.log('Bill details response:', result); // Debug: Check server response

            if (result.success) {
                generateBillPDF(result.data);
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error generating bill:', error);
            showToast('Failed to generate bill: ' + error.message, 'error');
        }
    }
    // Function to generate and print/download bill as PDF using jsPDF
    function generateBillPDF(order) {
        const { jsPDF } = window.jspdf; // Ensure jsPDF is included in your project
        const doc = new jsPDF({ unit: 'mm', format: 'a4' }); // Use A4 size for better formatting

        // Restaurant details (from your new example)
        const restaurantName = "Royal Crown";
        const address = "SECO - 5585 Sec 171 SVG 95493 Plot 123";
        const phone = "Phone: 1234567890";
        const email = "Email: royalcrown@gmail.com";
        const gstin = "GSTIN: 08RTVNHU2166N112";
        const invoiceNo = `INV/B8/19-20`;
        const orderId = order.id; // Add order ID
        const invoiceDate = new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        const tableNo = `Table No #${order.table_number}`;

        // Customer details
        const customerName = order.customer_name || 'Guest';
        const customerPhone = order.phone_number || 'N/A';
        const customerTable = `Table #${order.table_number}`;

        // Header
        doc.setFontSize(16);
        doc.text(restaurantName, 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text(address, 105, 20, { align: 'center' });
        doc.text(phone, 105, 25, { align: 'center' });
        doc.text(email, 105, 30, { align: 'center' });
        doc.text(gstin, 105, 35, { align: 'center' });
        doc.line(10, 40, 200, 40); // Horizontal line after restaurant details

        // Invoice details with order ID
        doc.setFontSize(12);
        doc.text("TAX INVOICE", 105, 50, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Invoice No: ${invoiceNo}`, 20, 60);
        doc.text(`Order ID: #${orderId}`, 20, 65); // Add order ID
        doc.text(`Invoice Date: ${invoiceDate}`, 20, 70);
        doc.line(10, 75, 200, 75); // Horizontal line after invoice details

        // Customer details
        doc.text("Customer Details:", 20, 85);
        doc.text(`Name: ${customerName}`, 20, 90);
        doc.text(`Phone: ${customerPhone}`, 20, 95);
        doc.text(`Table: ${customerTable}`, 20, 100);
        doc.line(10, 105, 200, 105); // Horizontal line after customer details

        // Order details table (group by dish name)
        const startY = 115;
        doc.setFontSize(10);
        doc.text("Sn", 20, startY - 5);
        doc.text("Item", 40, startY - 5);
        doc.text("Qty", 90, startY - 5);
        doc.text("Rate", 120, startY - 5);
        doc.text("Total", 150, startY - 5);

        let yPos = startY;
        let itemCount = 1;
        const dishMap = new Map(); // To group duplicate dishes
        const orderedDishes = order.ordered_dishes.split(' | ');
        orderedDishes.forEach(dish => {
            const [_, dishInfo] = dish.split(': ');
            const nameMatch = dishInfo.match(/^(.*?)(?:\(|\$)/);
            const name = nameMatch ? nameMatch[1].trim() : dishInfo;
            const quantityMatch = dishInfo.match(/\((\d+)(?: - NEW)?\)/);
            const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
            const priceMatch = dishInfo.match(/\$\d*\.?\d+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace('$', '')) : 0;

            if (!dishMap.has(name)) {
                dishMap.set(name, { totalQty: 0, rate: price });
            }
            dishMap.get(name).totalQty += quantity;
        });

        dishMap.forEach((data, name, index) => {
            const total = data.totalQty * data.rate;
            doc.text(`${itemCount}`, 20, yPos);
            doc.text(name, 40, yPos, { maxWidth: 50 });
            doc.text(`${data.totalQty}`, 90, yPos);
            doc.text(`Rs${data.rate.toFixed(2)}`, 120, yPos);
            doc.text(`Rs${total.toFixed(2)}`, 150, yPos);
            yPos += 7; // Reduce line height for tighter spacing
            itemCount++;
        });
        doc.line(10, yPos + 2, 200, yPos + 2); // Horizontal line after order items

        // Totals (without tax for now, as per your request)
        const totalAmount = parseFloat(order.total_amount || 0).toFixed(2);
        doc.text("Sub Total:", 120, yPos + 10);
        doc.text(`Rs${totalAmount}`, 150, yPos + 10);
        doc.text("Taxable:", 120, yPos + 15);
        doc.text(`Rs${totalAmount}`, 150, yPos + 15);
        doc.text("Total Due:", 120, yPos + 20);
        doc.text(`Rs${totalAmount}`, 150, yPos + 20);
        doc.line(10, yPos + 25, 200, yPos + 25); // Horizontal line after totals

        // Payment method
        doc.text(`Payment via: ${order.payment_method?.toUpperCase() || 'CASH'}`, 120, yPos + 30);
        doc.line(10, yPos + 35, 200, yPos + 35); // Horizontal line after payment method

        // Footer
        doc.setFontSize(8);
        doc.text("Thank you for your visit", 105, yPos + 45, { align: 'center' });
        doc.text("This software is designed by Muhafiz Tech Solutions", 105, yPos + 50, { align: 'center' });
        doc.line(10, yPos + 55, 200, yPos + 55); // Horizontal line after footer

        // Save or print
        doc.autoPrint(); // Automatically trigger print dialog
        doc.save(`Bill_Order_${order.id}.pdf`); // Allow download as PDF
    }
    // -------------------- Dishes Management --------------------
    function loadDishes() {
        showLoading('dishesTable');
        showProgressForFetch();

        fetch("../process/dishes.php?action=get_all")
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                updateProgress(100);
                const dishesTableBody = document.querySelector("#dishesTable tbody");
                dishesTableBody.innerHTML = "";
                
                if (!data || data.length === 0) {
                    dishesTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center">No dishes found</td>
                        </tr>`;
                    return;
                }

                data.forEach(dish => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${dish.name}</td>
                        <td>${dish.category_name || 'Uncategorized'}</td>
                        <td>${dish.description || '-'}</td>
                        <td>₹${parseFloat(dish.price).toFixed(2)}</td>
                        <td>
                            <label class="status-toggle" role="switch" aria-checked="${dish.is_available}">
                                <input type="checkbox" 
                                    ${dish.is_available ? 'checked' : ''} 
                                    onchange="toggleDishAvailability(${dish.id}, this.checked)"
                                    aria-label="Toggle availability">
                                <span class="status-toggle-slider"></span>
                            </label>
                        </td>
                        <td class="table-actions">
                            <button class="btn-action btn-edit" 
                                    onclick="editDish(${dish.id})"
                                    aria-label="Edit ${dish.name}">
                                <i class="fas fa-edit" aria-hidden="true"></i> Edit
                            </button>
                            <button class="btn-action btn-delete" 
                                    onclick="deleteDish(${dish.id})"
                                    aria-label="Delete ${dish.name}">
                                <i class="fas fa-trash" aria-hidden="true"></i> Delete
                            </button>
                        </td>`;
                    dishesTableBody.appendChild(row);
                });
            })
            .catch(error => {
                showGlobalError('Error loading dishes: ' + error.message);
                console.error("Error loading dishes:", error);
            });
    }

    // Dish Form Handling
    document.getElementById("dishForm").addEventListener("submit", function(e) {
        e.preventDefault();

        if (!validateForm(this)) {
            return;
        }

        const formData = {
            id: document.getElementById("dish_id").value,
            category_id: document.getElementById("category_select").value,
            name: document.getElementById("dish_name").value.trim(),
            description: document.getElementById("dish_description").value.trim(),
            price: parseFloat(document.getElementById("dish_price").value),
            is_available: document.getElementById("dish_available").checked
        };

        const action = formData.id ? 'update' : 'add';
        showProgressForFetch();
        
        fetch(`../process/dishes.php?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                showMessage('dishFormMessage', 'Dish saved successfully!', 'success');
                resetDishForm();
                loadDishes();
            } else {
                throw new Error(data.error || 'Error saving dish');
            }
        })
        .catch(error => {
            showGlobalError('Error saving dish: ' + error.message);
        });
    });

    function editDish(id) {
        showLoadingOverlay();
        fetch(`../process/dishes.php?action=get&id=${id}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(dish => {
                document.getElementById("dish_id").value = dish.id;
                document.getElementById("category_select").value = dish.category_id || '';
                document.getElementById("dish_name").value = dish.name;
                document.getElementById("dish_description").value = dish.description || '';
                document.getElementById("dish_price").value = dish.price;
                document.getElementById("dish_available").checked = dish.is_available;
                hideLoadingOverlay();
            })
            .catch(error => {
                showGlobalError('Error loading dish: ' + error.message);
                hideLoadingOverlay();
            });
    }

    function toggleDishAvailability(id, isAvailable) {
        showProgressForFetch();
        fetch("../process/dishes.php?action=toggle_availability", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_available: isAvailable })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                showMessage('dishFormMessage', 'Availability updated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Error updating availability');
            }
        })
        .catch(error => {
            showGlobalError('Error updating availability: ' + error.message);
            loadDishes(); // Reload to revert the toggle if there was an error
        });
    }

    function deleteDish(id) {
        if (!confirm("Are you sure you want to delete this dish?")) {
            return;
        }

        showProgressForFetch();
        fetch("../process/dishes.php?action=delete", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                showMessage('dishFormMessage', 'Dish deleted successfully!', 'success');
                loadDishes();
            } else {
                throw new Error(data.error || 'Error deleting dish');
            }
        })
        .catch(error => {
            showGlobalError('Error deleting dish: ' + error.message);
        });
    }

    function resetDishForm() {
        const form = document.getElementById("dishForm");
        form.reset();
        document.getElementById("dish_id").value = '';
        document.getElementById("dish_available").checked = true;

        // Clear all error states
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
            const errorMessage = group.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.textContent = '';
            }
        });
    }
    // -------------------- Orders Management --------------------
    async function loadOrders(status = 'all') {
        try {
            console.log(`Fetching active orders with status: ${status}`);
            
            const response = await fetch(`get_admin_active_orders.php${status !== 'all' ? `?status=${status}` : ''}`); // Use the new PHP file
            const result = await response.json();
            console.log('Orders Data:', result);
    
            if (result.success && result.data) {
                activeOrders = result.data;
                const ordersGrid = document.getElementById('ordersGrid');
                if (!ordersGrid) {
                    console.error('ordersGrid element not found');
                    return;
                }
                ordersGrid.innerHTML = result.data.length === 0 ? '<div class="no-data">No active orders found</div>' : '';
                
                for (const order of result.data) {
                    console.log('Rendering order:', order);
    
                    const prepResponse = await fetch(`../process/orders.php?action=get_order_preparation_status&orderId=${order.id}`);
                    const prepResult = await prepResponse.json();
                    let derivedStatus = 'processing';
                    if (prepResult.success) {
                        const hasPendingDishes = prepResult.data.some(dish => dish.preparation_status === 'pending');
                        derivedStatus = hasPendingDishes ? 'processing' : 'food_prepared';
                    }
    
                    const card = document.createElement('div');
                    card.className = 'order-card';
                    card.innerHTML = `
                        <div class="order-header">
                            <span class="order-id">Order #${order.id}</span>
                            <span class="status-badge status-${derivedStatus}">${formatStatus(derivedStatus)}</span>
                        </div>
                        <div class="order-details">
                            <div class="customer-info">
                                <i class="fas fa-user"></i>
                                <span>${order.customer_name || 'N/A'}</span>
                                <i class="fas fa-phone"></i>
                                <span>${order.phone_number || 'N/A'}</span>
                                <i class="fas fa-chair"></i>
                                <span>Table ${order.table_number || 'N/A'}</span>
                            </div>
                            <div class="order-footer">
                                <div class="total-amount-label">
                                    <span>Total Amount</span>
                                    <span>₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                </div>
                                <div class="order-actions">
                                    ${derivedStatus === 'processing' ? 
                                        `<button class="btn-action prepared" onclick="updateOrderStatus(${order.id}, 'food_prepared')">Mark Prepared</button>` : 
                                    derivedStatus === 'food_prepared' ? 
                                        `<button class="btn-action complete" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>` : ''}
                                    <button class="btn-action view-details" onclick="showDishDetails(${order.id})">
                                        <i class="fas fa-eye"></i> <span>View Details</span>
                                    </button>
                                </div>
                                <div class="order-time">
                                    <i class="fas fa-clock"></i>
                                    <span>Placed: ${formatDateTime(order.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    ordersGrid.appendChild(card);
                }
            } else {
                throw new Error('No data returned or success is false');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            showToast('Error loading orders: ' + error.message, 'error');
            const ordersGrid = document.getElementById('ordersGrid');
            if (ordersGrid) ordersGrid.innerHTML = '<div class="no-data">Error loading orders</div>';
        }
    }
    function createOrderRow(order, index) {
        const phoneDisplay = formatPhoneNumber(order.phone_number);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index}</td>
            <td>${order.id}</td>
            <td class="customer-info-cell">
                <div class="customer-card">
                    <div class="customer-header">
                        <div class="customer-avatar">
                            ${getCustomerInitial(order.customer_name)}
                        </div>
                        <div class="customer-name">${order.customer_name || 'Guest'}</div>
                    </div>
                    <div class="customer-details">
                        <div class="detail-item">
                            <i class="fas fa-phone"></i>
                            <span>${phoneDisplay}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-chair"></i>
                            <span>Table #${order.table_number}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td class="ordered-dishes-cell">${formatOrderedDishes(order.ordered_dishes)}</td>
            <td class="payment-info-cell">
                <div class="payment-card">
                    <div class="amount-section">
                        <span class="currency">₹</span>
                        <span class="amount">${parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>
                    <div class="payment-badge ${order.payment_method?.toLowerCase() || 'cash'}">
                        <i class="fas ${getPaymentIcon(order.payment_method)}"></i>
                        <span>${(order.payment_method || 'CASH').toUpperCase()}</span>
                    </div>
                </div>
            </td>
            <td class="status-col">
                <span class="status-badge status-${order.status}">
                    ${formatStatus(order.status)}
                </span>
            </td>
            <td class="action-col">
                ${getActionButtons(order)}
            </td>
        `;
        
        return row;
    }
    function getActionButtons(order) {
        switch(order.status) {
            case 'pending':
                return `
                    <button class="btn-action process" onclick="updateOrderStatus(${order.id}, 'processing')">
                        <i class="fas fa-utensils"></i> Process
                    </button>
                `;
            case 'processing':
                return `
                    <button class="btn-action prepare" onclick="updateOrderStatus(${order.id}, 'food_prepared')">
                        <i class="fas fa-check"></i> Mark Prepared
                    </button>
                `;
            case 'food_prepared':
                return `
                    <button class="btn-action complete" onclick="updateOrderStatus(${order.id}, 'completed')">
                        <i class="fas fa-flag-checkered"></i> Complete
                    </button>
                `;
            default:
                return '';
        }
    }

    async function updateOrderStatus(orderId, status) {
        try {
            let endpoint = '../process/orders.php?action=update';
            let payload = { id: orderId, status };

            if (status === 'food_prepared') {
                // Special handling for marking all dishes as prepared
                endpoint = '../chef_panel/mark_all_dishes_prepared.php';
                payload = { orderId };
            }

            console.log('Updating order status:', { orderId, status, endpoint }); // Debug: Log the request

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log('Update order status response:', result); // Debug: Log the response

            if (result.success) {
                showToast(`Order ${status} successfully`, 'success');
                console.log('Success toast shown:', `Order ${status} successfully`); // Debug: Log toast call
                loadOrders(); // Reload orders to reflect the updated status
            } else {
                // Log the error for debugging
                console.log('Error received from endpoint:', result.error);
                // Handle specific errors for better user feedback
                if (result.error === 'No pending dishes found for this order') {
                    showToast('No pending dishes to mark as prepared for this order.', 'error');
                    console.log('Error toast shown:', 'No pending dishes to mark as prepared for this order.'); // Debug: Log toast call
                } else {
                    showToast(`Failed to update order status: ${result.error || 'Unknown error'}`, 'error');
                    console.log('Generic error toast shown:', `Failed to update order status: ${result.error || 'Unknown error'}`); // Debug: Log toast call
                }
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            showToast(`Failed to update order status: ${error.message}`, 'error');
            console.log('Catch block error toast shown:', `Failed to update order status: ${error.message}`); // Debug: Log toast call
        }
    }
    // Similar update for completed orders

    async function loadCompletedOrders() {
        try {
            console.log('Fetching completed orders');
            const response = await fetch('../process/orders.php?action=get_completed');
            const result = await response.json();
            console.log('Completed Orders Data:', result); // Debug: Check full response
            if (result.success && result.data) {
                completedOrders = result.data; // Store completed orders
                const completedOrdersGrid = document.getElementById('completedOrdersGrid');
                if (!completedOrdersGrid) {
                    console.error('completedOrdersGrid element not found');
                    return;
                }
                completedOrdersGrid.innerHTML = result.data.length === 0 ? '<div class="no-data">No completed orders found</div>' : '';
                result.data.forEach(order => {
                    console.log('Rendering completed order:', order); // Debug: Check each order
                    const card = document.createElement('div');
                    card.className = 'order-card completed';
                    card.innerHTML = `
        <div class="order-header">
            <span class="order-id">Order #${order.id}</span>
            <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
        </div>
        <div class="order-details">
            <div class="customer-info">
                <i class="fas fa-user"></i>
                <span>${order.customer_name || 'N/A'}</span>
                <i class="fas fa-phone"></i>
                <span>${order.phone_number || 'N/A'}</span>
                <i class="fas fa-chair"></i>
                <span>Table ${order.table_number || 'N/A'}</span>
            </div>
            <div class="order-footer">
                <div class="total-amount-label">
                    <span>Total Amount</span>
                    <span>₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                </div>
                <div class="order-actions">
                    ${order.bill_generated ? 
                        '<span class="bill-generated">Bill Generated</span>' : 
                        `<button class="btn-action generate-bill" onclick="generateBill(${order.id})">Generate Bill</button>`}
                    <button class="btn-action view-details" onclick="showDishDetails(${order.id})">
                        <i class="fas fa-eye"></i> <span>View Details</span>
                    </button>
                </div>
                <div class="order-time">
                    <i class="fas fa-clock"></i>
                    <span>Placed: ${formatDateTime(order.created_at)}</span>
                </div>
            </div>
        </div>
    `;
                    completedOrdersGrid.appendChild(card);
                });
            } else {
                throw new Error('No data returned or success is false');
            }
        } catch (error) {
            console.error('Error loading completed orders:', error);
            showGlobalError('Error loading completed orders: ' + error.message);
            const completedOrdersGrid = document.getElementById('completedOrdersGrid');
            if (completedOrdersGrid) completedOrdersGrid.innerHTML = '<div class="no-data">Error loading orders</div>';
        }
    }
    function showDishDetails(orderId) {
        console.log('Showing details for order:', orderId);
        const allOrders = [...activeOrders, ...completedOrders];
        const order = allOrders.find(order => order && order.id === orderId);
        if (!order || !order.ordered_dishes) {
            console.error('Order or dishes not found for Order #', orderId);
            showToast('No dish details available for Order #' + orderId, 'error');
            return;
        }

        let modal = document.getElementById('dishDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dishDetailsModal';
            modal.className = 'dish-details-modal hidden';
            modal.innerHTML = `
                <div class="dish-details-content">
                    <h3>Dish Details for Order #${orderId}</h3>
                    <div id="dishDetailsContent" class="dish-details-list"></div>
                    <button class="btn-primary close-details" onclick="hideDishDetails()">Close</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const detailsContent = document.getElementById('dishDetailsContent');
        detailsContent.innerHTML = formatNewDishDetails(order.ordered_dishes);

        // Show modal and create overlay
        modal.classList.remove('hidden');
        let overlay = document.querySelector('.overlay');
        if (!overlay) {
            overlay = createOverlay();
        }
        overlay.classList.add('visible');

        // Add event listeners for overlay and escape key
        overlay.addEventListener('click', handleOverlayClick, { once: true });
        document.addEventListener('keydown', handleEscapeKey, { once: true });
    }

    function handleOverlayClick(event) {
        if (event.target.classList.contains('overlay')) {
            hideDishDetails();
        }
    }

    // New function to handle Escape key
    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            hideDishDetails();
        }
    }

    // Update hideDishDetails for a reliable close
    function hideDishDetails() {
        const modal = document.getElementById('dishDetailsModal');
        const overlay = document.querySelector('.overlay');
        
        if (modal) {
            modal.classList.add('hidden');
            // Remove modal from DOM for cleanup
            modal.remove();
        }
        
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.classList.add('hidden');
            
            // Ensure all styles are reset to remove blur and restore interactions
            document.body.style.overflow = 'auto';
            document.body.style.pointerEvents = 'auto';
            document.body.style.backdropFilter = 'none'; // Explicitly remove blur
            
            // Remove overlay after transition (match 0.3s transition duration)
            setTimeout(() => {
                if (overlay && overlay.parentNode) {
                    overlay.remove();
                }
            }, 300); // Match .overlay transition duration
        }

        // Remove event listeners to prevent memory leaks
        const existingOverlay = document.querySelector('.overlay');
        if (existingOverlay) {
            existingOverlay.removeEventListener('click', handleOverlayClick);
        }
        document.removeEventListener('keydown', handleEscapeKey);
    }
    function formatNewDishDetails(orderedDishes) {
        if (!orderedDishes) return '<p>No dishes available</p>';
        
        const sections = orderedDishes.split(' | ');
        const categoryMap = new Map();
        
        (async () => {
            for (const section of sections) {
                const [category, dishInfo] = section.includes(': ') ? section.split(': ') : ['Uncategorized', section];
                const quantityMatch = dishInfo.match(/\((\d+)(?: - NEW)?\)/);
                const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
                const nameMatch = dishInfo.match(/^(.*?)(?:\(|\$)/);
                const name = nameMatch ? nameMatch[1].trim() : dishInfo;
                let price = '$0.00'; // Default if no price found
                try {
                    price = await fetchDishPrice(name) || '$0.00';
                } catch (error) {
                    console.error('Error fetching price for:', name, error);
                }
                const isNew = dishInfo.includes(' - NEW');
                
                if (!categoryMap.has(category)) categoryMap.set(category, {});
                if (!categoryMap.get(category)[name]) {
                    categoryMap.get(category)[name] = { newCount: 0, oldCount: 0, price };
                }
                if (isNew) {
                    categoryMap.get(category)[name].newCount += quantity;
                } else {
                    categoryMap.get(category)[name].oldCount += quantity;
                }
            }

            let html = '<div class="dish-details-categories">';
            Array.from(categoryMap.entries()).forEach(([category, dishes]) => {
                html += `
                    <div class="dish-category-section">
                        <h4 class="dish-category-title">${category}</h4>
                        <div class="dish-items-container">`;
                
                for (const [name, counts] of Object.entries(dishes)) {
                    const totalCount = counts.newCount + counts.oldCount;
                    const priceNum = parseFloat(counts.price.replace('$', ''));
                    const totalPrice = (totalCount * priceNum).toFixed(2);
                    
                    html += `
                        <div class="dish-item-group">
                            <div class="dish-total">${totalCount}x ${name} (₹${totalPrice})</div>`;
                    
                    if (counts.newCount > 0) {
                        html += `
                            <div class="dish-breakdown">
                                <span class="dish-status new">${counts.newCount}x New One (₹${counts.newCount * priceNum.toFixed(2)})</span>
                            </div>`;
                    }
                    if (counts.oldCount > 0) {
                        html += `
                            <div class="dish-breakdown">
                                <span class="dish-status old">${counts.oldCount}x Already Prepared (₹${counts.oldCount * priceNum.toFixed(2)})</span>
                            </div>`;
                    }
                    html += `</div>`;
                }
                html += `
                        </div>
                    </div>`;
            });
            html += '</div>';

            const detailsContent = document.getElementById('dishDetailsContent');
            if (detailsContent) {
                detailsContent.innerHTML = html;
            }
        })();

        return ''; // Return empty string temporarily while async operations complete
    }
    // Optional: Add this function if prices need to be fetched from the server
    async function fetchDishPrice(dishName) {
        try {
            if (!dishCache) {
                const response = await fetch('../process/dishes.php?action=get_all');
                if (!response.ok) throw new Error('Failed to fetch dishes');
                const data = await response.json();
                dishCache = {};
                data.forEach(dish => {
                    dishCache[dish.name.toLowerCase()] = parseFloat(dish.price).toFixed(2);
                });
            }
            return dishCache[dishName.toLowerCase()] ? `$${dishCache[dishName.toLowerCase()]}` : '$0.00';
        } catch (error) {
            console.error('Error fetching dish price for:', dishName, error);
            return '₹0.00';
        }
    }


    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    async function generateBill(orderId) {
        try {
            console.log('Generating bill for orderId:', orderId); // Debug: Verify orderId
            const response = await fetch('../process/orders.php?action=generate_bill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderId }) // Explicitly name the key
            });
            const result = await response.json();
            console.log('Generate bill response:', result); // Debug: Check server response
            if (result.success) {
                showToast('Bill generated successfully', 'success');
                loadCompletedOrders(); // Refresh completed orders
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error generating bill:', error);
            showToast('Failed to generate bill: ' + error.message, 'error');
        }
    }
    // Helper function to format dates
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }







    // Helper function to get payment icon
    function getPaymentIcon(method) {
        switch(method.toLowerCase()) {
            case 'cash': return 'fa-money-bill-wave';
            case 'card': return 'fa-credit-card';
            case 'upi': return 'fa-mobile-alt';
            default: return 'fa-money-bill';
        }
    }

    // Helper function to get customer initial
    function getCustomerInitial(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    }
    // Function to format phone number
    function formatPhoneNumber(phone) {
        if (!phone || phone === 'undefisned' || phone === 'null') {
            return 'N/A';
        }
        
        // Remove any non-digit characters
        const cleaned = phone.toString().replace(/\D/g, '');
        
        // Check if it's a valid 10-digit number
        if (cleaned.length === 10) {
            return `+91 ${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        
        // If it's not 10 digits but has some numbers, just return the cleaned number
        if (cleaned.length > 0) {
            return cleaned;
        }
        
        return 'N/A';
    }









    function toggleDishDetails(button) {
        const detailsDiv = button.closest('.ordered-dishes').querySelector('.dishes-details');
        const isHidden = detailsDiv.classList.contains('hidden');
        
        detailsDiv.classList.toggle('hidden');
        button.textContent = isHidden ? 'Hide Details' : 'View Details';
    }
    // Table Management Functions
    function initializeTableManagement() {
        loadAdminTables();
    }

    async function loadAdminTables() {
        try {
            showLoading('adminTablesGrid');
            const response = await fetch('../process/get_tables.php');
            const data = await response.json();
            
            if (data.success) {
                renderAdminTables(data.data);
            } else {
                throw new Error(data.error || 'Failed to load tables');
            }
        } catch (error) {
            console.error('Error loading tables:', error);
            showGlobalError('Error loading tables: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    function renderAdminTables(tables) {
        const grid = document.getElementById('adminTablesGrid');
        if (!grid) return;

        grid.innerHTML = tables.map(table => `
            <div class="table-manage-card ${table.status}">
                <div class="table-header">
                    <h3>Table ${table.table_number}</h3>
                    <div class="table-status-badge ${table.status}">
                        ${formatStatus(table.status)}
                    </div>
                </div>
                <div class="table-info">
                    <p>Capacity: ${table.capacity} people</p>
                    ${table.current_customer ? 
                        `<p class="current-customer">Current: ${table.current_customer}</p>` : ''}
                </div>
                <div class="table-actions">
                    <button class="btn-edit" onclick="editTable(${table.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteTable(${table.id})"
                            ${table.status !== 'free' ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    async function addNewTable() {
        const capacity = await showPrompt('Enter table capacity:');
        if (!capacity) return;

        try {
            const response = await fetchWithErrorHandling('manage_tables.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add',
                    capacity: parseInt(capacity)
                })
            });

            if (response.success) {
                showToast('Table added successfully', 'success');
                loadAdminTables();
            }
        } catch (error) {
            showGlobalError('Error adding table: ' + error.message);
        }
    }

    async function editTable(tableId) {
        const table = await fetchWithErrorHandling(`../process/get_tables.php?id=${tableId}`);
        if (!table.success) return;

        const capacity = await showPrompt('Enter new capacity:', table.data.capacity);
        if (!capacity) return;

        try {
            const response = await fetchWithErrorHandling('manage_tables.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    id: tableId,
                    capacity: parseInt(capacity)
                })
            });

            if (response.success) {
                showToast('Table updated successfully', 'success');
                loadAdminTables();
            }
        } catch (error) {
            showGlobalError('Error updating table: ' + error.message);
        }
    }

    async function deleteTable(tableId) {
        if (!confirm('Are you sure you want to delete this table?')) return;

        try {
            const response = await fetchWithErrorHandling('manage_tables.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    id: tableId
                })
            });

            if (response.success) {
                showToast('Table deleted successfully', 'success');
                loadAdminTables();
            }
        } catch (error) {
            showGlobalError('Error deleting table: ' + error.message);
        }
    }

    // Updated formatOrderedDishes function with better error handling
    function formatOrderedDishes(orderedDishes) {
        if (!orderedDishes) return '<div class="no-dishes">No dishes</div>';
        
        try {
            const sections = orderedDishes.split(' | ');
            const categoryMap = new Map();
            let totalItems = 0;
            
            sections.forEach(section => {
                const [category, dishInfo] = section.includes(': ') ? section.split(': ') : ['Uncategorized', section];
                if (!categoryMap.has(category)) categoryMap.set(category, []);
                
                const quantityMatch = dishInfo.match(/\((\d+)(?: - NEW)?\)/);
                const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
                const name = dishInfo.split(' (')[0];
                const isNew = dishInfo.includes(' - NEW');
                
                totalItems += quantity;
                categoryMap.get(category).push({ name, quantity, isNew });
            });

            return `
                <div class="dishes-container">
                    <div class="dishes-summary">
                        <i class="fas fa-shopping-basket"></i>
                        <span>${totalItems} items</span>
                    </div>
                    <div class="dishes-list">
                        ${Array.from(categoryMap.entries()).map(([category, dishes]) => `
                            <div class="category-section">
                                <span class="category-name">${category}</span>
                                <ul>
                                    ${dishes.map(dish => `
                                        <li class="${dish.isNew ? 'new-dish' : ''}">
                                            <span class="dish-quantity">${dish.quantity}x</span>
                                            <span class="dish-name">${dish.name}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('Error formatting ordered dishes:', error);
            return `<div class="simple-order-display">${orderedDishes}</div>`;
        }
    }

    function markOrderAsCompleted(orderId) {
        if (!confirm("Mark this order as completed?")) return;

        showProgressForFetch();
        fetch("../process/orders.php?action=update", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: orderId, 
                status: "completed" 
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateProgress(100);
            if (data.success) {
                showMessage('ordersMessage', 'Order marked as completed!', 'success');
                loadOrders();
                loadCompletedOrders();
                loadPendingOrdersCount();
                loadCompletedOrdersCount();
            } else {
                throw new Error(data.error || 'Error updating order');
            }
        })
        .catch(error => {
            showGlobalError('Error updating order: ' + error.message);
        });
    }
    // -------------------- Statistics & Reports --------------------
    function loadPendingOrdersCount() {
        fetch("../process/orders.php?action=get_pending_count")
            .then(response => response.json())
            .then(data => {
                document.getElementById("pending-orders-count").textContent = data.pending_count || '0';
            })
            .catch(error => {
                console.error("Error loading pending count:", error);
                document.getElementById("pending-orders-count").textContent = '0';
            });
    }

    function loadCompletedOrdersCount() {
        fetch("../process/orders.php?action=get_completed_count")
            .then(response => response.json())
            .then(data => {
                document.getElementById("completed-orders-count").textContent = data.completed_count || '0';
            })
            .catch(error => {
                console.error("Error loading completed count:", error);
                document.getElementById("completed-orders-count").textContent = '0';
            });
    }

    function loadPopularDishes() {
        fetch("../process/orders.php?action=get_popular_dishes")
            .then(response => response.json())
            .then(data => {
                if (data.success && data.popular_dishes) {
                    const popularDishesList = document.getElementById("popular-dishes-list");
                    if (!popularDishesList) return;

                    // Clear existing list
                    popularDishesList.innerHTML = '';

                    // If there are no popular dishes
                    if (data.popular_dishes.length === 0) {
                        popularDishesList.innerHTML = `
                            <li class="dish-item">
                                <span class="dish-message">No popular dishes yet</span>
                            </li>`;
                        return;
                    }

                    // Add each popular dish to the list
                    data.popular_dishes.forEach((dish, index) => {
                        const li = document.createElement('li');
                        li.className = 'dish-item';
                        li.innerHTML = `
                            <span class="dish-rank">${index + 1}</span>
                            <span class="dish-name">${dish}</span>
                            <span class="dish-orders">${data.order_counts?.[index] || 0} orders</span>
                        `;
                        popularDishesList.appendChild(li);
                    });

                    // Update the last updated time
                    const updateTime = document.querySelector('.update-time');
                    if (updateTime) {
                        updateTime.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
                    }
                } else {
                    throw new Error(data.error || 'Failed to load popular dishes');
                }
            })
            .catch(error => {
                console.error("Error loading popular dishes:", error);
                const popularDishesList = document.getElementById("popular-dishes-list");
                if (popularDishesList) {
                    popularDishesList.innerHTML = `
                        <li class="dish-item">
                            <span class="dish-message error">Error loading popular dishes</span>
                        </li>`;
                }
            });
    }

    let currentReportType = 'daily';

    function changeReportType() {
        const select = document.getElementById('reportType');
        currentReportType = select.value;
        loadReports(currentReportType);
    }
    
    function loadReports(reportType = currentReportType, period = null) {
        const reportContent = document.getElementById('reportContent');
        
        reportContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Loading ${reportType} report...
            </div>
        `;
    
        console.log(`Loading ${reportType} report with period: ${period}`);
    
        let url = `../admin_panel/reports.php?type=${reportType}`;
        if (period) {
            url += `&period=${period}`;
        }
    
        fetch(url)
            .then(async response => {
                console.log('Response status:', response.status);
                const text = await response.text();
                console.log('Response text:', text);
                
                try {
                    const data = JSON.parse(text);
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to load report');
                    }
                    return data;
                } catch (e) {
                    throw new Error(`Invalid JSON response: ${text}`);
                }
            })
            .then(response => {
                if (!response.success) {
                    throw new Error(response.error || 'Failed to load report');
                }
    
                let reportHTML = `
                    <div class="report-header">
                        <h3>${reportType === 'daily' ? 'Daily' : 'Monthly'} Sales Report</h3>
                        <p class="report-date">Generated: ${new Date().toLocaleString()}</p>
                    </div>`;
    
                let chartData = null;
    
                if (reportType === 'daily' && response.data) {
                    if (response.summary) {
                        reportHTML += `
                            <div class="report-summary">
                                <h4>Summary</h4>
                                <div class="summary-grid">
                                    <div class="summary-item">
                                        <span>Total Orders: ${response.summary.total_orders}</span>
                                    </div>
                                    <div class="summary-item">
                                        <span>Total Revenue: ₹${parseFloat(response.summary.total_revenue).toFixed(2)}</span>
                                    </div>
                                    <div class="summary-item">
                                        <span>Avg Daily Revenue: ₹${parseFloat(response.summary.avg_daily_revenue).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>`;
                    }
    
                    reportHTML += `<div class="report-entries">`;
                    response.data.forEach(entry => {
                        reportHTML += `
                            <div class="report-entry">
                                <div class="report-row">
                                    <span>Date: ${entry.date}</span>
                                    <span>Orders: ${entry.total_orders}</span>
                                    <span>Revenue: ₹${parseFloat(entry.revenue).toFixed(2)}</span>
                                </div>
                            </div>`;
                    });
                    reportHTML += `</div>`;
    
                    chartData = {
                        labels: response.data.map(entry => entry.date),
                        datasets: [{
                            label: 'Revenue',
                            data: response.data.map(entry => parseFloat(entry.revenue)),
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    };
                    reportHTML += `
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>`;
                } else if (reportType === 'monthly' && response.monthly_data) {
                    reportHTML += `<div class="report-entries">`;
                    response.monthly_data.forEach(entry => {
                        reportHTML += `
                            <div class="report-entry">
                                <div class="report-row">
                                    <span>Month: ${entry.month}</span>
                                    <span>Orders: ${entry.total_orders}</span>
                                    <span>Revenue: ₹${parseFloat(entry.revenue).toFixed(2)}</span>
                                </div>
                            </div>`;
                    });
                    reportHTML += `</div>`;
    
                    chartData = {
                        labels: response.monthly_data.map(entry => entry.month),
                        datasets: [{
                            label: 'Revenue',
                            data: response.monthly_data.map(entry => parseFloat(entry.revenue)),
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    };
                    reportHTML += `
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>`;
                } else {
                    reportHTML += `<div class="error-message">No data available for the selected report type.</div>`;
                }
    
                reportContent.innerHTML = reportHTML;
    
                if (chartData) {
                    if (window.myChart) window.myChart.destroy();
                    const ctx = document.getElementById('salesChart')?.getContext('2d');
                    if (ctx) {
                        window.myChart = new Chart(ctx, {
                            type: 'bar',
                            data: chartData,
                            options: {
                                scales: { y: { beginAtZero: true } },
                                plugins: { legend: { position: 'top' } }
                            }
                        });
                    } else {
                        console.error('Canvas element for salesChart not found.');
                    }
                }
            })
            .catch(error => {
                console.error('Error in loadReports:', error);
                reportContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        ${error.message}
                    </div>`;
            });
    }
    
    function loadReportsByDate() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const reportContent = document.getElementById('reportContent');
    
        if (!startDate || !endDate) {
            showToast('Please select both start and end dates', 'error');
            return;
        }
    
        reportContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Loading custom report...
            </div>
        `;
    
        fetch(`../admin_panel/reports.php?type=${currentReportType}&start_date=${startDate}&end_date=${endDate}`)
            .then(async response => {
                console.log('Response status:', response.status);
                const text = await response.text();
                console.log('Response text:', text);
                const data = JSON.parse(text);
                if (!response.ok) throw new Error(data.error || 'Failed to load report');
                return data;
            })
            .then(response => {
                if (!response.success) throw new Error(response.error || 'Failed to load report');
    
                let reportHTML = `
                    <div class="report-header">
                        <h3>${currentReportType === 'daily' ? 'Daily' : 'Monthly'} Sales Report (Custom)</h3>
                        <p class="report-date">Generated: ${new Date().toLocaleString()}</p>
                        <p>Period: ${startDate} to ${endDate}</p>
                    </div>`;
    
                let chartData = null;
    
                if (currentReportType === 'daily' && response.data) {
                    reportHTML += `<div class="report-entries">`;
                    response.data.forEach(entry => {
                        reportHTML += `
                            <div class="report-entry">
                                <div class="report-row">
                                    <span>Date: ${entry.date}</span>
                                    <span>Orders: ${entry.total_orders}</span>
                                    <span>Revenue: ₹${parseFloat(entry.revenue).toFixed(2)}</span>
                                </div>
                            </div>`;
                    });
                    reportHTML += `</div>`;
    
                    chartData = {
                        labels: response.data.map(entry => entry.date),
                        datasets: [{
                            label: 'Revenue',
                            data: response.data.map(entry => parseFloat(entry.revenue)),
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    };
                    reportHTML += `
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>`;
                } else if (currentReportType === 'monthly' && response.monthly_data) {
                    reportHTML += `<div class="report-entries">`;
                    response.monthly_data.forEach(entry => {
                        reportHTML += `
                            <div class="report-entry">
                                <div class="report-row">
                                    <span>Month: ${entry.month}</span>
                                    <span>Orders: ${entry.total_orders}</span>
                                    <span>Revenue: ₹${parseFloat(entry.revenue).toFixed(2)}</span>
                                </div>
                            </div>`;
                    });
                    reportHTML += `</div>`;
    
                    chartData = {
                        labels: response.monthly_data.map(entry => entry.month),
                        datasets: [{
                            label: 'Revenue',
                            data: response.monthly_data.map(entry => parseFloat(entry.revenue)),
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    };
                    reportHTML += `
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>`;
                } else {
                    reportHTML += `<div class="error-message">No data available for the selected report type.</div>`;
                }
    
                reportContent.innerHTML = reportHTML;
    
                if (chartData) {
                    if (window.myChart) window.myChart.destroy();
                    const ctx = document.getElementById('salesChart')?.getContext('2d');
                    if (ctx) {
                        window.myChart = new Chart(ctx, {
                            type: 'bar',
                            data: chartData,
                            options: {
                                scales: { y: { beginAtZero: true } },
                                plugins: { legend: { position: 'top' } }
                            }
                        });
                    } else {
                        console.error('Canvas element for salesChart not found.');
                    }
                }
            })
            .catch(error => {
                console.error('Error in loadReportsByDate:', error);
                reportContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        ${error.message}
                    </div>`;
            });
    }
    
    function exportReport(reportType, format) {
        showLoadingOverlay();
        
        fetch(`../admin_panel/reports.php?action=export&type=${reportType}&format=${format}`)
            .then(response => {
                if (!response.ok) throw new Error('Export failed');
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${reportType}_report.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(error => {
                showGlobalError('Error exporting report: ' + error.message);
            })
            .finally(() => {
                hideLoadingOverlay();
            });
    }

    // Add this notification initialization function
    function initializeNotifications() {
        console.log("Initializing notifications...");
        
        let lastCheckTime = document.getElementById("lastCheckTime")?.value || "";
        const notificationEl = document.getElementById("newOrderNotification");
        const newOrderCountEl = document.getElementById("newOrderCount");
        const notificationBadgeEl = document.querySelector(".notification-badge");
        const notificationSound = new Audio("../sounds/2.mp3");
        const overdueSound = new Audio("../sounds/3.mp3"); // Add a different sound for overdue orders
        const checkInterval = 5000; // Check every 5 seconds
        let isNotificationVisible = false;
        let lastNewOrderCount = 0; // Track previous new order count
        let notifiedOrders = new Set(); // Track notified overdue orders

        function updateNotificationBadges(count) {
            if (newOrderCountEl) newOrderCountEl.textContent = count;
            if (notificationBadgeEl) notificationBadgeEl.textContent = count;
            if (count > 0) {
                if (newOrderCountEl) newOrderCountEl.style.display = 'inline-block';
                if (notificationBadgeEl) notificationBadgeEl.style.display = 'inline-block';
            } else {
                if (newOrderCountEl) newOrderCountEl.style.display = 'none';
                if (notificationBadgeEl) notificationBadgeEl.style.display = 'none';
            }
        }

        async function checkForNewOrders() {
            try {
                const response = await fetch('../process/orders.php?action=check_new_orders', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: `last_check=${encodeURIComponent(lastCheckTime)}`
                });

                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();

                if (data.new_orders_count > 0 && data.new_orders_count > lastNewOrderCount) {
                    updateNotificationBadges(data.new_orders_count);

                    if (!isNotificationVisible) {
                        try {
                            await notificationSound.play();
                        } catch (e) {
                            console.log('Error playing new order sound:', e);
                        }
                        
                        if (notificationEl) {
                            notificationEl.classList.add('visible');
                            isNotificationVisible = true;
                            setTimeout(() => {
                                notificationEl.classList.remove('visible');
                                isNotificationVisible = false;
                            }, 5000);
                        }

                        if (!document.getElementById('manage-orders')?.classList.contains('hidden')) {
                            loadOrders();
                        }
                    }
                }
                lastNewOrderCount = data.new_orders_count;

                // Check for overdue orders
                const activeOrdersResponse = await fetch('../process/orders.php?action=get_active_orders');
                const activeOrdersData = await activeOrdersResponse.json();
                if (activeOrdersData.success && activeOrdersData.data) {
                    activeOrdersData.data.forEach(order => {
                        const orderTime = new Date(order.created_at);
                        const now = new Date();
                        const timeDiff = (now - orderTime) / (1000 * 60); // Minutes
                        if ((order.status === 'processing' || order.status === 'food_prepared') && 
                            timeDiff > 30 && !notifiedOrders.has(order.id)) {
                            try {
                                overdueSound.play();
                                showToast(`Order #${order.id} is overdue (>30 min)`, 'error');
                                notifiedOrders.add(order.id);
                            } catch (e) {
                                console.log('Error playing overdue sound:', e);
                            }
                        }
                    });
                }

                lastCheckTime = data.current_time;
                const lastCheckInput = document.getElementById("lastCheckTime");
                if (lastCheckInput) lastCheckInput.value = lastCheckTime;
            } catch (error) {
                console.error("Error checking for new orders:", error);
                updateNotificationBadges(0);
            }
        }

    // Clear notifications when clicking the bell icon
        notificationEl?.addEventListener('click', () => {
            updateNotificationBadges(0);
            notificationEl.classList.remove('visible');
            isNotificationVisible = false;
        });

        // Initial check for new orders
        checkForNewOrders();

        // Poll for new orders at intervals
        setInterval(checkForNewOrders, checkInterval);
    }
    // Updated searchOrders function with better error handling
    function searchOrders() {
        console.log("Searching orders...");
        const searchQuery = document.getElementById("orderSearch").value.trim();
        
        // Search in Manage Orders (active orders)
        const ordersGrid = document.getElementById('ordersGrid');
        if (!ordersGrid) {
            console.error("ordersGrid element not found");
            return;
        }
        ordersGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

        // Search in Completed Orders
        const completedOrdersGrid = document.getElementById('completedOrdersGrid');
        if (!completedOrdersGrid) {
            console.error("completedOrdersGrid element not found");
            return;
        }
        completedOrdersGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

        if (!searchQuery) {
            loadOrders();
            loadCompletedOrders();
            return;
        }

        fetchData(`../process/orders.php?action=search&query=${encodeURIComponent(searchQuery)}`)
            .then(response => {
                // Filter active orders (not completed)
                const activeOrders = response.data.filter(order => order.status !== 'bill_generated');
                ordersGrid.innerHTML = activeOrders.length === 0 ? '<div class="no-data">No matching active orders found</div>' : '';
                activeOrders.forEach(order => {
                    const card = document.createElement("div");
                    card.className = 'order-card';
                    card.innerHTML = `
                        <div class="order-header">
                            <span class="order-id">Order #${order.id}</span>
                            <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
                        </div>
                        <div class="order-details">
                            <div class="customer-info">
                                <i class="fas fa-user"></i>
                                <span>${order.customer_name || 'N/A'}</span>
                                <i class="fas fa-phone"></i>
                                <span>${order.phone_number || 'N/A'}</span>
                                <i class="fas fa-chair"></i>
                                <span>Table ${order.table_number || 'N/A'}</span>
                            </div>
                            <div class="order-footer">
                                <span class="total-amount">₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                <div class="order-actions">
                                    ${order.status === 'pending' ? 
                                        `<button class="btn-action process" onclick="updateOrderStatus(${order.id}, 'processing')">Process</button>` : 
                                    order.status === 'processing' ? 
                                        `<button class="btn-action prepared" onclick="updateOrderStatus(${order.id}, 'food_prepared')">Mark Prepared</button>` : 
                                    order.status === 'food_prepared' ? 
                                        `<button class="btn-action complete" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                    ordersGrid.appendChild(card);
                });

                // Filter completed orders
                const completedOrders = response.data.filter(order => order.status === 'bill_generated');
                completedOrdersGrid.innerHTML = completedOrders.length === 0 ? '<div class="no-data">No matching completed orders found</div>' : '';
                completedOrders.forEach(order => {
                    const card = document.createElement("div");
                    card.className = 'order-card completed';
                    card.innerHTML = `
                        <div class="order-header">
                            <span class="order-id">Order #${order.id}</span>
                            <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
                        </div>
                        <div class="order-details">
                            <div class="customer-info">
                                <i class="fas fa-user"></i>
                                <span>${order.customer_name || 'N/A'}</span>
                                <i class="fas fa-phone"></i>
                                <span>${order.phone_number || 'N/A'}</span>
                                <i class="fas fa-chair"></i>
                                <span>Table ${order.table_number || 'N/A'}</span>
                            </div>
                            <div class="order-footer">
                                <span class="total-amount">₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                <div class="order-actions">
                                    ${order.bill_generated ? 
                                        '<span class="bill-generated">Bill Generated</span>' : 
                                        `<button class="btn-action generate-bill" onclick="generateBill(${order.id})">Generate Bill</button>`}
                                </div>
                            </div>
                        </div>
                    `;
                    completedOrdersGrid.appendChild(card);
                });
            })
            .catch(error => {
                console.error("Error searching orders:", error);
                ordersGrid.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> Error searching orders</div>';
                completedOrdersGrid.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> Error searching orders</div>';
            });
    }

    let revenueChart;
    let resetTimer;
    function showNoRevenueMessage(message) {
        const popup = document.getElementById('noRevenueMessage');
        const overlay = document.querySelector('.overlay');
        const messageText = document.getElementById('noRevenueText');
        
        if (!popup || !overlay || !messageText) return;
        
        // Update message text
        messageText.textContent = message;
        
        // Remove hidden class and force reflow
        popup.classList.remove('hidden');
        overlay.classList.remove('hidden');
        
        // Force reflow
        void popup.offsetWidth;
        
        // Add visible class
        popup.classList.add('visible');
        overlay.classList.add('visible');
        popup.classList.add('shake');
        
        // Auto close after 3 seconds
        setTimeout(() => {
            closeNoRevenuePopup();
        }, 3000);
    }


    function closeNoRevenuePopup() {
        const popup = document.getElementById('noRevenueMessage');
        const overlay = document.querySelector('.overlay');
        
        if (!popup || !overlay) return;
        
        // Remove visible classes
        popup.classList.remove('visible');
        overlay.classList.remove('visible');
        
        // Wait for transition before adding hidden
        setTimeout(() => {
            popup.classList.add('hidden');
            overlay.classList.add('hidden');
            popup.classList.remove('shake');
            
            // Reset the popup shown flag when we close the popup
            loadRevenueStats.popupShown = false;
        }, 300);
    }

    function createOverlay() {
        let overlay = document.querySelector('.overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function resetToDaily() {
        const revenueFilter = document.getElementById('revenueStatsFilter');
        revenueFilter.value = 'day';
        handleTimeframeChange('day');
    }

    function initializeYearSelector() {
        const yearSelect = document.getElementById('yearPicker');
        const currentYear = new Date().getFullYear();
        // Show last 5 years
        for(let year = currentYear; year >= currentYear - 4; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    }

    function handleTimeframeChange(timeframe) {
        document.getElementById('monthSelector').classList.add('hidden');
        document.getElementById('yearSelector').classList.add('hidden');
        
        clearTimeout(resetTimer); // Clear existing timer
        
        switch(timeframe) {
            case 'month':
                document.getElementById('monthSelector').classList.remove('hidden');
                loadRevenueStats('month', document.getElementById('monthPicker').value);
                break;
            case 'year':
                document.getElementById('yearSelector').classList.remove('hidden');
                loadRevenueStats('year', document.getElementById('yearPicker').value);
                break;
            default:
                loadRevenueStats('day');
                break;
        }
    }
    async function loadRevenueStats(timeframe = 'day', selectedDate = null) {
        try {
            clearTimeout(resetTimer); // Clear any existing timer
            
            // Track popup state with date to limit to once per day
            if (!loadRevenueStats.popupShownToday) {
                loadRevenueStats.popupShownToday = localStorage.getItem('lastRevenuePopupDate') === new Date().toDateString();
            }
            
            let url = `../process/orders.php?action=get_revenue_stats&timeframe=${timeframe}`;
            if (selectedDate) {
                url += `&selected_date=${selectedDate}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch revenue statistics');
            
            const data = await response.json();
            
            // Reset popup flag when we have revenue
            if (data.total_revenue && data.total_revenue > 0) {
                loadRevenueStats.popupShownToday = false;
                localStorage.removeItem('lastRevenuePopupDate');
            }

            // Check for no revenue condition
            if (!data.total_revenue || data.total_revenue === 0 || !data.chart_data || data.chart_data.length === 0) {
                if (!loadRevenueStats.popupShownToday && timeframe === 'day') {
                    let message = '';
                    const monthPicker = document.getElementById('monthPicker');
                    const yearPicker = document.getElementById('yearPicker');
                    
                    switch(timeframe) {
                        case 'month':
                            const selectedMonth = monthPicker ? 
                                new Date(monthPicker.value).toLocaleString('default', { month: 'long', year: 'numeric' }) : 
                                'selected month';
                            message = `No revenue data found for ${selectedMonth}`;
                            break;
                        case 'year':
                            message = `No revenue data found for year ${yearPicker ? yearPicker.value : 'selected year'}`;
                            break;
                        default:
                            message = "No revenue data found for today";
                    }
                    
                    showNoRevenueMessage(message);
                    loadRevenueStats.popupShownToday = true;
                    localStorage.setItem('lastRevenuePopupDate', new Date().toDateString());
                }
                
                // Reset summary cards to zero
                document.getElementById('total-revenue').textContent = '₹0';
                document.getElementById('avg-revenue').textContent = '₹0';
                document.getElementById('order-count').textContent = '0';
                
                // Clear existing chart
                if (revenueChart) {
                    revenueChart.destroy();
                    revenueChart = null;
                }
                
                return;
            }
            
            // Update summary cards with data
            document.getElementById('total-revenue').textContent = 
                `₹${parseFloat(data.total_revenue).toLocaleString('en-IN')}`;
            document.getElementById('avg-revenue').textContent = 
                `₹${parseFloat(data.average_revenue).toLocaleString('en-IN')}`;
            document.getElementById('order-count').textContent = 
                data.total_orders.toLocaleString('en-IN');
            
            // Update chart
            updateRevenueChart(data.chart_data, timeframe);
            
            // Set timer to reset to daily view after 30 seconds if not in daily view
            if (timeframe !== 'day') {
                resetTimer = setTimeout(() => {
                    const revenueFilter = document.getElementById('revenueStatsFilter');
                    if (revenueFilter) {
                        revenueFilter.value = 'day';
                        handleTimeframeChange('day');
                    }
                }, 30000); // 30 seconds
            }
            
        } catch (error) {
            console.error('Error loading revenue statistics:', error);
            showGlobalError(`Error loading revenue statistics: ${error.message}`);
            
            // Reset values on error
            document.getElementById('total-revenue').textContent = '₹0';
            document.getElementById('avg-revenue').textContent = '₹0';
            document.getElementById('order-count').textContent = '0';
            
            if (revenueChart) {
                revenueChart.destroy();
                revenueChart = null;
            }
        }
    }

    function updateRevenueChart(chartData, timeframe) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        const labels = chartData.map(item => item.label);
        const revenues = chartData.map(item => item.revenue);
        
        let tooltipTitle = '';
        switch(timeframe) {
            case 'day':
                tooltipTitle = 'Daily Revenue';
                break;
            case 'month':
                tooltipTitle = 'Monthly Revenue';
                break;
            case 'year':
                tooltipTitle = 'Yearly Revenue';
                break;
        }
        
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: tooltipTitle,
                    data: revenues,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Revenue: ₹${context.raw.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }
    // Modified initialization
    document.addEventListener("DOMContentLoaded", async () => {
        console.log("DOM Content Loaded");
        
        try {
            // Load initial data one by one to better track issues
            await loadCategories();
            console.log("Categories loaded successfully");
            
            await loadCategoriesForSelect();
            console.log("Categories for select loaded successfully");
            
            await loadDishes();
            console.log("Dishes loaded successfully");
            
            await loadOrders();
            console.log("Orders loaded successfully");
            
            await loadCompletedOrders();
            console.log("Completed orders loaded successfully");
            
            await loadPendingOrdersCount();
            console.log("Pending count loaded successfully");
            
            await loadCompletedOrdersCount();
            console.log("Completed count loaded successfully");
            
            await loadPopularDishes();
            console.log("Popular dishes loaded successfully");
            await loadPaymentStats();
            console.log("Payment statistics loaded successfully");
            await loadBillDetails();
            console.log("Bill details loaded successfully");

            await loadTodayRevenue(); // Added this line
            console.log("Today's revenue loaded successfully");

            // Initialize other functionality
            initializeNotifications();
            console.log("Notifications initialized");
            
            // Set up event listeners
            setupEventListeners();
            console.log("Event listeners set up");
        
            setupAutoRefresh();
            console.log("Auto-refresh setup completed");

            initializeUI();
        console.log("UI initialized with new toggle menu");
            
            console.log("Initialization completed successfully");

        } catch (error) {
            console.error("Error during initialization:", error);
            showGlobalError("Error initializing application: " + error.message);
        }
    });


    // Add event listeners when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
    // Initialize popup close button
    const closePopupBtn = document.querySelector('.close-popup');
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeNoRevenuePopup();
            
        });
    }
        // Close popup when clicking overlay
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeNoRevenuePopup();
                }
            });
            }

        // Close popup with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeNoRevenuePopup();
            }
        });
        
        // Initialize revenue stats filter
        const revenueFilter = document.getElementById('revenueStatsFilter');
        if (revenueFilter) {
            revenueFilter.addEventListener('change', (e) => {
                handleTimeframeChange(e.target.value);
            });
        }
    });

    function setupEventListeners() {
        // Remove click event delegation for expand buttons (old dish details)
        // No changes needed here since we’ll remove toggleOrderDetails later

        // Setup search input with error handling
        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            console.log("Setting up search input listener");
            const debouncedSearch = debounce(searchOrders, 300);
            searchInput.addEventListener('input', () => {
                try {
                    debouncedSearch();
                } catch (error) {
                    console.error("Error in search handler:", error);
                    showGlobalError("Error performing search: " + error.message);
                }
            });
        } else {
            console.warn("Search input element not found");
        }
    }
    function searchBillDetails() {
        console.log("Searching bill details...");
        const searchQuery = document.getElementById("billSearch").value.trim();
        
        const billDetailsGrid = document.getElementById('billDetailsGrid');
        if (!billDetailsGrid) {
            console.error("billDetailsGrid element not found");
            return;
        }
        billDetailsGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

        if (!searchQuery) {
            loadBillDetails();
            return;
        }

        fetchData(`../process/orders.php?action=search&query=${encodeURIComponent(searchQuery)}`)
            .then(response => {
                const billedOrders = response.data.filter(order => 
                    order.status === 'completed' && order.bill_generated
                );
                billDetailsGrid.innerHTML = billedOrders.length === 0 ? 
                    '<div class="no-data">No matching billed orders found</div>' : '';
                billedOrders.forEach(order => {
                    const card = document.createElement("div");
                    card.className = 'order-card';
                    card.innerHTML = `
                        <div class="order-header">
                            <span class="order-id">Order #${order.id}</span>
                            <span class="status-badge status-completed">Completed</span>
                        </div>
                        <div class="order-details">
                            <div class="customer-info">
                                <i class="fas fa-user"></i>
                                <span>${order.customer_name || 'N/A'}</span>
                                <i class="fas fa-phone"></i>
                                <span>${order.phone_number || 'N/A'}</span>
                                <i class="fas fa-chair"></i>
                                <span>Table ${order.table_number || 'N/A'}</span>
                            </div>
                            <div class="order-footer">
                                <div class="total-amount-label">
                                    <span>Total Amount</span>
                                    <span>₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                </div>
                                <div class="order-actions">
                                    <button class="btn-action print-bill" onclick="printBill(${order.id})">
                                        <i class="fas fa-print"></i> <span>Print Bill</span>
                                    </button>
                                </div>
                                <div class="order-time">
                                    <i class="fas fa-clock"></i>
                                    <span>Placed: ${formatDateTime(order.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    billDetailsGrid.appendChild(card);
                });
            })
            .catch(error => {
                console.error("Error searching bill details:", error);
                billDetailsGrid.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> Error searching bills</div>';
            });
    }


    function loadTodayRevenue() {
        fetch("../process/orders.php?action=get_today_revenue")
            .then(response => response.json())
            .then(data => {
                const revenueElement = document.getElementById("today-revenue");
                // Format the revenue with ₹ symbol and proper formatting
                const formattedRevenue = data.revenue ? 
                    `₹${parseFloat(data.revenue).toLocaleString('en-IN')}` : 
                    '₹0';
                revenueElement.textContent = formattedRevenue;
            })
            .catch(error => {
                console.error("Error loading today's revenue:", error);
                document.getElementById("today-revenue").textContent = '₹0';
            });
    }

    function initializeUI() {
        // Initialize new toggle menu
        const menuToggle = document.querySelector('.new-menu-toggle');
        const toggleMenu = document.querySelector('.new-toggle-menu');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && toggleMenu) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
                menuToggle.setAttribute('aria-expanded', !expanded);
                toggleMenu.classList.toggle('active');
                if (toggleMenu.classList.contains('active')) {
                    toggleMenu.classList.remove('hidden'); // Remove hidden when active
                } else {
                    toggleMenu.classList.add('hidden'); // Add hidden when inactive
                }
                sidebar.classList.toggle('active');
                console.log('New toggle menu clicked, active:', !expanded, 'Menu classList:', toggleMenu.classList); // Debug
            });

            // Close toggle menu and sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 767 && 
                    !sidebar.contains(e.target) && 
                    !menuToggle.contains(e.target) && 
                    !toggleMenu.contains(e.target)) {
                    menuToggle.setAttribute('aria-expanded', 'false');
                    toggleMenu.classList.remove('active');
                    toggleMenu.classList.add('hidden'); // Ensure hidden on outside click
                    sidebar.classList.remove('active');
                    console.log('Clicked outside, closing new menu'); // Debug
                }
            });
        } else {
            console.warn('new-menu-toggle or new-toggle-menu not found in DOM'); // Debug if elements are missing
        }
        
        // Initialize search functionality
        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(searchOrders, 300));
        }
        
        // Initialize profile dropdown
        const userProfile = document.querySelector('.user-profile');
        const profileDropdown = userProfile?.querySelector('.profile-dropdown');
        
        userProfile?.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown?.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            profileDropdown?.classList.add('hidden');
        });
    }

    function navigateToPanel(panel) {
        let url = '';
        switch (panel) {
            case 'waiter':
                url = '../captain_panel/captain_panel.php'; // Update with actual waiter panel URL
                break;
            case 'chef':
                url = '../chef_panel/chef_panel.php'; // Update with actual chef panel URL
                break;
                case 'waiter':
                    url = '../waiter_panel/waiter_panel.php'; // Update with actual chef panel URL
                    break;
            default:
                url = '#';
        }
        window.location.href = url; // Navigate to the panel URL
    }

    function loadInitialData() {
        loadDishes();
        loadOrders();
        loadCompletedOrders();
        loadPendingOrdersCount();
        loadCompletedOrdersCount();
        loadPopularDishes();
        loadCategories();
        loadCategoriesForSelect();
    }



    // Payment Statistics Functions
    async function loadPaymentStats(timeframe = 'today') {
        try {
            console.log('Fetching payment stats for timeframe:', timeframe);
            const response = await fetch(`../process/orders.php?action=get_payment_stats&timeframe=${timeframe}`);
            if (!response.ok) throw new Error('Failed to fetch payment statistics');
            
            const data = await response.json();
            console.log('Received payment stats data:', data);
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load payment statistics');
            }
            
            // Update only the counters
            document.getElementById('cash-payment-count').textContent = data.data.cash_count || 0;
            document.getElementById('upi-payment-count').textContent = data.data.upi_count || 0;
            document.getElementById('card-payment-count').textContent = data.data.card_count || 0;
            
        } catch (error) {
            console.error('Error loading payment statistics:', error);
            showGlobalError('Error loading payment statistics');
        }
    }


    document.addEventListener('DOMContentLoaded', async () => {
        // Add table management section to page load
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Load tables initially
        await loadAdminTables();
    });
    const styles = `
    .table-manage-card {
        background: white;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border: 1px solid #e5e7eb;
    }

    .table-manage-card.booked {
        border-left: 4px solid #ef4444;
    }

    .table-manage-card.free {
        border-left: 4px solid #10b981;
    }

    .table-manage-card.reserved {
        border-left: 4px solid #f59e0b;
    }

    .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .table-status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .table-status-badge.free {
        background: #d1fae5;
        color: #065f46;
    }

    .table-status-badge.booked {
        background: #fee2e2;
        color: #991b1b;
    }

    .table-status-badge.reserved {
        background: #fef3c7;
        color: #92400e;
    }

    .table-info {
        margin-bottom: 1rem;
    }

    .table-actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn-edit, .btn-delete {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        transition: all 0.2s;
    }

    .btn-edit {
        background: #2563eb;
        color: white;
    }

    .btn-delete {
        background: #ef4444;
        color: white;
    }

    .btn-edit:hover, .btn-delete:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .btn-delete:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }

    #adminTablesGrid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .current-customer {
        color: #6b7280;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }
    `;

    // Add event listener for filter changes
    document.addEventListener('DOMContentLoaded', function() {
        const filterSelect = document.getElementById('paymentStatsFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', function(e) {
                loadPaymentStats(e.target.value);
            });
        }
        loadPaymentStats('today');

        initializeYearSelector();
        
        const revenueFilter = document.getElementById('revenueStatsFilter');
        const monthPicker = document.getElementById('monthPicker');
        const yearPicker = document.getElementById('yearPicker');
        
        // Set default month to current month
        monthPicker.value = new Date().toISOString().slice(0, 7);
        
        revenueFilter.addEventListener('change', (e) => {
            handleTimeframeChange(e.target.value);
        });
        
        monthPicker.addEventListener('change', () => {
            loadRevenueStats('month', monthPicker.value);
        });
        
        yearPicker.addEventListener('change', () => {
            loadRevenueStats('year', yearPicker.value);
        });

        
        // Initial load
        loadRevenueStats('day');
        initializeTableManagement();
    });

    function setupAutoRefresh() {
        setInterval(loadOrders, 20000); // Every 20 seconds
        setInterval(loadPendingOrdersCount, 10000); // Every 10 seconds
        setInterval(loadCompletedOrdersCount, 10000); // Every 10 seconds
        setInterval(loadTodayRevenue, 10000); // Every 10 seconds
        setInterval(() => loadPaymentStats(document.getElementById('paymentStatsFilter')?.value || 'today'), 30000);
        setInterval(() => loadRevenueStats(document.getElementById('revenueStatsFilter')?.value || 'day'), 30000);
        setInterval(updateActiveOrdersList, 5000); // Add this to refresh the Active Orders modal every 5 seconds
    }


    function showDialog(title, content, actions) {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <h3>${title}</h3>
            <div class="dialog-content">${content}</div>
            <div class="form-actions">${actions}</div>
        `;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        return dialog;
    }