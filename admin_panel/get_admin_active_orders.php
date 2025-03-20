<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $query = "
        SELECT 
            o.*,
            rt.table_number,
            o.phone_number,
            GROUP_CONCAT(
                CONCAT(
                    COALESCE(c.name, 'Other'), 
                    ': ', 
                    d.name, 
                    ' (', 
                    od.quantity, 
                    IF(od.is_new = 1, ' - NEW', ''), 
                    ')'
                )
                ORDER BY c.name 
                SEPARATOR ' | '
            ) as ordered_dishes
        FROM orders o
        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
        LEFT JOIN order_details od ON o.id = od.order_id
        LEFT JOIN dishes d ON od.dish_id = d.id
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE o.status NOT IN ('completed', 'bill_generated')
        GROUP BY o.id, o.restaurant_table_id, o.customer_name, o.total_amount, o.status, o.phone_number, o.payment_method, rt.table_number, o.created_at
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
    
    echo json_encode([
        'success' => true,
        'data' => $orders
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>