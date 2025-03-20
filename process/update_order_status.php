<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['orderId']) || !isset($data['status'])) {
        throw new Exception('Order ID and status are required');
    }

    // Validate status (chef can only mark as food_prepared)
    if ($data['status'] !== 'food_prepared') {
        throw new Exception('Invalid status update for chef');
    }

    $pdo->beginTransaction();

    // Get current order status
    $stmt = $pdo->prepare("
        SELECT status 
        FROM orders 
        WHERE id = ?
    ");
    $stmt->execute([$data['orderId']]);
    $currentStatus = $stmt->fetchColumn();

    // Verify status flow (can only update from processing to food_prepared)
    if ($currentStatus !== 'processing') {
        throw new Exception('Can only update orders that are in processing status');
    }

    // Update order status
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = ?,
            preparation_end_time = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    
    $stmt->execute(['food_prepared', $data['orderId']]);

    // Record the status change
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
        'changed_by' => 'chef',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    $stmt->execute([$data['orderId'], $details]);

    // Group similar dishes logic
    $stmt = $pdo->prepare("
        SELECT DISTINCT o2.id
        FROM orders o1
        JOIN order_details od1 ON o1.id = od1.order_id
        JOIN orders o2 ON o2.status = 'processing'
        JOIN order_details od2 ON o2.id = od2.order_id
        WHERE o1.id = ?
        AND o2.id != o1.id
        AND od2.dish_id = od1.dish_id
    ");
    
    $stmt->execute([$data['orderId']]);
    $similarOrders = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Order status updated successfully',
        'similar_orders' => $similarOrders // Return similar orders for frontend notification
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