<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $query = "
        SELECT 
            o.*,
            rt.table_number,
            o.phone_number
        FROM orders o
        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
        WHERE o.status != 'completed'
        ORDER BY o.created_at DESC
    ";
    
    $stmt = $pdo->query($query);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($orders as &$order) {
        $dishQuery = "
            SELECT 
                d.name,
                d.category_id,
                c.name AS category_name,
                od.quantity,
                od.is_new,
                od.preparation_status
            FROM order_details od
            JOIN dishes d ON od.dish_id = d.id
            LEFT JOIN categories c ON d.category_id = c.id
            WHERE od.order_id = ?
        ";
        $dishStmt = $pdo->prepare($dishQuery);
        $dishStmt->execute([$order['id']]);
        $dishes = $dishStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $order['dishes'] = $dishes;
    }
    
    // Debugging: Log the number of orders returned
    error_log('get_active_orders.php returned ' . count($orders) . ' orders');
    
    echo json_encode([
        'success' => true,
        'data' => $orders
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    error_log('get_active_orders.php error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}