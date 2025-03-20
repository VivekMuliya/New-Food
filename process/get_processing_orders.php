<?php
header('Content-Type: application/json');
include '../db.php';

try {
    $query = "
        SELECT 
            o.*,
            rt.table_number,
            GROUP_CONCAT(
                CONCAT(
                    c.name, 
                    ': ', 
                    d.name, 
                    ' (', 
                    od.quantity, 
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
        WHERE o.status = 'processing'
        GROUP BY o.id
        ORDER BY 
            o.created_at ASC
    ";
    
    $stmt = $pdo->query($query);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group similar dishes across orders
    $similarDishes = [];
    foreach ($orders as $order) {
        preg_match_all('/([^|:]+): ([^|]+)\((\d+)\)/', $order['ordered_dishes'], $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $category = trim($match[1]);
            $dish = trim($match[2]);
            $quantity = intval($match[3]);
            
            if (!isset($similarDishes[$dish])) {
                $similarDishes[$dish] = [
                    'name' => $dish,
                    'category' => $category,
                    'total_quantity' => 0,
                    'orders' => []
                ];
            }
            
            $similarDishes[$dish]['total_quantity'] += $quantity;
            $similarDishes[$dish]['orders'][] = [
                'order_id' => $order['id'],
                'table_number' => $order['table_number'],
                'quantity' => $quantity
            ];
        }
    }

    // Filter dishes that appear in multiple orders
    $similarDishes = array_filter($similarDishes, function($dish) {
        return count($dish['orders']) > 1;
    });
    
    echo json_encode([
        'success' => true,
        'data' => [
            'orders' => $orders,
            'similar_dishes' => array_values($similarDishes)
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}