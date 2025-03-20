<?php
header('Content-Type: application/json');
include '../db.php';

try {
    // Get orders with at least one unprepared dish
    $query = "
        SELECT 
            o.*,
            rt.table_number,
            TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) as order_age,
            GROUP_CONCAT(
                CONCAT(
                    COALESCE(c.name, 'Other'), 
                    ': ', 
                    d.name, 
                    ' (', 
                    od.quantity, 
                    IF(od.is_new = 1, ' - NEW', ''), 
                    ', Status: ', 
                    od.preparation_status,
                    ', DetailId: ', 
                    od.id,
                    ')'
                )
                ORDER BY c.name 
                SEPARATOR ' | '
            ) as ordered_dishes,
            GROUP_CONCAT(DISTINCT d.name) as dish_names,
            GROUP_CONCAT(
                DISTINCT CONCAT(d.id, ':', od.quantity)
                ORDER BY d.name
            ) as dish_quantities
        FROM orders o
        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
        LEFT JOIN order_details od ON o.id = od.order_id
        LEFT JOIN dishes d ON od.dish_id = d.id
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE od.preparation_status = 'pending' AND o.status != 'completed'
        GROUP BY 
            o.id, 
            o.restaurant_table_id,
            o.customer_name,
            o.total_amount,
            o.status,
            o.phone_number,
            o.payment_method,
            rt.table_number,
            o.created_at
        ORDER BY o.created_at ASC
    ";
    
    $stmt = $pdo->query($query);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Query to find similar dishes (unprepared only) with detailed info
    $similarDishesQuery = "
        SELECT 
            d.name as dish_name,
            GROUP_CONCAT(
                CONCAT(o.id, ':', od.quantity, ':', od.id)
            ) as order_details,
            COUNT(DISTINCT o.id) as order_count,
            SUM(od.quantity) as total_quantity
        FROM orders o
        JOIN order_details od ON o.id = od.order_id
        JOIN dishes d ON od.dish_id = d.id
        WHERE od.preparation_status = 'pending' AND o.status != 'completed'
        GROUP BY d.id, d.name
        HAVING order_count > 1
    ";

    $stmt = $pdo->query($similarDishesQuery);
    $similarDishes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Process similar dishes into a more usable format
    $groupedDishes = [];
    foreach ($similarDishes as $dish) {
        $orderDetails = [];
        foreach (explode(',', $dish['order_details']) as $detail) {
            list($orderId, $quantity, $detailId) = explode(':', $detail);
            $orderDetails[] = [
                'order_id' => (int)$orderId,
                'quantity' => (int)$quantity,
                'detail_id' => (int)$detailId
            ];
        }
        $groupedDishes[$dish['dish_name']] = [
            'orders' => array_unique(array_column($orderDetails, 'order_id')),
            'count' => (int)$dish['order_count'],
            'total_quantity' => (int)$dish['total_quantity'],
            'details' => $orderDetails
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'orders' => $orders,
            'similarDishes' => $groupedDishes
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