<?php
// Add this at the start of upload_image.php, after error reporting setup
if (!extension_loaded('gd')) {
    error_log("GD Library is not installed or enabled");
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server configuration error: GD Library is not installed'
    ]);
    exit;
}

// You can also add this to see all enabled extensions
error_log("Loaded PHP extensions: " . implode(', ', get_loaded_extensions()));
?>

<?php
// upload_image.php

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// Start output buffering
ob_start();

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Check if files and dish_id are set
    if (!isset($_FILES['image'])) {
        throw new Exception('No image file uploaded');
    }

    if (!isset($_POST['dish_id'])) {
        throw new Exception('No dish ID provided');
    }

    // Log received data for debugging
    error_log("Received upload request - Files: " . print_r($_FILES, true));
    error_log("POST data: " . print_r($_POST, true));

    // Include required files
    if (!file_exists('../db.php')) {
        throw new Exception('Database configuration file missing');
    }
    if (!file_exists('image_functions.php')) {
        throw new Exception('Image functions file missing');
    }

    require_once '../db.php';
    require_once 'image_functions.php';

    // Validate dish_id
    $dish_id = filter_var($_POST['dish_id'], FILTER_VALIDATE_INT);
    if (!$dish_id) {
        throw new Exception('Invalid dish ID format');
    }

    // Validate uploaded file
    $file = $_FILES['image'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('File upload error: ' . getUploadErrorMessage($file['error']));
    }

    $allowed_types = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($file['type'], $allowed_types)) {
        throw new Exception('Invalid file type. Only JPG, PNG and GIF are allowed.');
    }

    if ($file['size'] > 5000000) {
        throw new Exception('File too large. Maximum size is 5MB.');
    }

    // Create directory structure
    $upload_dir = 'uploads/dishes/';
    $temp_dir = $upload_dir . 'temp/';
    $optimized_dir = $upload_dir . 'optimized/';

    foreach ([$upload_dir, $temp_dir, $optimized_dir] as $dir) {
        if (!file_exists($dir)) {
            if (!mkdir($dir, 0777, true)) {
                throw new Exception("Failed to create directory: $dir");
            }
            error_log("Created directory: $dir");
        }
    }

    // Generate unique filename
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $filename = uniqid() . '_' . time() . '.' . $extension;
    $temp_path = $temp_dir . $filename;
    $optimized_path = $optimized_dir . $filename;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $temp_path)) {
        throw new Exception("Failed to move uploaded file to temp directory");
    }
    error_log("File moved to temp location: $temp_path");

    // Optimize image
    if (!optimizeImage($temp_path, $optimized_path)) {
        unlink($temp_path);
        throw new Exception("Failed to optimize image");
    }
    error_log("Image optimized successfully: $optimized_path");

    // Clean up temp file
    unlink($temp_path);

    // Update database
    $image_url = 'uploads/dishes/optimized/' . $filename;
    
    $stmt = $pdo->prepare("UPDATE dishes SET image_url = ? WHERE id = ?");
    if (!$stmt->execute([$image_url, $dish_id])) {
        unlink($optimized_path);
        throw new Exception("Failed to update database");
    }

    // Clear any buffered output
    ob_clean();

    // Send success response
    echo json_encode([
        'success' => true,
        'message' => 'Image uploaded and optimized successfully',
        'image_url' => $image_url
    ]);

} catch (Exception $e) {
    // Log the error
    error_log("Error in upload_image.php: " . $e->getMessage());
    
    // Clear any buffered output
    ob_clean();
    
    // Set appropriate status code
    http_response_code(400);
    
    // Send error response
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    // Log the error
    error_log("Database error in upload_image.php: " . $e->getMessage());
    
    // Clear any buffered output
    ob_clean();
    
    // Set appropriate status code
    http_response_code(500);
    
    // Send error response
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}

// Helper function to get upload error messages
function getUploadErrorMessage($error_code) {
    switch ($error_code) {
        case UPLOAD_ERR_INI_SIZE:
            return "The uploaded file exceeds the upload_max_filesize directive in php.ini";
        case UPLOAD_ERR_FORM_SIZE:
            return "The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form";
        case UPLOAD_ERR_PARTIAL:
            return "The uploaded file was only partially uploaded";
        case UPLOAD_ERR_NO_FILE:
            return "No file was uploaded";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "Missing a temporary folder";
        case UPLOAD_ERR_CANT_WRITE:
            return "Failed to write file to disk";
        case UPLOAD_ERR_EXTENSION:
            return "A PHP extension stopped the file upload";
        default:
            return "Unknown upload error";
    }
}

// End output buffering
ob_end_flush();
?>