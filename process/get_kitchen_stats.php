<?php
header('Content-Type: application/json');
include '../db.php';

try {
    // Get counts for each status
    $query = "
        SELECT 
            status,
            COUNT(*) as count
        FROM orders
        WHERE status IN ('processing', 'food_prepared')
        AND is_saved = 0
        GROUP BY status
    ";
    
    $stmt = $pdo->query($query);
    $stats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Get average preparation times
    $query = "
        SELECT 
            COUNT(*) as total_orders,
            AVG(TIMESTAMPDIFF(MINUTE, preparation_start_time, preparation_end_time)) as avg_prep_time
        FROM orders
        WHERE status = 'food_prepared'
        AND preparation_start_time IS NOT NULL
        AND preparation_end_time IS NOT NULL
        AND DATE(created_at) = CURDATE()
    ";
    
    $stmt = $pdo->query($query);
    $timeStats = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'counts' => [
                'processing' => $stats['processing'] ?? 0,
                'food_prepared' => $stats['food_prepared'] ?? 0
            ],
            'avg_preparation_time' => round($timeStats['avg_prep_time'] ?? 0),
            'total_orders_today' => $timeStats['total_orders'] ?? 0
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>