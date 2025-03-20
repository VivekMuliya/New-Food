<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['detailId'])) {
        throw new Exception('Order detail ID is required');
    }

    $pdo->beginTransaction();

    // Update the specific dish's preparation status
    $stmt = $pdo->prepare("
        UPDATE order_details 
        SET preparation_status = 'prepared',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$data['detailId']]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('Order detail not found');
    }

    // Get the order ID associated with this detail
    $stmt = $pdo->prepare("SELECT order_id FROM order_details WHERE id = ?");
    $stmt->execute([$data['detailId']]);
    $orderId = $stmt->fetchColumn();

    // Check if all dishes for this order are prepared
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN preparation_status = 'prepared' THEN 1 ELSE 0 END) as prepared
        FROM order_details
        WHERE order_id = ?
    ");
    $stmt->execute([$orderId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $allPrepared = $result['total'] > 0 && $result['total'] == $result['prepared'];

    if ($allPrepared) {
        $stmt = $pdo->prepare("
            UPDATE orders
            SET status = 'food_prepared',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status NOT IN ('completed', 'bill_generated')
        ");
        $stmt->execute([$orderId]);

        // Log the status change in order_updates
        $stmt = $pdo->prepare("
            INSERT INTO order_updates (
                order_id, 
                update_type, 
                details
            ) VALUES (?, 'status_change', ?)
        ");
        $details = json_encode([
            'previous_status' => 'processing',
            'new_status' => 'food_prepared',
            'changed_by' => 'chef',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        $stmt->execute([$orderId, $details]);
    }

    // Record the dish preparation in order_updates
    $stmt = $pdo->prepare("
        INSERT INTO order_updates (
            order_id, 
            update_type, 
            details
        ) VALUES (?, 'dish_status_change', ?)
    ");
    $details = json_encode([
        'detail_id' => $data['detailId'],
        'new_status' => 'prepared',
        'changed_by' => 'chef',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    $stmt->execute([$orderId, $details]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Dish marked as prepared'
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