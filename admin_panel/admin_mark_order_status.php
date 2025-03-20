<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['orderId']) || !isset($data['status'])) {
        throw new Exception('Order ID and status are required');
    }

    $orderId = $data['orderId'];
    $newStatus = $data['status'];

    if (!in_array($newStatus, ['pending', 'processing', 'food_prepared', 'completed', 'bill_generated'])) {
        throw new Exception('Invalid status value');
    }

    $pdo->beginTransaction();

    // Validate current status and transitions
    $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $currentStatus = $stmt->fetchColumn();
    if (!$currentStatus) {
        throw new Exception('Order not found');
    }
    if ($currentStatus === 'bill_generated') {
        throw new Exception('Cannot modify order after bill is generated');
    }
    if ($currentStatus !== 'food_prepared' && $newStatus === 'completed') {
        throw new Exception('Order must be in "food_prepared" status to mark as completed');
    }
    if ($currentStatus !== 'completed' && $newStatus === 'bill_generated') {
        throw new Exception('Order must be in "completed" status to generate bill');
    }

    // Update order status
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$newStatus, $orderId]);

    // Update table status for 'completed' or 'bill_generated'
    if (in_array($newStatus, ['completed', 'bill_generated'])) {
        $stmt = $pdo->prepare("
            UPDATE restaurant_tables rt
            JOIN orders o ON rt.id = o.restaurant_table_id
            SET rt.status = 'free',
                rt.last_order_id = NULL
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
    }

    // Log the status change
    $stmt = $pdo->prepare("
        INSERT INTO order_updates (order_id, update_type, details)
        VALUES (?, 'status_change', ?)
    ");
    $details = json_encode([
        'previous_status' => $currentStatus,
        'new_status' => $newStatus,
        'changed_by' => 'admin',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    $stmt->execute([$orderId, $details]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Order status updated successfully'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>