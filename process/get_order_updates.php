<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $last_check = $_GET['last_check'] ?? date('Y-m-d H:i:s', strtotime('-1 minute'));
    
    // Check if updated_at column exists
    $columns = $pdo->query("SHOW COLUMNS FROM orders LIKE 'updated_at'")->fetchAll();
    $updateTimeColumn = !empty($columns) ? 'o.updated_at' : 'o.created_at';
    
    // Fetch orders updated since last_check
    $query = "
        SELECT DISTINCT
            o.id as order_id,
            o.status,
            o.customer_name,
            o.restaurant_table_id,
            rt.table_number,
            o.total_amount,
            o.created_at,
            " . $updateTimeColumn . " as updated_at
        FROM orders o
        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
        WHERE " . $updateTimeColumn . " > ?
        OR EXISTS (
            SELECT 1 
            FROM order_updates ou 
            WHERE ou.order_id = o.id 
            AND ou.created_at > ?
        )
        ORDER BY " . $updateTimeColumn . " DESC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([$last_check, $last_check]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get dishes for each order with preparation status
    foreach ($orders as &$order) {
        $dishQuery = "
            SELECT 
                d.name,
                od.quantity,
                od.preparation_status,
                od.is_new
            FROM order_details od
            JOIN dishes d ON od.dish_id = d.id
            WHERE od.order_id = ?
        ";
        $dishStmt = $pdo->prepare($dishQuery);
        $dishStmt->execute([$order['order_id']]);
        $dishes = $dishStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $order['dishes'] = $dishes;
        $order['ordered_dishes'] = array_map(function($dish) {
            return $dish['name'] . ' (' . $dish['quantity'] . ')';
        }, $dishes);
        $order['ordered_dishes'] = implode(', ', $order['ordered_dishes']);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $orders,
        'current_time' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    error_log('Error in get_order_updates.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>