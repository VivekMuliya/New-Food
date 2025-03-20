<?php
header('Content-Type: application/json');
include '../db.php';

try {
    if (!isset($_GET['id'])) {
        throw new Exception('Order ID is required');
    }

    // Get order details
    $stmt = $pdo->prepare("
        SELECT 
            o.*,
            rt.table_number,
            rt.capacity
        FROM orders o
        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
        WHERE o.id = ?
    ");
    
    $stmt->execute([$_GET['id']]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        throw new Exception('Order not found');
    }

    // Get ordered dishes
    $stmt = $pdo->prepare("
        SELECT 
            od.dish_id,
            od.quantity,
            d.name as dish_name,
            d.price,
            d.description,
            c.name as category_name
        FROM order_details od
        JOIN dishes d ON od.dish_id = d.id
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE od.order_id = ?
    ");
    
    $stmt->execute([$_GET['id']]);
    $dishes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group dishes by category
    $groupedDishes = [];
    foreach ($dishes as $dish) {
        $categoryName = $dish['category_name'] ?? 'Uncategorized';
        if (!isset($groupedDishes[$categoryName])) {
            $groupedDishes[$categoryName] = [];
        }
        $groupedDishes[$categoryName][] = $dish;
    }

    // Get order updates if any
    $stmt = $pdo->prepare("
        SELECT 
            update_type,
            details,
            created_at
        FROM order_updates
        WHERE order_id = ?
        ORDER BY created_at DESC
    ");
    
    $stmt->execute([$_GET['id']]);
    $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'order_id' => $order['id'],
            'customer_name' => $order['customer_name'],
            'phone_number' => $order['phone_number'],
            'table_number' => $order['table_number'],
            'restaurant_table_id' => $order['restaurant_table_id'],
            'payment_method' => $order['payment_method'],
            'total_amount' => $order['total_amount'],
            'status' => $order['status'],
            'is_saved' => $order['is_saved'],
            'special_requests' => $order['special_requests'],
            'created_at' => $order['created_at'],
            'updated_at' => $order['updated_at'],
            'dishes' => $dishes,
            'grouped_dishes' => $groupedDishes,
            'updates' => $updates
        ]
    ];

    // Add preparation times if order is in processing
    if ($order['status'] === 'processing') {
        $stmt = $pdo->prepare("
            SELECT 
                d.name as dish_name,
                dpt.avg_preparation_time,
                ks.name as station_name
            FROM order_details od
            JOIN dishes d ON od.dish_id = d.id
            LEFT JOIN dish_preparation_times dpt ON d.id = dpt.dish_id
            LEFT JOIN kitchen_stations ks ON dpt.station_id = ks.id
            WHERE od.order_id = ?
        ");
        
        $stmt->execute([$_GET['id']]);
        $prepTimes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $response['data']['preparation_times'] = $prepTimes;
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}
?>