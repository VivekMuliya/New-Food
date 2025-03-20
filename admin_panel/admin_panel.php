<?php
session_start();

// Redirect if not logged in or not an admin
if (!isset($_SESSION['user_id'])) {
    header("Location: ../auth/auth_login.php");
    exit();
}

if ($_SESSION['role'] !== 'admin') {
    header("Location: ../auth/auth_login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Restaurant Admin Dashboard - Manage orders, dishes, and categories">
    <meta name="theme-color" content="#2563eb">
    <title>Admin Panel - Royal Crown</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="cutlery.png">
    
    <!-- Fonts and Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js"></script>
    <link rel="stylesheet" href="admin_style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <!-- Global Error Message -->
    <div id="globalError" class="global-error hidden" role="alert">
        <i class="fas fa-exclamation-circle"></i>
        <span class="error-message"></span>
        <button class="close-error" aria-label="Close Error Message">×</button>
    </div>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay hidden">
        <div class="spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading...</span>
        </div>
    </div>

    <div class="dashboard">
        <!-- Sidebar -->
        <aside class="sidebar" role="navigation" aria-label="Main Navigation">
            <div class="logo" role="banner">
                <i class="fas fa-utensils" aria-hidden="true"></i>
                <span>FoodieAdmin</span>
            </div>
            <nav class="sidebar-nav">
                <a href="#" class="nav-item active" onclick="showSection('statistics')" role="menuitem">
                    <i class="fas fa-chart-line" aria-hidden="true"></i>
                    <span>Statistics</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('manage-categories')" role="menuitem">
                    <i class="fas fa-th-list" aria-hidden="true"></i>
                    <span>Manage Categories</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('manage-dishes')" role="menuitem">
                    <i class="fas fa-utensils" aria-hidden="true"></i>
                    <span>Manage Dishes</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('manage-orders')" role="menuitem">
                    <i class="fas fa-receipt" aria-hidden="true"></i>
                    <span>Manage Orders</span>
                    <span id="newOrderCount" class="badge" aria-label="New Orders Count">0</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('completed-orders')" role="menuitem">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <span>Completed Orders</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('bill-details')">
                    <i class="fas fa-file-invoice"></i>
                    <span>Bill Details</span>
                </a>
                <a href="#" class="nav-item" onclick="showSection('reports')" role="menuitem">
                    <i class="fas fa-file-alt" aria-hidden="true"></i>
                    <span>Reports</span>
                </a>
               
            </nav>
        </aside>

        <!-- Main Content -->
        <main class="main-content" role="main">
            <!-- Header -->
            <header class="header" role="banner">
                <div class="header-left">
                    <button class="new-menu-toggle" aria-label="Toggle Menu" aria-haspopup="true" aria-expanded="false">
                        <i class="fas fa-bars" aria-hidden="true"></i>
                    </button>
                    <div class="new-toggle-menu hidden" role="menu">
    <a href="../captain_panel,captain_panel.php" class="menu-option">Captain Panel</a>
    <a href="../waiter_panel/waiter_panel.php" class="menu-option">Waiter Panel</a>
    <a href="../chef_panel/chef_panel.php" class="menu-option">Chef Panel</a>
    <a href="../waiter_panel/waiter_panel.php" class="menu-option">Waiter Panel</a>

    <a href="../auth/auth_logout.php" class="menu-option">Logout</a>
</div>
                    <div class="search-bar" role="search">
                        <i class="fas fa-search" aria-hidden="true"></i>
                        <input 
                            type="search" 
                            id="orderSearch" 
                            name="orderSearch"
                            placeholder="Search by Order ID, Customer Name, or Table Number"
                            aria-label="Search orders">
                    </div>
                </div>
                <div class="header-right">
                    <div id="newOrderNotification" class="notification-bell" role="button" aria-label="Notifications">
                        <i class="fas fa-bell" aria-hidden="true"></i>
                        <span class="notification-badge" aria-label="Notification Count">0</span>
                    </div>
                    <div class="user-profile" tabindex="0" role="button" aria-haspopup="true">
                        <img src="user-setting.png" alt="Admin Profile Picture">
                        <span><?php echo htmlspecialchars($_SESSION['name']); ?> (Admin)</span>
                        <div class="profile-dropdown hidden">
                            <a href="#" role="menuitem"><i class="fas fa-user"></i> Profile</a>
                            <a href="#" role="menuitem"><i class="fas fa-cog"></i> Settings</a>
                            <a href="../auth/auth_logout.php" role="menuitem"><i class="fas fa-sign-out-alt"></i> Logout</a>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Dashboard Content -->
            <div class="dashboard-content">
                <!-- Statistics Section -->
                <section id="statistics" class="section" aria-label="Statistics Dashboard">
                    <div class="bento-grid">
                        <!-- Main Stats Card -->
                        <div class="bento-card bento-large">
                            <div class="bento-card-header">
                                <i class="fas fa-chart-line"></i>
                                <h3>Overview</h3>
                            </div>
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <div class="stat-icon orders">
                                        <i class="fas fa-shopping-bag"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="pending-orders-count">0</span>
                                        <span class="stat-label">Pending Orders</span>
                                    </div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-icon revenue">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="completed-orders-count">0</span>
                                        <span class="stat-label">Completed Orders</span>
                                    </div>
                                </div>
                                
                                <div class="stat-item">
                                    <div class="stat-icon daily">
                                        <i class="fas fa-calendar-day"></i>
                                    </div>
                                    <div class="stat-info">
                                        <span class="stat-value" id="today-revenue">₹0</span>
                                        <span class="stat-label">Today's Revenue</span>
                                    </div>
                                </div>
                            </div>
                        </div>
   
                        <!-- Popular Items Card -->
                        <div class="bento-card bento-medium">
                            <div class="bento-card-header">
                                <i class="fas fa-star"></i>
                                <h3>Top Selling Items</h3>
                            </div>
                            <div class="dishes-list">
                                <ul id="popular-dishes-list"></ul>
                            </div>
                        </div>

                        <!-- Payment Stats Card -->
                        <div class="bento-card bento-medium">
                            <div class="bento-card-header">
                                <div class="header-with-filter">
                                    <div class="header-title">
                                        <i class="fas fa-wallet"></i>
                                        <h3>Payment Methods</h3>
                                    </div>
                                    <select id="paymentStatsFilter" class="time-filter">
                                        <option value="today">Today</option>
                                        <option value="week">This Week</option>
                                        <option value="month">This Month</option>
                                    </select>
                                </div>
                            </div>
                            <div class="payment-methods">
                                <div class="payment-method">
                                    <i class="fas fa-money-bill-wave cash"></i>
                                    <span class="method-label">Cash</span>
                                    <span class="payment-count" id="cash-payment-count">0</span>
                                </div>
                                <div class="payment-method">
                                    <i class="fas fa-mobile-alt upi"></i>
                                    <span class="method-label">UPI</span>
                                    <span class="payment-count" id="upi-payment-count">0</span>
                                </div>
                                <div class="payment-method">
                                    <i class="fas fa-credit-card card"></i>
                                    <span class="method-label">Card</span>
                                    <span class="payment-count" id="card-payment-count">0</span>
                                </div>
                            </div>
                        </div>
        
                        <!-- Revenue Analysis Card -->
                        <div class="bento-card bento-large">
                            <div class="bento-card-header">
                                <div class="header-with-filter">
                                    <div class="header-title">
                                        <i class="fas fa-chart-line"></i>
                                        <h3>Revenue Analysis</h3>
                                    </div>
                                    <div class="time-filters">
                                        <select id="revenueStatsFilter" class="time-filter">
                                            <option value="day">Daily Revenue</option>
                                            <option value="month">Monthly Revenue</option>
                                            <option value="year">Yearly Revenue</option>
                                        </select>
                                        <div id="monthSelector" class="date-selector hidden">
                                            <input type="month" id="monthPicker" class="time-filter">
                                        </div>
                                        <div id="yearSelector" class="date-selector hidden">
                                            <select id="yearPicker" class="time-filter">
                                                <!-- Will be populated with JavaScript -->
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="revenue-stats">
                                <div class="revenue-summary">
                                    <div class="summary-card">
                                        <i class="fas fa-arrow-trend-up"></i>
                                        <div class="summary-details">
                                            <span class="summary-value" id="total-revenue">₹0</span>
                                            <span class="summary-label">Total Revenue</span>
                                        </div>
                                    </div>
                                    <div class="summary-card">
                                        <i class="fas fa-chart-bar"></i>
                                        <div class="summary-details">
                                            <span class="summary-value" id="avg-revenue">₹0</span>
                                            <span class="summary-label">Average Revenue</span>
                                        </div>
                                    </div>
                                    <div class="summary-card">
                                        <i class="fas fa-shopping-bag"></i>
                                        <div class="summary-details">
                                            <span class="summary-value" id="order-count">0</span>
                                            <span class="summary-label">Total Orders</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="revenue-chart-container">
                                    <canvas id="revenueChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bento-card">
                        <div class="header-with-filter">
                            <div class="header-title">
                                <i class="fas fa-chair"></i>
                                <h3>Table Management</h3>
                            </div>
                            <button onclick="addNewTable()" class="btn-action">
                                <i class="fas fa-plus"></i> Add Table
                            </button>
                        </div>
                        <div class="tables-management-grid" id="adminTablesGrid">
                            <!-- Tables will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Category Management Section -->
                <section id="manage-categories" class="section hidden" aria-label="Category Management">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Add/Edit Category</h2>
                        </div>
                        <form id="categoryForm" class="form-container" novalidate>
                            <div id="categoryFormMessage" class="message" role="alert"></div>
                            <input type="hidden" name="category_id" id="category_id">
                            <fieldset>
                                <legend>Category Information</legend>
                                <div class="form-group">
                                    <label for="category_name">Category Name:</label>
                                    <input 
                                        type="text" 
                                        name="name" 
                                        id="category_name" 
                                        placeholder="Enter category name"
                                        required
                                        minlength="2"
                                        maxlength="50"
                                        pattern="[A-Za-z0-9\s-]+"
                                        aria-required="true"
                                    >
                                    <div class="error-message" aria-live="polite"></div>
                                </div>
                                <div class="form-group">
                                    <label for="category_description">Description:</label>
                                    <textarea 
                                        name="description" 
                                        id="category_description" 
                                        placeholder="Enter category description" 
                                        rows="3"
                                        maxlength="200"
                                    ></textarea>
                                </div>
                                <div class="form-group">
                                    <label for="display_order">Display Order:</label>
                                    <input 
                                        type="number" 
                                        name="display_order" 
                                        id="display_order" 
                                        placeholder="Enter display order" 
                                        min="0"
                                        max="999"
                                    >
                                </div>
                            </fieldset>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save" aria-hidden="true"></i> Save Category
                            </button>
                        </form>
                    </div>

                    <div class="dashboard-card mt-4">
                        <div class="card-header">
                            <h2>Categories List</h2>
                        </div>
                        <div class="table-container">
                            <table id="categoriesTable" class="data-table" aria-label="Categories List">
                                <caption>List of Available Categories</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Name</th>
                                        <th scope="col">Description</th>
                                        <th scope="col">Display Order</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Actions</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Manage Dishes Section -->
                <section id="manage-dishes" class="section hidden" aria-label="Dish Management">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Add/Edit Dish</h2>
                        </div>
                        <form id="dishForm" class="form-container" novalidate>
                            <div id="dishFormMessage" class="message" role="alert"></div>
                            <input type="hidden" name="dish_id" id="dish_id">
                            <fieldset>
                                <legend>Dish Information</legend>
                                <div class="form-group">
                                    <label for="category_select">Category:</label>
                                    <select 
                                        name="category_id" 
                                        id="category_select" 
                                        required
                                        aria-required="true"
                                    >
                                        <option value="">Select Category</option>
                                    </select>
                                    <div class="error-message" aria-live="polite"></div>
                                </div>
                                <div class="form-group">
                                    <label for="dish_name">Dish Name:</label>
                                    <input 
                                        type="text" 
                                        name="name" 
                                        id="dish_name" 
                                        placeholder="Enter dish name"
                                        required
                                        minlength="2"
                                        maxlength="100"
                                        aria-required="true"
                                    >
                                    <div class="error-message" aria-live="polite"></div>
                                </div>
                                <div class="form-group">
                                    <label for="dish_description">Description:</label>
                                    <textarea 
                                        name="description" 
                                        id="dish_description" 
                                        placeholder="Enter dish description" 
                                        rows="3"
                                        maxlength="500"
                                    ></textarea>
                                </div>
                                <div class="form-group">
                                    <label for="dish_price">Price:</label>
                                    <input 
                                        type="number" 
                                        name="price" 
                                        id="dish_price" 
                                        placeholder="Enter price"
                                        step="0.01"
                                        min="0"
                                        required
                                        aria-required="true"
                                    >
                                    <div class="error-message" aria-live="polite"></div>
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="is_available" id="dish_available" checked>
                                        <span>Available for Order</span>
                                    </label>
                                </div>
                            </fieldset>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save" aria-hidden="true"></i> Save Dish
                            </button>
                        </form>
                    </div>

                    <div class="dashboard-card mt-4">
                        <div class="card-header">
                            <h2>Dishes List</h2>
                        </div>
                        <div class="table-container">
                            <table id="dishesTable" class="data-table" aria-label="Dishes List">
                                <caption>List of Available Dishes</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Name</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Description</th>
                                        <th scope="col">Price</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Actions</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Manage Orders Section -->
                <section id="manage-orders" class="section hidden" aria-label="Order Management">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Current Orders</h2>
                        </div>
                        <div id="ordersMessage" class="message" role="alert"></div>
                        <div class="orders-grid" id="ordersGrid">
                            <!-- Order cards will be populated here -->
                        </div>
                    </div>
                </section>

                <!-- Completed Orders Section -->
                <section id="completed-orders" class="section hidden" aria-label="Completed Orders">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Completed Orders</h2>
                        </div>
                        <div class="orders-grid" id="completedOrdersGrid">
                            <!-- Completed order cards will be populated here -->
                        </div>
                    </div>
                </section>

                <!-- Bill Details Section -->
                <section id="bill-details" class="hidden">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Bill Details</h2>
                        </div>
                        <div class="search-bar">
                            <i class="fas fa-search"></i>
                            <input type="text" id="billSearch" placeholder="Search bills by order ID, customer name, or phone..." oninput="searchBillDetails()">
                        </div>
                        <div id="billDetailsGrid" class="orders-grid"></div>
                    </div>
                </section>

                <!-- Reports Section -->
                <section id="reports" class="section hidden" aria-label="Reports">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h2>Reports</h2>
                        </div>
                        <div class="report-controls">
                            <div class="report-filters">
                                <div class="filter-group">
                                    <label for="reportType">Report Type:</label>
                                    <select id="reportType" class="form-select" onchange="changeReportType()">
                                        <option value="daily">Daily</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div class="filter-group" id="dateRangeGroup">
                                    <label>Custom Range:</label>
                                    <input type="date" id="startDate" class="form-input">
                                    <span>to</span>
                                    <input type="date" id="endDate" class="form-input">
                                    <button class="btn-primary" onclick="loadReportsByDate()">Apply</button>
                                </div>
                            </div>
                            <div class="quick-filters">
                                <button class="btn-quick-filter" onclick="loadReports('daily', 'today')">
                                    <i class="fas fa-calendar-day"></i> Today
                                </button>
                                <button class="btn-quick-filter" onclick="loadReports('monthly', 'currentMonth')">
                                    <i class="fas fa-calendar-alt"></i> Current Month
                                </button>
                                <button class="btn-quick-filter" onclick="loadReports('monthly', 'currentYear')">
                                    <i class="fas fa-calendar"></i> Current Year
                                </button>
                            </div>
                            <div class="export-buttons">
                                <button class="btn-primary" onclick="exportReport('monthly', 'csv')">
                                    <i class="fas fa-file-csv"></i> Export CSV
                                </button>
                            </div>
                        </div>
                        <div id="reportContent" class="report-content mt-4" role="region" aria-live="polite"></div>
                    </div>
                </section>
            </div>
        </main>
    </div>

    <input type="hidden" id="lastCheckTime" value="">
    
    <!-- Progress Bar -->
    <div class="progress-bar hidden" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div class="progress"></div>
    </div>
    
    <script src="admin_script.js"></script>

    <!-- Created and Developed Section -->
    <footer class="dashboard-footer" role="contentinfo">
        <div class="dashboard-info">
            <div class="footer-section">
                <div class="footer-logo">
                    <i class="fas fa-utensils"></i>
                    <span>FoodieAdmin</span>
                </div>
                <div class="footer-version">
                    v1.0.0 • Build #20241228
                </div>
            </div>
            <div class="footer-links">
                <a href="#" role="menuitem">About</a>
                <a href="#" role="menuitem">Support</a>
                <a href="#" role="menuitem">Terms</a>
                <a href="#" role="menuitem">Privacy</a>
            </div>
            <div class="footer-section">
                <div class="footer-copyright">
                    © 2024 Restaurant Tech Solutions
                </div>
            </div>
        </div>
    </footer>
    <div id="noRevenueMessage" class="no-revenue-popup hidden">
        <div class="popup-content">
            <i class="fas fa-info-circle"></i>
            <span id="noRevenueText">No revenue data found</span>
            <button type="button" class="close-popup" aria-label="Close message">×</button>
        </div>
    </div>
    <div class="overlay hidden"></div>
    <div class="sidebar-overlay"></div>
</body>
</html>