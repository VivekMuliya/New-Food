<?php
session_start();

// Redirect if not logged in or not a captain
if (!isset($_SESSION['user_id'])) {
    header("Location: ../auth/auth_login.php");
    exit();
}

if ($_SESSION['role'] !== 'captain') {
    header("Location: ../auth/auth_login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Captain Panel - Royal Crown</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="menu-bar">
                <div class="menu-trigger">
                    <i class="fas fa-bars"></i>
                </div>
                <div class="menu-items">
                    <a href="#" class="menu-item"><i class="fas fa-home"></i> Home</a>
                    <a href="#" class="menu-item" id="activeOrdersBtn"><i class="fas fa-receipt"></i> Active Orders <span class="badge" id="activeOrdersBadge">0</span></a>
                    <div class="menu-divider"></div>
                    <!-- <a href="#" class="menu-item"><i class="fas fa-cog"></i> Settings</a> -->
                    <a href="../auth/auth_logout.php" class="menu-item"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            </div>
            <h1><i class="fas fa-utensils"></i> Royal Crown</h1>
            <p class="tagline">Welcome, <?php echo htmlspecialchars($_SESSION['name']); ?> (Captain)</p>
        </header>

        <main class="order-section">
            <div class="order-form-container">
                <form id="orderForm" class="order-form">
                    <div class="form-header">
                        <h2>Place or Update Your Order</h2>
                        <p>Please select an existing order or create a new one</p>
                    </div>

                    <!-- Existing Order Selection -->
                    <div class="form-section">
                        <h3><i class="fas fa-receipt"></i> Select Existing Order (Optional)</h3>
                        <div class="form-group">
                            <label for="existing_order_select">
                                <i class="fas fa-list"></i> Choose Order
                            </label>
                            <select id="existing_order_select" name="existing_order_id">
                                <option value="">-- New Order --</option>
                                <!-- Populated dynamically via JS -->
                            </select>
                        </div>
                        <div id="existingOrderDetails" class="existing-order-details" style="display: none;">
                            <h4>Current Order Items</h4>
                            <div id="existingItemsList"></div>
                        </div>
                    </div>

                    <!-- Customer Details Section -->
                    <div class="form-section" id="customerDetailsSection">
                        <h3><i class="fas fa-user-circle"></i> Customer Details</h3>
                        <div class="form-group">
                            <label for="table_selection"><i class="fas fa-chair"></i> Select Table</label>
                            <div class="table-selection-container">
                                <div class="table-status-legend">
                                    <span class="status-item"><i class="fas fa-circle free"></i> Available</span>
                                    <span class="status-item"><i class="fas fa-circle booked"></i> Occupied</span>
                                    <span class="status-item"><i class="fas fa-circle reserved"></i> Reserved</span>
                                </div>
                                <div class="tables-grid" id="tablesGrid"></div>
                                <input type="hidden" id="selected_table_id" name="selected_table_id" required>
                                <div class="selected-table-info" id="selectedTableInfo"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="name"><i class="fas fa-user"></i> Your Name</label>
                            <input type="text" id="name" placeholder="Enter your name" required>
                        </div>
                        <div class="form-group">
                            <label for="phone"><i class="fas fa-phone"></i> Phone Number</label>
                            <input type="tel" id="phone" placeholder="Enter your phone number" required>
                        </div>
                    </div>

                    <!-- Menu Section -->
                    <div class="form-section">
                        <h3><i class="fas fa-utensils"></i> Menu Selection</h3>
                        <div class="menu-sections">
                            <div class="section-tabs" id="sectionTabs">
                                <button class="section-tab active" data-section="all">All</button>
                                <!-- Categories will be dynamically populated here -->
                            </div>
                            <div class="search-bar-container">
                                <input type="text" id="dishSearch" placeholder="Search dishes..." class="search-input">
                                <button type="button" id="clearSearch" class="clear-search-btn"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="dishes-section" id="dishes">
                                <!-- Dishes will be dynamically populated here -->
                            </div>
                        </div>
                    </div>

                    <!-- Payment Section -->
                    <div class="form-section" id="paymentSection">
                        <h3><i class="fas fa-wallet"></i> Payment Details</h3>
                        <div class="form-group">
                            <label for="payment_method">Payment Method</label>
                            <select id="payment_method" required>
                                <option value="">Select payment method</option>
                                <option value="cash" selected>Cash Payment</option>
                                <option value="card">Card Payment</option>
                                <option value="upi">UPI Payment</option>
                            </select>
                        </div>
                        <div class="total-section" id="total_amount">
                            <div class="total-label">Total Amount:</div>
                            <div class="total-value">$0.00</div>
                        </div>
                    </div>

                    <div class="order-buttons">
                        <button type="submit" class="submit-btn">
                            <i class="fas fa-paper-plane"></i> Place/Update Order
                        </button>
                    </div>
                </form>
            </div>
        </main>

        <footer class="footer">
            <div class="footer-content">
                <div class="restaurant-info">
                    <h3><i class="fas fa-utensils"></i> Royal Crown</h3>
                    <p>Serving delicious meals since 2024</p>
                </div>
                <div class="contact-info">
                    <p><i class="fas fa-phone"></i> +1234567890</p>
                    <p><i class="fas fa-envelope"></i> info@restaurant.com</p>
                </div>
                <div class="copyright">
                    <p>© 2024 Restaurant Name. All rights reserved.</p>
                    <p>© Created & Managed by Amoung us</p>
                </div>
            </div>
        </footer>
    </div>

    <!-- Modals -->
    <div id="confirmationModal" class="modal">
        <div class="modal-content confirmation-content">
            <div class="modal-header">
                <i class="fas fa-receipt"></i>
                <h2>Confirm Your Order</h2>
            </div>
            <div class="modal-body">
                <div class="order-details">
                    <div class="detail-section customer-details">
                        <h3><i class="fas fa-user"></i> Customer Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item"><span class="detail-label">Name:</span><span id="confirmName" class="detail-value"></span></div>
                            <div class="detail-item"><span class="detail-label">Table No:</span><span id="confirmTable" class="detail-value"></span></div>
                            <div class="detail-item"><span class="detail-label">Phone:</span><span id="confirmPhone" class="detail-value"></span></div>
                            <div class="detail-item"><span class="detail-label">Payment Method:</span><span id="confirmPayment" class="detail-value"></span></div>
                        </div>
                    </div>
                    <div class="detail-section order-items">
                        <h3><i class="fas fa-utensils"></i> Order Items</h3>
                        <div id="confirmItems" class="items-list"></div>
                    </div>
                    <div class="detail-section order-summary">
                        <div class="total-amount">
                            <span class="total-label">Total Amount:</span>
                            <span id="confirmTotal" class="total-value"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button id="confirmOrder" class="confirm-btn"><i class="fas fa-check"></i> Confirm Order/Update</button>
                <button id="editOrder" class="edit-btn"><i class="fas fa-edit"></i> Edit</button>
            </div>
        </div>
    </div>
    <div id="successModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <i class="fas fa-check-circle"></i>
                <h2>Order Processed Successfully!</h2>
            </div>
            <div class="modal-body">
                <div class="order-id-container">
                    <span>Order ID:</span>
                    <div class="copy-wrapper">
                        <span id="orderIdText"></span>
                        <button id="copyOrderId" class="copy-btn"><i class="fas fa-copy"></i></button>
                    </div>
                </div>
                <p class="success-message">Your order has been confirmed or updated and is being processed.</p>
            </div>
            <div class="modal-footer">
                <button id="closeModal" class="close-modal-btn">Close</button>
            </div>
        </div>
    </div>
    <div id="activeOrdersModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-receipt"></i> Active Orders</h2>
                <button class="close-modal">×</button>
            </div>
            <div class="modal-body">
                <div class="order-status-tabs">
                    <button class="status-tab active" data-status="all">All</button>
                    <button class="status-tab" data-status="processing">Processing</button>
                    <button class="status-tab" data-status="food_prepared">Food Prepared</button>
                    <button class="status-tab" data-status="completed">Completed</button>
                    <button class="status-tab" data-status="bill_generated">Bill Generated</button>
                </div>
                <div class="active-orders-list" id="activeOrdersList"></div>
            </div>
        </div>
    </div>

    <div id="loadingOverlay" class="loading-overlay hidden">
        <div class="spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading...</span></div>
    </div>

    <script src="script.js"></script>
</body>
</html>