<?php
// image_functions.php

function optimizeImage($sourcePath, $destinationPath, $quality = 75) {

        // Check if GD is available
        if (!extension_loaded('gd')) {
            error_log("GD Library is not installed or enabled");
            return false;
        }
    
        // Check if required GD functions exist
        $required_functions = ['imagecreatefromjpeg', 'imagecreatefrompng', 'imagecreatefromgif', 
                             'imagejpeg', 'imagepng', 'imagegif', 'imagecreatetruecolor'];
        foreach ($required_functions as $function) {
            if (!function_exists($function)) {
                error_log("Required GD function not available: $function");
                return false;
            }
        }
    // Validate input parameters
    if (!file_exists($sourcePath)) {
        error_log("Source file does not exist: $sourcePath");
        return false;
    }

    if (!is_writable(dirname($destinationPath))) {
        error_log("Destination directory is not writable: " . dirname($destinationPath));
        return false;
    }

    // Validate quality parameter
    $quality = max(0, min(100, intval($quality)));

    try {
        // Get image info with error suppression
        $info = @getimagesize($sourcePath);
        if (!$info) {
            error_log("Failed to get image info: $sourcePath");
            return false;
        }
        
        $mime = $info['mime'];
        
        // Create image from source with error handling
        switch ($mime) {
            case 'image/jpeg':
                $image = @imagecreatefromjpeg($sourcePath);
                break;
            case 'image/png':
                $image = @imagecreatefrompng($sourcePath);
                if ($image) {
                    imagepalettetotruecolor($image);
                    imagealphablending($image, true);
                    imagesavealpha($image, true);
                }
                break;
            case 'image/gif':
                $image = @imagecreatefromgif($sourcePath);
                break;
            default:
                error_log("Unsupported image type: $mime");
                return false;
        }
        
        if (!$image) {
            error_log("Failed to create image from source: $sourcePath");
            return false;
        }

        // Calculate new dimensions (max width: 800px)
        $maxWidth = 800;
        $width = imagesx($image);
        $height = imagesy($image);
        
        if ($width > $maxWidth) {
            $newWidth = $maxWidth;
            $newHeight = floor($height * ($maxWidth / $width));
            
            // Memory check before creating new image
            $memoryNeeded = $newWidth * $newHeight * 4; // 4 bytes per pixel (RGBA)
            if (memory_get_usage() + $memoryNeeded > memory_get_limit()) {
                error_log("Insufficient memory for image resizing");
                imagedestroy($image);
                return false;
            }
            
            $tmpImage = imagecreatetruecolor($newWidth, $newHeight);
            if (!$tmpImage) {
                error_log("Failed to create resized image");
                imagedestroy($image);
                return false;
            }
            
            // Preserve transparency for PNG
            if ($mime === 'image/png') {
                imagealphablending($tmpImage, false);
                imagesavealpha($tmpImage, true);
                $transparent = imagecolorallocatealpha($tmpImage, 0, 0, 0, 127);
                imagefilledrectangle($tmpImage, 0, 0, $newWidth, $newHeight, $transparent);
            }
            
            if (!imagecopyresampled(
                $tmpImage, $image,
                0, 0, 0, 0,
                $newWidth, $newHeight,
                $width, $height
            )) {
                error_log("Failed to resize image");
                imagedestroy($tmpImage);
                imagedestroy($image);
                return false;
            }
            
            imagedestroy($image);
            $image = $tmpImage;
        }

        // Save optimized image
        $success = false;
        switch ($mime) {
            case 'image/jpeg':
                $success = imagejpeg($image, $destinationPath, $quality);
                break;
            case 'image/png':
                $pngQuality = floor((100 - $quality) / 11.111111);
                $success = imagepng($image, $destinationPath, $pngQuality);
                break;
            case 'image/gif':
                $success = imagegif($image, $destinationPath);
                break;
        }
        
        imagedestroy($image);
        
        if (!$success) {
            error_log("Failed to save optimized image to: $destinationPath");
            return false;
        }
        
        return true;
    } catch (Exception $e) {
        error_log("Exception in optimizeImage: " . $e->getMessage());
        if (isset($image)) {
            imagedestroy($image);
        }
        return false;
    }
}

// Helper function to get PHP memory limit in bytes
function memory_get_limit() {
    $memory_limit = ini_get('memory_limit');
    if (preg_match('/^(\d+)(.)$/', $memory_limit, $matches)) {
        if ($matches[2] == 'M') {
            return $matches[1] * 1024 * 1024;
        } else if ($matches[2] == 'K') {
            return $matches[1] * 1024;
        } else if ($matches[2] == 'G') {
            return $matches[1] * 1024 * 1024 * 1024;
        }
    }
    return $memory_limit;
}
?>