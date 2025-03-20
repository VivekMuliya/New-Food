<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['orderId'])) {
        throw new Exception('Order ID is required');
    }

    $orderId = $data['orderId'];
    $pdo->beginTransaction();

    // Check current order status
    $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $currentStatus = $stmt->fetchColumn();
    if (!$currentStatus) {
        throw new Exception('Order not found');
    }
    if (in_array($currentStatus, ['completed', 'bill_generated'])) {
        throw new Exception('Cannot mark dishes for a completed or billed order');
    }

    // Mark all dishes in the order as prepared
    $stmt = $pdo->prepare("
        UPDATE order_details 
        SET preparation_status = 'prepared',
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ? AND preparation_status = 'pending'
    ");
    $stmt->execute([$orderId]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('No pending dishes found for this order');
    }

    // Update the order status to food_prepared
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'food_prepared',
            preparation_end_time = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$orderId]);

    // Record the status change in order_updates
    $stmt = $pdo->prepare("
        INSERT INTO order_updates (
            order_id, 
            update_type, 
            details
        ) VALUES (?, 'status_change', ?)
    ");
    $details = json_encode([
        'previous_status' => $currentStatus,
        'new_status' => 'food_prepared',
        'changed_by' => 'chef', // Changed to 'chef' for consistency
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    $stmt->execute([$orderId, $details]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'All dishes marked as prepared'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>