<?php
function calculateOrderTotal($dishes, $pdo) {
    $total = 0;
    $stmt = $pdo->prepare("SELECT price FROM dishes WHERE id = ?");
    
    foreach ($dishes as $dish) {
        $stmt->execute([$dish['dishId']]);
        $price = $stmt->fetchColumn();
        if ($price !== false) {
            $total += $price * $dish['quantity'];
        }
    }
    
    return $total;
}

function validateOrderStatus($orderId, $pdo) {
    $stmt = $pdo->prepare("
        SELECT status 
        FROM orders 
        WHERE id = ? AND status != 'completed'
    ");
    $stmt->execute([$orderId]);
    return $stmt->fetchColumn();
}

function logOrderUpdate($orderId, $updateType, $details, $pdo) {
    $stmt = $pdo->prepare("
        INSERT INTO order_updates (
            order_id,
            update_type,
            details,
            created_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ");
    return $stmt->execute([$orderId, $updateType, json_encode($details)]);
}
?>