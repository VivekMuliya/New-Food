<?php
// upload_images.php
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Ensure no output before headers
ob_start();

header('Content-Type: application/json');
include '../db.php';
include 'image_functions.php';

try {
    if (!isset($_FILES['images'])) {
        throw new Exception('No images uploaded');
    }

    $files = $_FILES['images'];
    $allowed_types = ['image/jpeg', 'image/png', 'image/gif'];
    $upload_dir = 'uploads/dishes/';
    $results = [];

    // Create necessary directories with proper error handling
    $dirs = [
        $upload_dir,
        $upload_dir . 'temp/',
        $upload_dir . 'optimized/'
    ];

    foreach ($dirs as $dir) {
        if (!file_exists($dir) && !mkdir($dir, 0777, true)) {
            throw new Exception('Failed to create directory: ' . $dir);
        }
    }

    // Begin transaction
    $pdo->beginTransaction();

    try {
        // Validate all files first
        foreach ($files['tmp_name'] as $key => $tmp_name) {
            if (!isset($files['type'][$key]) || !in_array($files['type'][$key], $allowed_types)) {
                throw new Exception("Invalid file type for {$files['name'][$key]}");
            }

            if ($files['size'][$key] > 5000000) {
                throw new Exception("File too large: {$files['name'][$key]}");
            }

            if ($files['error'][$key] !== UPLOAD_ERR_OK) {
                throw new Exception("Upload error for {$files['name'][$key]}: " . $files['error'][$key]);
            }
        }

        foreach ($files['tmp_name'] as $key => $tmp_name) {
            $extension = strtolower(pathinfo($files['name'][$key], PATHINFO_EXTENSION));
            $filename = uniqid() . '_' . time() . '_' . $key . '.' . $extension;
            $temp_path = $upload_dir . 'temp/' . $filename;
            $optimized_path = $upload_dir . 'optimized/' . $filename;

            if (!move_uploaded_file($tmp_name, $temp_path)) {
                throw new Exception("Failed to save file: {$files['name'][$key]}");
            }

            if (!optimizeImage($temp_path, $optimized_path)) {
                unlink($temp_path);
                throw new Exception("Failed to optimize image: {$files['name'][$key]}");
            }

            unlink($temp_path);

            $results[] = [
                'original_name' => $files['name'][$key],
                'saved_path' => 'uploads/dishes/optimized/' . $filename
            ];
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'All images uploaded and optimized successfully',
            'results' => $results
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        // Clean up any uploaded files
        foreach ($results as $result) {
            @unlink($result['saved_path']);
        }
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}

// Clear any buffered output
ob_end_flush();