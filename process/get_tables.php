<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $query = "
        SELECT 
            rt.id,
            rt.table_number,
            rt.capacity,
            rt.status,
            CASE 
                WHEN rt.status = 'booked' THEN o.id
                ELSE NULL 
            END as current_order_id,
            CASE 
                WHEN rt.status = 'booked' THEN o.customer_name
                ELSE NULL 
            END as current_customer
        FROM restaurant_tables rt
        LEFT JOIN orders o ON rt.last_order_id = o.id AND o.status != 'completed'
        ORDER BY rt.table_number
    ";
    
    $stmt = $pdo->query($query);
    $tables = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $tables
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>