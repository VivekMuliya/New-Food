<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['orderId']) || !isset($data['priority'])) {
        throw new Exception('Order ID and priority are required');
    }

    // Validate priority level
    $allowedPriorities = ['high', 'medium', 'low'];
    if (!in_array($data['priority'], $allowedPriorities)) {
        throw new Exception('Invalid priority level');
    }

    $pdo->beginTransaction();

    // Update order priority
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET priority = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing'
    ");
    
    $stmt->execute([$data['priority'], $data['orderId']]);

    // Record the priority change in order_updates
    $stmt = $pdo->prepare("
        INSERT INTO order_updates (
            order_id, 
            update_type, 
            details
        ) VALUES (?, 'priority_change', ?)
    ");
    
    $details = json_encode([
        'new_priority' => $data['priority'],
        'changed_by' => 'chef',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    $stmt->execute([$data['orderId'], $details]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Order priority updated successfully'
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