<?php
session_start();

// Include the database connection
require_once '../db.php';

// Check if user is already logged in
if (isset($_SESSION['user_id'])) {
    $role = $_SESSION['role'];
    switch ($role) {
        case 'admin':
            header("Location: ../admin_panel/admin_panel.php");
            break;
        case 'waiter':
            header("Location: ../waiter_panel/waiter_panel.php");
            break;
        case 'chef':
            header("Location: ../chef_panel/chef_panel.php");
            break;
        case 'captain':
            header("Location: ../captain_panel/captain_panel.php");
            break;
    }
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'];
    $password = $_POST['password'];

    try {
        // Prepare and execute the query using PDO
        $stmt = $pdo->prepare("SELECT id, username, password, role, name, phone, email FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && $password === $user['password']) { // Simple password comparison (consider hashing in production)
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['name'] = $user['name'];
            $_SESSION['phone'] = $user['phone'];
            $_SESSION['email'] = $user['email'];

            switch ($user['role']) {
                case 'admin':
                    header("Location: ../admin_panel/admin_panel.php");
                    break;
                case 'waiter':
                    header("Location: ../waiter_panel/waiter_panel.php");
                    break;
                case 'chef':
                    header("Location: ../chef_panel/chef_panel.php");
                    break;
                case 'captain':
                    header("Location: ../captain_panel/captain_panel.php");
                    break;
            }
            exit();
        } else {
            $error = "Invalid username or password";
        }
    } catch (PDOException $e) {
        $error = "Database error: " . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Royal Crown</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="style_auth.css">
</head>
<body>
    <div class="auth-container">
        <div class="auth-card">
            <div class="logo">
                <h2>Royal Crown Login</h2>
            </div>
            <p class="tagline">Access your panel with elegance</p>
            <?php if ($error): ?>
                <div class="error-message"><?php echo $error; ?></div>
            <?php endif; ?>
            <form method="POST" action="auth_login.php" class="auth-form">
                <div class="form-group">
                    <label for="username"><i class="fas fa-user"></i> Username</label>
                    <input type="text" id="username" name="username" required placeholder="Enter username" autocomplete="username">
                </div>
                <div class="form-group password-group">
                    <label for="password"><i class="fas fa-lock"></i> Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="password" name="password" required placeholder="Enter password" autocomplete="current-password">
                        <span class="toggle-password" onclick="togglePassword('password')">
                            <i class="fas fa-eye"></i>
                        </span>
                    </div>
                </div>
                <button type="submit" class="auth-btn"><i class="fas fa-sign-in-alt"></i> Login</button>
                <div class="register-link">
                    <a href="auth_register.php">Need an account? Register here</a>
                </div>
            </form>
            <div class="footer-text">© 2025 Royal Crown. All rights reserved.</div>
        </div>
    </div>
    <script src="auth_script.js"></script>
</body>
</html>