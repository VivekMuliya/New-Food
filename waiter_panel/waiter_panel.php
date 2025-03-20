<?php
session_start();

// Redirect if not logged in or not a waiter
if (!isset($_SESSION['user_id'])) {
    header("Location: ../auth/auth_login.php");
    exit();
}

if ($_SESSION['role'] !== 'waiter') {
    header("Location: ../auth/auth_login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waiter Panel - Royal Crown</title>
    <!-- Updated Font Awesome to 6.5.1 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="waiter_style.css">
</head>
<body>
    <div class="waiter-container">
        <header class="waiter-header">
            <h1><i class="fas fa-concierge-bell"></i> Waiter Panel</h1>
            <!-- Display Logged-in User's Name -->
            <div class="user-name" aria-label="Logged-in User">
                Welcome, <?php echo htmlspecialchars($_SESSION['name']); ?> (Waiter)
            </div>
            <div class="search-bar">
                <input type="text" id="searchInput" placeholder="Search orders..." aria-label="Search orders">
                <i class="fas fa-search"></i>
            </div>
            <div class="header-right">
                <!-- Menu Bar at Top Right -->
                <div class="menu-bar">
                    <button class="menu-toggle" aria-label="Toggle Menu" aria-haspopup="true" aria-expanded="false">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="menu-dropdown hidden" role="menu">
                        <!-- <a href="profile.php" class="menu-option"><i class="fas fa-user"></i> Profile</a> Placeholder for profile page -->
                        <a href="../auth/auth_logout.php" class="menu-option"><i class="fas fa-sign-out-alt"></i> Logout</a>
                    </div>
                </div>
                <div class="notification-bell">
                    <i class="fas fa-bell"></i>
                    <span id="notificationCount" class="badge">0</span>
                </div>
            </div>
        </header>

        <main class="waiter-main">
            <div class="orders-container">
                <div class="orders-grid" id="waiterOrders">
                    <!-- Orders will be displayed here -->
                </div>
            </div>
        </main>

        <div class="notifications" id="notifications"></div>
    </div>

    <script src="waiter_script.js"></script>
</body>
</html>