<?php
session_start();

// Include the database connection
require_once '../db.php';

// Redirect if already logged in
if (isset($_SESSION['user_id'])) {
    header("Location: auth_login.php");
    exit();
}

$success = '';  
$error = '';
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'];
    $password = $_POST['password']; // Simple password (not hashed)
    $role = $_POST['role'];
    $name = $_POST['name'];
    $phone = $_POST['phone'];
    $email = $_POST['email'];

    try {
        // Prepare and execute the query using PDO
        $stmt = $pdo->prepare("INSERT INTO users (username, password, role, name, phone, email) VALUES (?, ?, ?, ?, ?, ?)");
        if ($stmt->execute([$username, $password, $role, $name, $phone, $email])) {
            $success = "Registration successful! Please <a href='auth_login.php'>log in</a>.";
        } else {
            $error = "Registration failed: Unable to insert user.";
        }
    } catch (PDOException $e) {
        $error = "Registration failed: " . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Royal Crown</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="style_auth.css">
</head>
<body>
    <div class="auth-container">
        <div class="auth-card">
            <div class="logo">
                <i class="fas fa-crown"></i>
                <h2>Royal Crown Register</h2>
            </div>
            <p class="tagline">Join the Royal Crown family</p>
            <?php if ($error): ?>
                <div class="error-message"><?php echo $error; ?></div>
            <?php endif; ?>
            <?php if ($success): ?>
                <div class="success-message"><?php echo $success; ?></div>
            <?php endif; ?>
            <form method="POST" action="auth_register.php" class="auth-form">
                <div class="form-group">
                    <label for="username"><i class="fas fa-user"></i> Username</label>
                    <input type="text" id="username" name="username" required placeholder="Enter username" autocomplete="username">
                </div>
                <div class="form-group password-group">
                    <label for="password"><i class="fas fa-lock"></i> Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="password" name="password" required placeholder="Enter password" autocomplete="new-password">
                        <span class="toggle-password" onclick="togglePassword('password')">
                            <i class="fas fa-eye"></i>
                        </span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="role"><i class="fas fa-shield-alt"></i> Role</label>
                    <select id="role" name="role" required>
                        <option value="">Select Role</option>
                        <option value="admin">Admin</option>
                        <option value="waiter">Waiter</option>
                        <option value="chef">Chef</option>
                        <option value="captain">Captain</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="name"><i class="fas fa-user"></i> Full Name</label>
                    <input type="text" id="name" name="name" required placeholder="Enter full name" autocomplete="name">
                </div>
                <div class="form-group">
                    <label for="phone"><i class="fas fa-phone"></i> Phone</label>
                    <input type="tel" id="phone" name="phone" placeholder="Enter phone number" autocomplete="tel">
                </div>
                <div class="form-group">
                    <label for="email"><i class="fas fa-envelope"></i> Email</label>
                    <input type="email" id="email" name="email" placeholder="Enter email" autocomplete="email">
                </div>
                <button type="submit" class="auth-btn"><i class="fas fa-check"></i> Register</button>
                <div class="register-link">
                    <a href="auth_login.php">Already have an account? Login here</a>
                </div>
            </form>
            <div class="footer-text">© 2025 Royal Crown. All rights reserved.</div>
        </div>
    </div>
    <script src="auth_script.js"></script>
</body>
</html>