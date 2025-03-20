<?php
session_start();

// Redirect if not logged in or not a chef
if (!isset($_SESSION['user_id'])) {
    header("Location: ../auth/auth_login.php");
    exit();
}

if ($_SESSION['role'] !== 'chef') {
    header("Location: ../auth/auth_login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chef Panel - Kitchen Display System</title>
    <!-- Updated Font Awesome to 6.5.1 for consistency -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="chef_style.css">
</head>
<body>
    <div class="kitchen-container">
        <header class="kitchen-header">
            <div class="header-top">
                <div class="header-left">
                    <h1><i class="fas fa-utensils"></i> Kitchen Display System</h1>
                    <div class="user-info">
                        <span class="user-name" aria-label="Logged-in User">
                            Welcome, <?php echo htmlspecialchars($_SESSION['name']); ?> (Chef)
                        </span>
                    </div>
                </div>
                <!-- Menu Bar at Top Right -->
                <div class="menu-bar">
                    <button class="menu-toggle" aria-label="Toggle Menu" aria-haspopup="true" aria-expanded="false">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="menu-dropdown" role="menu">
                        <!-- <a href="profile.php" class="menu-option"><i class="fas fa-user"></i> Profile</a> -->
                        <a href="../auth/auth_logout.php" class="menu-option"><i class="fas fa-sign-out-alt"></i> Logout</a>
                    </div>
                </div>
            </div>
            <div class="header-bottom">
                <div class="header-controls">
                    <button id="voiceToggle" class="voice-toggle" aria-label="Toggle Voice Recognition">
                        <i class="fas fa-microphone"></i>
                    </button>
                    <div class="notification-bell">
                        <i class="fas fa-bell"></i>
                        <span id="notificationCount" class="badge">0</span>
                    </div>
                </div>
                <div class="header-stats">
                    <div class="stat-item">
                        <span id="processingCount" class="stat-number">0</span>
                        <span class="stat-label">Processing</span>
                    </div>
                    <div class="stat-item">
                        <span id="preparedCount" class="stat-number">0</span>
                        <span class="stat-label">Prepared</span>
                    </div>
                </div>
            </div>
        </header>

        <main class="kitchen-main">
            <div class="orders-container">
                <div class="orders-grid" id="processingOrders">
                    <!-- Processing orders will be displayed here -->
                </div>
                <div class="similar-dishes-panel" id="similarDishesPanel">
                    <!-- Similar dishes grouping will be shown here -->
                </div>
            </div>
        </main>

        <div class="notifications" id="notifications"></div>
    </div>

    <!-- <div id="priorityModal" class="modal">
        <div class="modal-content">
            <h2>Set Priority</h2>
            <div class="priority-options">
                <button class="priority-btn" data-priority="high">High</button>
                <button class="priority-btn" data-priority="medium">Medium</button>
                <button class="priority-btn" data-priority="low">Low</button>
            </div>
        </div>
    </div> -->

    <script src="chef_script.js"></script>
</body>
</html>